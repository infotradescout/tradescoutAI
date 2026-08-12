import { randomUUID } from "node:crypto";
import type { Express, Request, Response } from "express";
import { z, ZodError } from "zod";

import { pool } from "../db";
import {
  JW_STONE_ELIGIBLE_CONTAINER_OFFER_STATES,
  jwStoneOperatorDecisionSchema,
  jwStoneOfferRefSchema,
  parseJwStoneUsdToCents,
} from "@shared/jwStoneExpress";
import {
  JW_STONE_OFFER_INVENTORY,
  getContainerPublicTarget,
  getStoneBySourceRef,
  getStonePublicTarget,
  resolveOfferTarget,
} from "../jw-stone-express/catalog";
import { kickJwStoneOutbox, retryFailedJwStoneEmail } from "../jw-stone-express/outbox";
import {
  maskJwStoneEmail,
  maskJwStonePhone,
  randomPublicRef,
  requireIdempotencyKey,
  requireSameOriginJson,
} from "../jw-stone-express/security";
import {
  amountDisplay,
  appendOfferVersion,
  insertOfferEvent,
  lockJwStoneOfferTarget,
  queueOfferStatusEmail,
  readIdempotencyReceipt,
  storeIdempotencyReceipt,
  withJwStoneTransaction,
  type IdempotencyScope,
} from "../jw-stone-express/store";

type AsyncHandler = (req: Request, res: Response) => Promise<void>;
type Operator = { id: string; role: string };

function route(handler: AsyncHandler) {
  return (req: Request, res: Response) => {
    void handler(req, res).catch((error) => {
      const status = error instanceof ZodError ? 400 : Number((error as any)?.status || 500);
      if (status >= 500) {
        console.error("[jw-stone-offers-admin] request failed", {
          method: req.method,
          path: req.path,
          code: (error as any)?.code || null,
        });
      }
      if (!res.headersSent) {
        res.status(Math.max(400, Math.min(599, status))).json({
          message:
            status >= 500
              ? "The JW Stone offer workspace could not complete that request."
              : error instanceof ZodError
                ? error.issues[0]?.message || "Check the submitted information."
                : error instanceof Error
                  ? error.message
                  : "The request could not be completed.",
        });
      }
    });
  };
}

function userIdentity(req: Request): { id: string; roles: string[] } | null {
  const authenticated =
    typeof (req as any).isAuthenticated === "function" && (req as any).isAuthenticated();
  const user = (req as any).user;
  if (!authenticated || !user) return null;
  const id = String(user.id || user.claims?.sub || "").trim();
  const roles = [user.role, user.activeRole, ...(Array.isArray(user.roles) ? user.roles : [])]
    .map((value) =>
      String(value || "")
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);
  return id ? { id, roles } : null;
}

async function requireOperator(req: Request): Promise<Operator> {
  const identity = userIdentity(req);
  if (!identity) throw Object.assign(new Error("Authentication required."), { status: 401 });
  if (identity.roles.some((role) => role === "ops_admin" || role === "super_admin")) {
    return {
      id: identity.id,
      role: identity.roles.includes("super_admin") ? "super_admin" : "ops_admin",
    };
  }
  const owner = await pool.query(
    `select 1 from profiles where lower(slug) = 'jw-stone' and owner_user_id = $1 limit 1`,
    [identity.id]
  );
  if (!owner.rows[0])
    throw Object.assign(new Error("JW Stone operator access required."), { status: 403 });
  return { id: identity.id, role: "jw_stone_owner" };
}

function queryLimit(req: Request): number {
  return Math.max(1, Math.min(100, Number(req.query.limit || 100) || 100));
}

function outboxStatus(status: string): string {
  return status === "pending" || status === "retry" ? "queued" : status;
}

