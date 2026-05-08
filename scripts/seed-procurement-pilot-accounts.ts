import { hashPassword } from "../server/auth";
import { pool } from "../server/db";
import { ensureProcurementEngineTables } from "../server/db/ensureProcurementEngineTables";
import { CURRENT_PROFILE_VERSION } from "../shared/profile";

type PilotAccount = {
  envPrefix: string;
  label: string;
  role: string;
  activeRole: string;
  defaultFirstName: string;
  defaultLastName: string;
};

const accounts: PilotAccount[] = [
  {
    envPrefix: "PILOT_TS_CUSTOMER",
    label: "TradeScout customer",
    role: "homeowner",
    activeRole: "homeowner",
    defaultFirstName: "Pilot",
    defaultLastName: "Customer",
  },
  {
    envPrefix: "PILOT_TS_ADMIN",
    label: "TradeScout admin",
    role: "ops_admin",
    activeRole: "ops_admin",
    defaultFirstName: "Pilot",
    defaultLastName: "Admin",
  },
  {
    envPrefix: "PILOT_GRUNT_OPERATOR",
    label: "Limited Grunt operator",
    role: "homeowner",
    activeRole: "homeowner",
    defaultFirstName: "Grunt",
    defaultLastName: "Operator",
  },
];

function requiredEnv(name: string): string {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return String(process.env[name] || fallback).trim();
}

async function upsertUser(account: PilotAccount) {
  const email = requiredEnv(`${account.envPrefix}_EMAIL`).toLowerCase();
  const plaintext = requiredEnv(`${account.envPrefix}_PASSWORD`);
  if (plaintext.length < 12) {
    throw new Error(`${account.envPrefix}_PASSWORD must be at least 12 characters for pilot use.`);
  }

  const password = await hashPassword(plaintext);
  const firstName = optionalEnv(`${account.envPrefix}_FIRST_NAME`, account.defaultFirstName);
  const lastName = optionalEnv(`${account.envPrefix}_LAST_NAME`, account.defaultLastName);

  const result = await pool.query(
    `
      insert into users (
        email,
        password_hash,
        first_name,
        last_name,
        role,
        active_role,
        roles,
        onboarding_completed,
        profile_version,
        email_verified,
        address_verified,
        state_code,
        county_fips,
        location_committed,
        created_at,
        updated_at
      )
      values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::text[],
        true,
        $8,
        true,
        true,
        'TX',
        '48453',
        true,
        now(),
        now()
      )
      on conflict (email) do update set
        password_hash = excluded.password_hash,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        role = excluded.role,
        active_role = excluded.active_role,
        roles = excluded.roles,
        onboarding_completed = true,
        profile_version = excluded.profile_version,
        email_verified = true,
        address_verified = true,
        state_code = excluded.state_code,
        county_fips = excluded.county_fips,
        location_committed = true,
        updated_at = now()
      returning id, email
    `,
    [
      email,
      password,
      firstName,
      lastName,
      account.role,
      account.activeRole,
      [account.role],
      CURRENT_PROFILE_VERSION,
    ]
  );

  const user = result.rows[0] as { id: string; email: string };
  console.log(`[procurement-pilot] ${account.label}: ${user.email}`);
  return user;
}

async function grantGruntOperator(userId: string) {
  const workspace = await pool.query(
    `select id from procurement_workspaces where slug = 'grunt' limit 1`
  );
  const workspaceId = String(workspace.rows[0]?.id || "");
  if (!workspaceId) throw new Error("Grunt procurement workspace was not found.");

  await pool.query(
    `
      insert into procurement_workspace_members (workspace_id, user_id, role, status)
      values ($1, $2, 'operator', 'active')
      on conflict (workspace_id, user_id) do update set
        role = 'operator',
        status = 'active',
        updated_at = now()
    `,
    [workspaceId, userId]
  );

  await pool.query(
    `
      insert into tradepartner_user_entitlements (
        partner_slug,
        user_id,
        access_scope,
        access_level,
        status,
        notes
      )
      values ('grunt', $1, 'procurement', 'operator', 'active', 'Procurement pilot operator access')
      on conflict (partner_slug, user_id, access_scope) do update set
        access_level = 'operator',
        status = 'active',
        notes = 'Procurement pilot operator access',
        updated_at = now()
    `,
    [userId]
  );
}

async function main() {
  await ensureProcurementEngineTables();

  const created = new Map<string, { id: string; email: string }>();
  for (const account of accounts) {
    created.set(account.envPrefix, await upsertUser(account));
  }

  const gruntOperator = created.get("PILOT_GRUNT_OPERATOR");
  if (!gruntOperator) throw new Error("Limited Grunt operator account was not created.");
  await grantGruntOperator(gruntOperator.id);

  console.log("[procurement-pilot] Ready for internal pilot walkthrough.");
  console.log("[procurement-pilot] Passwords were read from env vars and were not printed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[procurement-pilot] Failed to seed pilot accounts:", error);
    process.exit(1);
  });
