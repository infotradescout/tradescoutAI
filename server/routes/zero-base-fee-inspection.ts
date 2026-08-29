import { Router, type Request, type Response } from "express";
import PDFDocument from "pdfkit";
import { createHmac } from "crypto";
import { arucoMarkerMatrix } from "aruco-marker";
import { requireAuth } from "../auth";
import { pool } from "../db/pg";
import { ensureZeroBaseFeeTables } from "../db/ensureZeroBaseFeeTables";
import { emailService } from "../services/emailService";
import { PRIMARY_SUPPORT_EMAIL } from "@shared/supportInbox";
import {
  TRADESCOUT_TRANSACTION_FEE_CENTS,
  TRADESCOUT_TRANSACTION_FEE_LABEL,
  TRADESCOUT_TRANSACTION_FEE_MODEL,
} from "@shared/platformRevenue";
import { getStripeClient } from "../services/stripeClient";

const router = Router();

const PRICE_CENTS = 1000;
const MARKER_SIZE_IN = 2;
const TOKEN_TTL_SEC = 60 * 60 * 4;
const ACCESS_RECOVERY_WINDOW_HOURS = 24;
const ZERO_BASE_FEE_PRIVILEGED_ROLES = new Set([
  "super_admin",
  "admin",
  "ops_admin",
  "support_agent",
  "staff",
  "moderator",
]);

function clean(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  const out = value.trim();
  if (!out) return "";
  return out.length > maxLen ? out.slice(0, maxLen) : out;
}

function toOrigin(req: Request): string {
  const host = clean(req.get("host"), 300);
  const proto = clean(req.get("x-forwarded-proto"), 20) || req.protocol || "https";
  return host ? `${proto}://${host}` : "https://www.thetradescout.com";
}

function normalizeRoleValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const raw = value.trim().toLowerCase();
  if (raw === "owner" || raw === "head_admin") return "super_admin";
  return raw;
}

function hasPrivilegedZeroBaseFeeAccess(user: any): boolean {
  if (!user) return false;
  if (user.isAdmin === true) return true;

  const roleCandidates: string[] = [];
  roleCandidates.push(normalizeRoleValue(user.role));
  roleCandidates.push(normalizeRoleValue(user.activeRole));
  if (Array.isArray(user.roles)) {
    for (const role of user.roles) {
      roleCandidates.push(normalizeRoleValue(role));
    }
  }

  return roleCandidates.some((role) => ZERO_BASE_FEE_PRIVILEGED_ROLES.has(role));
}

function b64urlEncode(raw: string): string {
  return Buffer.from(raw, "utf8").toString("base64url");
}

