-- Retire in-app reminders when a plan, profile, or business cascades its task away.
-- The group index originates in 0135; keep it present for task-delete lookups.
CREATE INDEX IF NOT EXISTS idx_notifications_group ON notifications (group_id);

CREATE FUNCTION archive_presence_customer_task_notifications_on_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE notifications
  SET is_archived = true,
      archived_at = COALESCE(archived_at, now()),
      updated_at = now()
  WHERE user_id = OLD.owner_user_id
    AND group_id = 'presence-site-path:' || OLD.id
    AND is_archived IS DISTINCT FROM true;
  RETURN OLD;
END;
$$;

CREATE TRIGGER presence_customer_task_archive_notifications_on_delete
BEFORE DELETE ON business_presence_customer_tasks
FOR EACH ROW EXECUTE FUNCTION archive_presence_customer_task_notifications_on_delete();