async function notificationsForOffers(offerIds: string[]) {
  if (!offerIds.length) return new Map<string, any[]>();
  const result = await pool.query(
    `
      select id, offer_id, purpose, status, attempt_count, available_at,
             sent_at, failed_at, last_error_summary, updated_at
      from jw_stone_email_outbox
      where offer_id = any($1::uuid[])
      order by created_at desc, id desc
    `,
    [offerIds]
  );
  const mapped = new Map<string, any[]>();
  for (const row of result.rows) {
    const key = String(row.offer_id);
    const items = mapped.get(key) || [];
    items.push({
      id: String(row.id),
      purpose: String(row.purpose),
      status: outboxStatus(String(row.status)),
      attemptCount: Number(row.attempt_count),
      nextAttemptAt:
        row.status === "pending" || row.status === "retry"
          ? new Date(row.available_at).toISOString()
          : null,
      lastAttemptAt: row.attempt_count ? new Date(row.updated_at).toISOString() : null,
      sentAt: row.sent_at ? new Date(row.sent_at).toISOString() : null,
      failureSummary: row.last_error_summary ? String(row.last_error_summary) : null,
    });
    mapped.set(key, items);
  }
  return mapped;
}

const offerFilterSchema = z.object({
  targetType: z.enum(["stone", "container"]).optional(),
  status: z
    .enum(["submitted", "under_review", "accepted", "declined", "withdrawn", "expired"])
    .optional(),
});

const optionalAmountSchema = z.union([z.string(), z.null()]).transform((value, context) => {
  if (value == null || !String(value).trim()) return null;
  try {
    return parseJwStoneUsdToCents(String(value));
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Invalid amount.",
    });
    return z.NEVER;
  }
});

const containerCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(4_000).nullable().optional(),
    imageUrl: z.string().trim().url().max(2_000).nullable().optional(),
    acceptingOffers: z.boolean().default(true),
    minimumOffer: optionalAmountSchema.optional().default(null),
  })
  .strict();

const containerUpdateSchema = containerCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required.",
  });

const stoneSettingSchema = z
  .object({ acceptingOffers: z.boolean(), minimumOffer: optionalAmountSchema })
  .strict();

async function mutateIdempotently<T extends Record<string, unknown>>(args: {
  req: Request;
  operator: Operator;
  operation: string;
  targetKind: string;
  targetRef: string;
  action: (client: import("pg").PoolClient) => Promise<{ status: number; body: T }>;
}): Promise<{ status: number; body: T; replayed: boolean }> {
  requireSameOriginJson(args.req);
  const key = requireIdempotencyKey(args.req);
  return withJwStoneTransaction(async (client) => {
    const scope: IdempotencyScope = {
      scopeValue: `operator:${args.operator.id}`,
      operation: args.operation,
      targetKind: args.targetKind,
      targetRef: args.targetRef,
      key,
      requestBody: args.req.body || {},
    };
    const cached = await readIdempotencyReceipt(client, scope);
    if (cached) return { status: cached.status, body: cached.body as T, replayed: true };
    const response = await args.action(client);
    await storeIdempotencyReceipt(client, scope, response);
    return { ...response, replayed: false };
  });
}

