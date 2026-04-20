-- Migration 0087: Drop the FK constraint from conversations.contractor_id
-- 
-- Background: The conversations table was originally designed for homeowner↔contractor
-- threads only, with contractor_id referencing contractors.id.
--
-- With universal provider support (businesses, workers, helpers), the respond endpoint
-- stores conversations using the provider's userId as the contractorId key when there
-- is no contractor profile. This violates the FK constraint at the DB level.
--
-- This migration drops the FK so that contractor_id can hold any provider identifier
-- (contractor profile ID or user ID) without a referential integrity violation.
-- Application-layer logic continues to enforce that the value is a valid provider key.

ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_contractor_id_contractors_id_fk";