function b64urlDecode(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

function sign(payload: Record<string, unknown>): string {
  const secret =
    process.env.ZERO_BASE_FEE_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    "tradescout-zero-base-fee";
  const encodedPayload = b64urlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken(token: string): Record<string, unknown> | null {
  const secret =
    process.env.ZERO_BASE_FEE_TOKEN_SECRET ||
    process.env.SESSION_SECRET ||
    "tradescout-zero-base-fee";
  const [payloadPart, signaturePart] = String(token || "").split(".");
  if (!payloadPart || !signaturePart) return null;
  const expected = createHmac("sha256", secret).update(payloadPart).digest("base64url");
  if (expected !== signaturePart) return null;
  try {
    const payload = JSON.parse(b64urlDecode(payloadPart)) as Record<string, unknown>;
    const exp = Number(payload.exp || 0);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function renderMarkerPdf(markerId: number, sizeInches: number): Promise<Buffer> {
  const doc = new PDFDocument({ size: "LETTER", margin: 36 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const matrix = arucoMarkerMatrix(markerId) as number[][];
  const markerPt = sizeInches * 72;
  const cellPt = markerPt / matrix.length;
  const x = (doc.page.width - markerPt) / 2;
  const y = 120;

  doc.fontSize(18).text("TradeScout Calibration Marker (ArUco)", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(11).text(`Aruco Marker ID: ${markerId}`, { align: "center" });
  doc.text(`Print at 100% scale. Outer square must be exactly ${sizeInches.toFixed(2)} inches.`, {
    align: "center",
  });

  doc.save();
  doc.rect(x, y, markerPt, markerPt).fill("#ffffff");
  for (let r = 0; r < matrix.length; r += 1) {
    for (let c = 0; c < matrix[r].length; c += 1) {
      if (matrix[r][c] === 1) {
        doc.rect(x + c * cellPt, y + r * cellPt, cellPt, cellPt).fill("#000000");
      }
    }
  }
  doc.restore();

  doc.moveDown(17);
  doc.fontSize(10).text("Quick workflow:", { underline: true });
  doc.text("1) Place marker in photo plane with the object you need measured.");
  doc.text("2) Capture image in good light with marker fully visible.");
  doc.text("3) Use marker corners for calibration or outlet screw spacing fallback.");
  doc.end();
  return finished;
}

router.get("/marker.pdf", async (req: Request, res: Response) => {
  const markerIdRaw = Number.parseInt(clean(req.query.id, 10) || "42", 10);
  const sizeRaw = Number.parseFloat(clean(req.query.sizeIn, 10) || String(MARKER_SIZE_IN));
  const markerId = Number.isFinite(markerIdRaw) ? Math.min(49, Math.max(0, markerIdRaw)) : 42;
  const sizeInches = Number.isFinite(sizeRaw) ? Math.min(6, Math.max(1, sizeRaw)) : MARKER_SIZE_IN;

  try {
    const pdf = await renderMarkerPdf(markerId, sizeInches);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tradescout-aruco-${markerId}-${sizeInches.toFixed(2)}in.pdf"`
    );
    res.send(pdf);
  } catch (error) {
    console.error("[zero-base-fee] marker pdf failed", error);
    res.status(500).json({ error: "Could not generate marker PDF." });
  }
});

router.post("/checkout-session", requireAuth, async (req: Request, res: Response) => {
  if (hasPrivilegedZeroBaseFeeAccess(req.user as any)) {
    return res.status(200).json({
      ok: true,
      bypass: true,
      message: "Admin/staff access enabled; checkout not required.",
    });
  }
  const stripe = getStripeClient();
  if (!stripe) return res.status(400).json({ error: "Stripe is not configured." });
  const userId = clean((req.user as any)?.id, 80);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const origin = toOrigin(req);
  const successUrl =
    clean(req.body?.successUrl, 500) ||
    `${origin}/zero-base-fee/camera?paid=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = clean(req.body?.cancelUrl, 500) || `${origin}/zero-base-fee/camera?canceled=1`;

  try {
    await ensureZeroBaseFeeTables();
    const totalWithTradeScoutFeeCents = PRICE_CENTS + TRADESCOUT_TRANSACTION_FEE_CENTS;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      currency: "usd",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: PRICE_CENTS,
            product_data: {
              name: "TradeScout Zero-Base-Fee Measurement",
              description:
                "Single inspection unlock with timestamp/GPS-stamped measurement report.",
            },
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            unit_amount: TRADESCOUT_TRANSACTION_FEE_CENTS,
            product_data: {
              name: TRADESCOUT_TRANSACTION_FEE_LABEL,
              description: "Flat TradeScout transaction fee on platform purchases.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: "zero_base_fee_measurement",
        userId,
        platformFeeCents: String(TRADESCOUT_TRANSACTION_FEE_CENTS),
        platformFeeModel: TRADESCOUT_TRANSACTION_FEE_MODEL,
      },
    });

    await pool.query(
      `
        INSERT INTO zero_base_fee_sessions (checkout_session_id, user_id, amount_cents, status)
        VALUES ($1,$2,$3,'created')
        ON CONFLICT (checkout_session_id) DO UPDATE
        SET user_id = EXCLUDED.user_id,
            amount_cents = EXCLUDED.amount_cents,
            status = 'created',
            updated_at = NOW()
      `,
      [session.id, userId, totalWithTradeScoutFeeCents]
    );

    res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("[zero-base-fee] checkout-session failed", error);
    res.status(500).json({ error: "Could not create checkout session." });
  }
});

router.get("/verify-checkout", requireAuth, async (req: Request, res: Response) => {
  const stripe = getStripeClient();
  if (!stripe) return res.status(400).json({ error: "Stripe is not configured." });
  const userId = clean((req.user as any)?.id, 80);
  const sessionId = clean(req.query.sessionId, 200);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!sessionId) return res.status(400).json({ error: "Missing sessionId." });

  try {
    await ensureZeroBaseFeeTables();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    const owner = clean(session.metadata?.userId, 80);
    if (!paid || owner !== userId) {
      return res.status(403).json({ error: "Payment not verified for this account." });
    }

    await pool.query(
      `
      UPDATE zero_base_fee_sessions
      SET status = 'paid',
          paid_at = COALESCE(paid_at, NOW()),
          last_verified_at = NOW(),
          updated_at = NOW()
      WHERE checkout_session_id = $1
      `,
      [sessionId]
    );

    const now = Math.floor(Date.now() / 1000);
    const token = sign({
      typ: "zero_base_fee_access",
      userId,
      sessionId,
      exp: now + TOKEN_TTL_SEC,
    });

    res.json({
      ok: true,
      paid: true,
      accessToken: token,
      expiresAt: now + TOKEN_TTL_SEC,
    });
  } catch (error) {
    console.error("[zero-base-fee] verify-checkout failed", error);
    res.status(500).json({ error: "Could not verify payment." });
  }
});

const verifyAccessHandler = async (req: Request, res: Response) => {
  const userId = clean((req.user as any)?.id, 80);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const now = Math.floor(Date.now() / 1000);
  const sessionId = clean(req.query.sessionId, 200);

  try {
    await ensureZeroBaseFeeTables();

    if (hasPrivilegedZeroBaseFeeAccess(req.user as any)) {
      const privilegedSessionId = sessionId || "privileged_bypass";
      const token = sign({
        typ: "zero_base_fee_access",
        userId,
        sessionId: privilegedSessionId,
        privilegedBypass: true,
        exp: now + TOKEN_TTL_SEC,
      });

      return res.json({
        ok: true,
        paid: true,
        bypass: true,
        reason: "admin_staff_bypass",
        sessionId: privilegedSessionId,
        accessToken: token,
        expiresAt: now + TOKEN_TTL_SEC,
      });
    }

    let resolvedSessionId = sessionId;
    if (!resolvedSessionId) {
      const lookup = await pool.query(
        `
          SELECT checkout_session_id
          FROM zero_base_fee_sessions
          WHERE user_id = $1
            AND status = 'paid'
            AND COALESCE(paid_at, created_at) >= NOW() - ($2::text || ' hours')::interval
          ORDER BY COALESCE(paid_at, created_at) DESC
          LIMIT 1
        `,
        [userId, String(ACCESS_RECOVERY_WINDOW_HOURS)]
      );
      resolvedSessionId = clean(lookup.rows[0]?.checkout_session_id, 200);
    }

    if (!resolvedSessionId) {
      return res.status(200).json({
        ok: true,
        paid: false,
        recoverable: true,
        reason: "no_recent_paid_access",
      });
    }

    const owned = await pool.query(
      `
        SELECT checkout_session_id
        FROM zero_base_fee_sessions
        WHERE checkout_session_id = $1
          AND user_id = $2
          AND status = 'paid'
        LIMIT 1
      `,
      [resolvedSessionId, userId]
    );

    if (!owned.rows.length) {
      return res.status(200).json({
        ok: true,
        paid: false,
        recoverable: false,
        reason: "session_not_paid_for_account",
      });
    }

    await pool.query(
      `
      UPDATE zero_base_fee_sessions
      SET last_verified_at = NOW(),
          updated_at = NOW()
      WHERE checkout_session_id = $1
      `,
      [resolvedSessionId]
    );

    const token = sign({
      typ: "zero_base_fee_access",
      userId,
      sessionId: resolvedSessionId,
      exp: now + TOKEN_TTL_SEC,
    });

    res.json({
      ok: true,
      paid: true,
      sessionId: resolvedSessionId,
      accessToken: token,
      expiresAt: now + TOKEN_TTL_SEC,
    });
  } catch (error) {
    console.error("[zero-base-fee] verify-access failed", error);
    res.status(500).json({ error: "Could not recover paid access." });
  }
};

router.get("/verify-access", requireAuth, verifyAccessHandler);
// Backward-compatible alias for stale cached client bundles.
router.get("/verify-accesses", requireAuth, verifyAccessHandler);

router.post("/report", requireAuth, async (req: Request, res: Response) => {
  const userId = clean((req.user as any)?.id, 80);
  const userEmail = clean((req.user as any)?.email, 200).toLowerCase();
  const token = clean(req.body?.accessToken, 5000);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const payload = verifyToken(token);
  if (!payload || clean(payload.userId, 80) !== userId) {
    return res.status(403).json({ error: "Invalid access token." });
  }

  const sessionId = clean(payload.sessionId, 200);
  const referenceMode = clean(req.body?.referenceMode, 40) || "unknown";
  const ppiRaw = Number(req.body?.pixelsPerInch);
  const measuredPixelsRaw = Number(req.body?.measuredPixels);
  const measuredInchesRaw = Number(req.body?.measuredInches);
  const measuredInches = Number.isFinite(measuredInchesRaw) ? measuredInchesRaw : null;
  const ppi = Number.isFinite(ppiRaw) ? ppiRaw : null;
  const measuredPixels = Number.isFinite(measuredPixelsRaw) ? measuredPixelsRaw : null;

  try {
    await ensureZeroBaseFeeTables();
    await pool.query(
      `
      INSERT INTO zero_base_fee_reports
      (user_id, checkout_session_id, reference_mode, pixels_per_inch, measured_inches, measured_pixels, payload_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
      `,
      [
        userId,
        sessionId,
        referenceMode,
        ppi,
        measuredInches,
        measuredPixels,
        JSON.stringify(req.body || {}),
      ]
    );

    if (emailService.isConfigured() && userEmail) {
      const summary = [
        `Reference mode: ${referenceMode}`,
        ppi !== null ? `Pixels per inch: ${ppi.toFixed(3)}` : "Pixels per inch: unavailable",
        measuredInches !== null
          ? `Measured distance: ${measuredInches.toFixed(3)} in`
          : "Measured distance: unavailable",
      ].join("\n");

      void emailService.sendEmail({
        to: [userEmail, PRIMARY_SUPPORT_EMAIL],
        subject: "TradeScout Zero-Base-Fee report saved",
        text: [
          "Your measurement report was saved.",
          "",
          summary,
          "",
          "Open the camera page to download the PDF report if needed.",
        ].join("\n"),
        html: `<p>Your measurement report was saved.</p><pre>${summary}</pre><p>Open the camera page to download the PDF report if needed.</p>`,
        purpose: "tradepartner_rsvp_admin",
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("[zero-base-fee] report save failed", error);
    res.status(500).json({ error: "Could not save report." });
  }
});

export default router;