export function registerAdminJwStoneOfferRoutes(app: Express): void {
  const base = "/api/admin/jw-stone/offers";

  app.get(
    base,
    route(async (req, res) => {
      await requireOperator(req);
      const filter = offerFilterSchema.parse(req.query);
      const params: unknown[] = [];
      const where = ["v.state <> 'pending_verification'"];
      if (filter.targetType) {
        params.push(filter.targetType);
        where.push(`o.target_kind = $${params.length}`);
      }
      if (filter.status) {
        params.push(filter.status);
        where.push(`v.state = $${params.length}`);
      }
      params.push(queryLimit(req));
      const result = await pool.query(
        `
          with eligible as (
            select o2.id,
                   row_number() over (
                     partition by o2.container_id
                     order by v2.amount_cents desc, v2.submitted_at asc, o2.id asc
                   ) as priority,
                   count(*) over (partition by o2.container_id) as eligible_count
            from jw_stone_private_offers o2
            join jw_stone_private_offer_versions v2 on v2.id = o2.current_version_id
            join jw_stone_express_accounts a2 on a2.id = o2.account_id
            join jw_stone_containers c2 on c2.id = o2.container_id
            where o2.target_kind = 'container'
              and v2.state in ('submitted', 'under_review')
              and c2.status = 'published' and c2.accepting_offers is true
              and a2.status = 'active' and a2.closed_at is null
          )
          select o.id, o.target_kind, o.target_ref, o.stone_source_ref,
                 c.title as container_title,
                 v.state, v.amount_cents, v.submitted_at,
                 a.email_normalized, a.phone_normalized,
                 e.priority, e.eligible_count
          from jw_stone_private_offers o
          join jw_stone_private_offer_versions v on v.id = o.current_version_id
          left join jw_stone_express_accounts a on a.id = o.account_id
          left join jw_stone_containers c on c.id = o.container_id
          left join eligible e on e.id = o.id
          where ${where.join(" and ")}
          order by
            case when o.target_kind = 'container' and e.priority is not null then 0 else 1 end,
            case when o.target_kind = 'container' then v.amount_cents end desc,
            v.submitted_at asc nulls last, o.id asc
          limit $${params.length}
        `,
        params
      );
      const notificationMap = await notificationsForOffers(
        result.rows.map((row) => String(row.id))
      );
      const offers = result.rows.map((row) => {
        const stone = row.stone_source_ref
          ? getStoneBySourceRef(String(row.stone_source_ref))
          : null;
        const targetLabel =
          row.target_kind === "container"
            ? String(row.container_title || "JW Stone container")
            : stone?.label || "JW Stone selection";
        return {
          id: String(row.id),
          status: String(row.state),
          amountDisplay: amountDisplay(Number(row.amount_cents), true),
          submittedAt: row.submitted_at
            ? new Date(row.submitted_at).toISOString()
            : new Date(0).toISOString(),
          target: { id: String(row.target_ref), type: String(row.target_kind), label: targetLabel },
          maskedContact: {
            email: row.email_normalized ? maskJwStoneEmail(String(row.email_normalized)) : "***",
            phone: row.phone_normalized ? maskJwStonePhone(String(row.phone_normalized)) : "***",
          },
          containerPriority:
            row.priority == null
              ? null
              : { position: Number(row.priority), eligibleCount: Number(row.eligible_count) },
          notifications: notificationMap.get(String(row.id)) || [],
        };
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ offers });
    })
  );

  app.get(
    `${base}/access`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      res.setHeader("Cache-Control", "no-store");
      res.json({ authorized: true, operatorRole: operator.role });
    })
  );

  app.get(
    `${base}/:offerId/events`,
    route(async (req, res) => {
      await requireOperator(req);
      const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
      const result = await pool.query(
        `select e.id, e.event_type, e.actor_kind, e.actor_ref, e.note, e.created_at
         from jw_stone_private_offers o
         join jw_stone_private_offer_versions v on v.id = o.current_version_id
         join jw_stone_offer_events e on e.offer_id = o.id
         where o.id = $1 and v.state <> 'pending_verification'
         order by e.created_at asc, e.id asc`,
        [offerId]
      );
      if (!result.rows[0]) {
        throw Object.assign(new Error("Private offer not found."), { status: 404 });
      }
      res.setHeader("Cache-Control", "no-store");
      res.json({
        events: result.rows.map((row) => ({
          id: String(row.id),
          type: String(row.event_type),
          label: String(row.event_type).replace(/_/g, " "),
          summary: row.note ? String(row.note) : null,
          actorLabel:
            row.actor_kind === "operator"
              ? `Authorized operator ${String(row.actor_ref)}`
              : String(row.actor_kind),
          createdAt: new Date(row.created_at).toISOString(),
        })),
      });
    })
  );

  app.post(
    `${base}/:offerId/review/reveal-contact`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
      jwStoneOperatorDecisionSchema.parse(req.body || {});
      const mutation = await mutateIdempotently({
        req,
        operator,
        operation: "operator_reveal_contact",
        targetKind: "offer",
        targetRef: offerId,
        action: async (client) => {
          const result = await client.query(
            `
              select o.id, o.current_version_id, v.state, v.amount_cents, v.submitted_at,
                     a.email_normalized, a.phone_normalized
              from jw_stone_private_offers o
              join jw_stone_private_offer_versions v on v.id = o.current_version_id
              join jw_stone_express_accounts a on a.id = o.account_id
              where o.id = $1 and a.status = 'active' and a.closed_at is null
                and v.state <> 'pending_verification'
              for update of o
            `,
            [offerId]
          );
          const row = result.rows[0];
          if (!row) throw Object.assign(new Error("Private offer not found."), { status: 404 });
          let versionId = String(row.current_version_id);
          if (row.state === "submitted") {
            const version = await appendOfferVersion(client, {
              offerId,
              state: "under_review",
              amountCents: Number(row.amount_cents),
              submittedAt: new Date(row.submitted_at),
            });
            versionId = version.id;
          }
          await insertOfferEvent(client, {
            offerId,
            versionId,
            eventType: "contact_revealed_after_review_decision",
            actorKind: "operator",
            actorRef: operator.id,
          });
          return { status: 200, body: { ok: true, revealed: true } };
        },
      });
      const contact = await pool.query(
        `select a.email_normalized, a.phone_normalized
         from jw_stone_private_offers o
         join jw_stone_express_accounts a on a.id = o.account_id
         where o.id = $1 and a.status = 'active' and a.closed_at is null`,
        [offerId]
      );
      if (!contact.rows[0])
        throw Object.assign(new Error("Contact is no longer available."), { status: 404 });
      res.status(mutation.status).json({
        contact: {
          email: String(contact.rows[0].email_normalized),
          phone: String(contact.rows[0].phone_normalized),
        },
      });
    })
  );

  for (const decision of ["accept", "decline"] as const) {
    app.post(
      `${base}/:offerId/${decision}`,
      route(async (req, res) => {
        const operator = await requireOperator(req);
        const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
        const input = jwStoneOperatorDecisionSchema.parse(req.body || {});
        const mutation = await mutateIdempotently({
          req,
          operator,
          operation: decision === "accept" ? "operator_accept_offer" : "operator_decline_offer",
          targetKind: "offer",
          targetRef: offerId,
          action: async (client) => {
            const target = await client.query(
              `select target_kind, target_ref
               from jw_stone_private_offers
               where id = $1`,
              [offerId]
            );
            if (!target.rows[0]) {
              throw Object.assign(new Error("Private offer not found."), { status: 404 });
            }
            await lockJwStoneOfferTarget(
              client,
              String(target.rows[0].target_kind) as "stone" | "container",
              String(target.rows[0].target_ref)
            );
            const offer = await client.query(
              `
                select o.*, v.state, v.amount_cents, v.submitted_at,
                       a.email_normalized, a.display_name, a.status as account_status, a.closed_at
                from jw_stone_private_offers o
                join jw_stone_private_offer_versions v on v.id = o.current_version_id
                join jw_stone_express_accounts a on a.id = o.account_id
                where o.id = $1
                for update of o, a
              `,
              [offerId]
            );
            const row = offer.rows[0];
            if (!row) throw Object.assign(new Error("Private offer not found."), { status: 404 });
            if (!JW_STONE_ELIGIBLE_CONTAINER_OFFER_STATES.includes(row.state)) {
              throw Object.assign(
                new Error("Only submitted or under-review offers can receive this decision."),
                { status: 409 }
              );
            }
            if (row.account_status !== "active" || row.closed_at) {
              throw Object.assign(new Error("The Express Account is closed."), { status: 409 });
            }

            const resolved = await resolveOfferTarget(
              client,
              { kind: row.target_kind, ref: row.target_ref },
              { includeNonPublicContainer: true }
            );
            const otherExpired: any[] = [];
            if (decision === "accept" && row.target_kind === "container") {
              const container = await client.query(
                `select id, status, accepting_offers from jw_stone_containers where id = $1 for update`,
                [row.container_id]
              );
              if (
                container.rows[0]?.status !== "published" ||
                !container.rows[0]?.accepting_offers
              ) {
                throw Object.assign(new Error("This container is not accepting offers."), {
                  status: 409,
                });
              }
              const eligible = await client.query(
                `
                  select o.id, o.account_id, v.amount_cents, v.submitted_at,
                         a.email_normalized, a.display_name
                  from jw_stone_private_offers o
                  join jw_stone_private_offer_versions v on v.id = o.current_version_id
                  join jw_stone_express_accounts a on a.id = o.account_id
                  where o.container_id = $1 and v.state in ('submitted', 'under_review')
                    and a.status = 'active' and a.closed_at is null
                  order by v.amount_cents desc, v.submitted_at asc, o.id asc
                  for update of o, a
                `,
                [row.container_id]
              );
              if (!eligible.rows[0] || String(eligible.rows[0].id) !== offerId) {
                throw Object.assign(
                  new Error("A higher-priority eligible offer must be resolved first."),
                  { status: 409 }
                );
              }
              otherExpired.push(...eligible.rows.slice(1));
            }

            const nextState = decision === "accept" ? "accepted" : "declined";
            const version = await appendOfferVersion(client, {
              offerId,
              state: nextState,
              amountCents: Number(row.amount_cents),
              submittedAt: new Date(row.submitted_at),
            });
            await insertOfferEvent(client, {
              offerId,
              versionId: version.id,
              eventType: `offer_${nextState}`,
              actorKind: "operator",
              actorRef: operator.id,
              note: input.note,
            });
            if (decision === "accept" && row.target_kind === "container") {
              await client.query(
                `
                  update jw_stone_containers
                  set status = 'awarded', accepting_offers = false, awarded_offer_id = $2,
                      awarded_at = now(), closed_at = now(), updated_by_actor_id = $3, updated_at = now()
                  where id = $1
                `,
                [row.container_id, offerId, operator.id]
              );
              for (const other of otherExpired) {
                const expired = await appendOfferVersion(client, {
                  offerId: String(other.id),
                  state: "expired",
                  amountCents: Number(other.amount_cents),
                  submittedAt: new Date(other.submitted_at),
                });
                await insertOfferEvent(client, {
                  offerId: String(other.id),
                  versionId: expired.id,
                  eventType: "offer_expired_after_container_award",
                  actorKind: "system",
                });
                await queueOfferStatusEmail(client, {
                  accountId: String(other.account_id),
                  offerId: String(other.id),
                  customerEmail: String(other.email_normalized),
                  customerName: String(other.display_name),
                  targetLabel: resolved.publicTarget.label,
                  status: "expired",
                });
              }
            }
            await queueOfferStatusEmail(client, {
              accountId: String(row.account_id),
              offerId,
              customerEmail: String(row.email_normalized),
              customerName: String(row.display_name),
              targetLabel: resolved.publicTarget.label,
              status: nextState,
            });
            return { status: 200, body: { ok: true, offerId, status: nextState } };
          },
        });
        kickJwStoneOutbox();
        res.status(mutation.status).json(mutation.body);
      })
    );
  }

  app.post(
    `${base}/:offerId/outbox/:notificationId/retry`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      const offerId = jwStoneOfferRefSchema.parse(req.params.offerId);
      const notificationId = z.string().uuid().parse(req.params.notificationId);
      const mutation = await mutateIdempotently({
        req,
        operator,
        operation: "operator_retry_email",
        targetKind: "outbox",
        targetRef: notificationId,
        action: async (client) => {
          const retryId = await retryFailedJwStoneEmail(client, {
            outboxId: notificationId,
            offerId,
          });
          await insertOfferEvent(client, {
            offerId,
            eventType: "notification_retry_created",
            actorKind: "operator",
            actorRef: operator.id,
            metadata: { outboxRef: retryId },
          });
          return { status: 201, body: { ok: true, notificationId: retryId } };
        },
      });
      kickJwStoneOutbox();
      res.status(mutation.status).json(mutation.body);
    })
  );

  app.get(
    `${base}/containers`,
    route(async (req, res) => {
      await requireOperator(req);
      const result = await pool.query(
        `select id, title, description, status, accepting_offers, minimum_offer_cents, updated_at
         from jw_stone_containers order by created_at desc, id desc`
      );
      res.json({
        containers: result.rows.map((row) => ({
          id: String(row.id),
          title: String(row.title),
          description: String(row.description || ""),
          status: String(row.status),
          acceptingOffers: Boolean(row.accepting_offers),
          minimumOfferDisplay:
            row.minimum_offer_cents == null
              ? null
              : amountDisplay(Number(row.minimum_offer_cents), true),
          updatedAt: new Date(row.updated_at).toISOString(),
        })),
      });
    })
  );

  app.post(
    `${base}/containers`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      const input = containerCreateSchema.parse(req.body);
      const targetRef = `create:${input.title.toLowerCase()}`;
      const mutation = await mutateIdempotently({
        req,
        operator,
        operation: "operator_create_container",
        targetKind: "container",
        targetRef,
        action: async (client) => {
          const result = await client.query(
            `
              insert into jw_stone_containers
                (public_ref, source_ref, title, description, image_url, accepting_offers,
                 minimum_offer_cents, created_by_actor_id, updated_by_actor_id)
              values ($1, $2, $3, $4, $5, $6, $7, $8, $8)
              returning id
            `,
            [
              randomPublicRef("jwc_"),
              `manual:${randomUUID()}`,
              input.title,
              input.description || "",
              input.imageUrl || null,
              input.acceptingOffers,
              input.minimumOffer,
              operator.id,
            ]
          );
          return {
            status: 201,
            body: { ok: true, id: String(result.rows[0].id), status: "draft" },
          };
        },
      });
      res.status(mutation.status).json(mutation.body);
    })
  );

  app.patch(
    `${base}/containers/:containerId`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      const containerId = z.string().uuid().parse(req.params.containerId);
      const input = containerUpdateSchema.parse(req.body);
      const mutation = await mutateIdempotently({
        req,
        operator,
        operation: "operator_update_container",
        targetKind: "container",
        targetRef: containerId,
        action: async (client) => {
          const target = await client.query(
            `select public_ref from jw_stone_containers where id = $1`,
            [containerId]
          );
          if (!target.rows[0])
            throw Object.assign(new Error("Container not found."), { status: 404 });
          await lockJwStoneOfferTarget(client, "container", String(target.rows[0].public_ref));
          const locked = await client.query(
            `select * from jw_stone_containers where id = $1 for update`,
            [containerId]
          );
          const row = locked.rows[0];
          if (!row) throw Object.assign(new Error("Container not found."), { status: 404 });
          if (row.status === "awarded" || row.status === "closed") {
            throw Object.assign(new Error("A closed or awarded container cannot be edited."), {
              status: 409,
            });
          }
          await client.query(
            `
              update jw_stone_containers set
                title = $2, description = $3, image_url = $4,
                accepting_offers = $5, minimum_offer_cents = $6,
                updated_by_actor_id = $7, updated_at = now()
              where id = $1
            `,
            [
              containerId,
              input.title ?? row.title,
              input.description ?? row.description,
              input.imageUrl === undefined ? row.image_url : input.imageUrl,
              input.acceptingOffers ?? row.accepting_offers,
              input.minimumOffer === undefined ? row.minimum_offer_cents : input.minimumOffer,
              operator.id,
            ]
          );
          return { status: 200, body: { ok: true, id: containerId } };
        },
      });
      res.status(mutation.status).json(mutation.body);
    })
  );

  for (const action of ["publish", "close"] as const) {
    app.post(
      `${base}/containers/:containerId/${action}`,
      route(async (req, res) => {
        const operator = await requireOperator(req);
        const containerId = z.string().uuid().parse(req.params.containerId);
        const mutation = await mutateIdempotently({
          req,
          operator,
          operation:
            action === "publish" ? "operator_publish_container" : "operator_close_container",
          targetKind: "container",
          targetRef: containerId,
          action: async (client) => {
            const target = await client.query(
              `select public_ref from jw_stone_containers where id = $1`,
              [containerId]
            );
            if (!target.rows[0])
              throw Object.assign(new Error("Container not found."), { status: 404 });
            await lockJwStoneOfferTarget(client, "container", String(target.rows[0].public_ref));
            const result = await client.query(
              action === "publish"
                ? `update jw_stone_containers
                   set status = 'published', published_at = coalesce(published_at, now()),
                       updated_by_actor_id = $2, updated_at = now()
                   where id = $1 and status = 'draft'
                   returning id`
                : `update jw_stone_containers
                   set status = 'closed', accepting_offers = false, closed_at = now(),
                       updated_by_actor_id = $2, updated_at = now()
                   where id = $1 and status in ('draft', 'published')
                   returning id`,
              [containerId, operator.id]
            );
            if (!result.rows[0])
              throw Object.assign(
                new Error(`Container cannot be ${action}ed from its current state.`),
                { status: 409 }
              );
            return {
              status: 200,
              body: {
                ok: true,
                id: containerId,
                status: action === "publish" ? "published" : "closed",
              },
            };
          },
        });
        res.status(mutation.status).json(mutation.body);
      })
    );
  }

  app.get(
    `${base}/stone-settings`,
    route(async (req, res) => {
      await requireOperator(req);
      const result = await pool.query(`select * from jw_stone_offer_settings`);
      const settings = new Map(result.rows.map((row) => [String(row.stone_source_ref), row]));
      res.json({
        settings: JW_STONE_OFFER_INVENTORY.map((stone) => {
          const row = settings.get(stone.sourceRef);
          return {
            inventoryId: stone.sourceRef,
            publicLabel: stone.label,
            acceptingOffers: row ? Boolean(row.accepting_offers) : true,
            minimumOfferDisplay:
              row?.minimum_offer_cents == null
                ? null
                : amountDisplay(Number(row.minimum_offer_cents), true),
            updatedAt: row?.updated_at ? new Date(row.updated_at).toISOString() : null,
          };
        }),
      });
    })
  );

  app.patch(
    `${base}/stone-settings/:inventoryId`,
    route(async (req, res) => {
      const operator = await requireOperator(req);
      const inventoryId = z.string().trim().min(1).max(160).parse(req.params.inventoryId);
      const input = stoneSettingSchema.parse(req.body);
      const stone = getStoneBySourceRef(inventoryId);
      if (!stone) throw Object.assign(new Error("Inventory listing not found."), { status: 404 });
      const mutation = await mutateIdempotently({
        req,
        operator,
        operation: "operator_update_stone_settings",
        targetKind: "stone",
        targetRef: inventoryId,
        action: async (client) => {
          await lockJwStoneOfferTarget(client, "stone", stone.publicRef);
          await client.query(
            `
              insert into jw_stone_offer_settings
                (stone_source_ref, stone_public_ref, accepting_offers, minimum_offer_cents, updated_by_actor_id)
              values ($1, $2, $3, $4, $5)
              on conflict (stone_source_ref) do update set
                stone_public_ref = excluded.stone_public_ref,
                accepting_offers = excluded.accepting_offers,
                minimum_offer_cents = excluded.minimum_offer_cents,
                updated_by_actor_id = excluded.updated_by_actor_id,
                updated_at = now()
            `,
            [inventoryId, stone.publicRef, input.acceptingOffers, input.minimumOffer, operator.id]
          );
          return { status: 200, body: { ok: true, inventoryId } };
        },
      });
      res.status(mutation.status).json(mutation.body);
    })
  );
}
