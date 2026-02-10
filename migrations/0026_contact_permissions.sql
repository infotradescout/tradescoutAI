CREATE TYPE contact_permission_status AS ENUM ('pending', 'accepted', 'declined', 'blocked');

CREATE TABLE contact_permissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  target_user_id varchar NOT NULL REFERENCES users(id) ON DELETE cascade,
  status contact_permission_status DEFAULT 'pending',
  last_request_type varchar,
  last_request_preview text,
  last_request_notification_id varchar,
  responded_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX uidx_contact_permissions_pair
  ON contact_permissions (requester_id, target_user_id);

CREATE INDEX idx_contact_permissions_target
  ON contact_permissions (target_user_id);

CREATE INDEX idx_contact_permissions_requester
  ON contact_permissions (requester_id);
