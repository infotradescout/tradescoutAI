import { Pool } from "@neondatabase/serverless";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL must be set to run manual DDL");
}

const statements = [
  "create extension if not exists \"pgcrypto\";",
  "do $$ begin create type county_entity_type as enum ('affiliate','employee','partner','territory_manager','vendor'); exception when duplicate_object then null; end $$;",
  "do $$ begin create type county_entity_status as enum ('active','inactive','pending'); exception when duplicate_object then null; end $$;",
  "create table if not exists county_entities ( id varchar primary key default gen_random_uuid(), county_fips varchar(5) not null references counties(fips), entity_type county_entity_type not null, entity_id varchar, label varchar(255), status county_entity_status not null default 'active', metadata jsonb, created_at timestamp default now(), updated_at timestamp default now() );",
  "create index if not exists county_entities_fips_idx on county_entities(county_fips);",
  "create index if not exists county_entities_type_idx on county_entities(entity_type);",
  "create table if not exists promotions ( id varchar primary key default gen_random_uuid(), title varchar(200) not null, short_description varchar(280) not null, image_attachment_id varchar, cta_label varchar(80), cta_url text, type varchar not null check (type in ('trade_deal','sponsor','affiliate','announcement')), exclusive boolean not null default false, status varchar not null default 'draft' check (status in ('draft','active','paused','ended')), county_fips text[] not null default '{}', user_type_tags text[] default '{}', trade_slugs text[] default '{}', placement_community_snapshot boolean not null default false, placement_community_feed boolean not null default false, placement_scout boolean not null default false, placement_marketplace boolean not null default false, starts_at timestamp, ends_at timestamp, created_at timestamp default now(), updated_at timestamp default now() );",
];

async function run() {
  const pool = new Pool({ connectionString });
  try {
    for (const sql of statements) {
      console.log("RUN", sql.slice(0, 80));
      await pool.query(sql);
    }
    console.log("DONE");
  } finally {
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
