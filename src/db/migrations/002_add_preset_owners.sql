ALTER TABLE presets ADD COLUMN owner_id text;

-- A missing owner fails the NOT NULL constraint when legacy rows exist.
UPDATE presets
SET owner_id = NULLIF(current_setting('nora.migration_owner_id', true), '');

ALTER TABLE presets ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE presets ADD CONSTRAINT presets_owner_id_check
  CHECK (length(owner_id) > 0 AND owner_id = btrim(owner_id));

CREATE INDEX presets_owner_updated_id_idx
  ON presets (owner_id, updated_at DESC, id ASC);
