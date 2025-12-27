ALTER TABLE users
  ADD COLUMN IF NOT EXISTS state_code varchar(2),
  ADD COLUMN IF NOT EXISTS county_fips varchar(5),
  ADD COLUMN IF NOT EXISTS county_id varchar,
  ADD COLUMN IF NOT EXISTS county_name varchar,
  ADD COLUMN IF NOT EXISTS latitude numeric(9, 6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9, 6);
