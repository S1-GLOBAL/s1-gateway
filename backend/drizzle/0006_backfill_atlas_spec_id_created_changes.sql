-- Every Spec ID saved before changes were recorded gets its "created" entry,
-- from who saved it and when (ADR 0022). Never edit this file once merged.
INSERT INTO "atlas_spec_id_changes" ("id", "spec_id", "kind", "changed_by", "changed_at", "code_before", "code_after", "name_before", "name_after")
SELECT gen_random_uuid(), "id", 'created', "saved_by", "saved_at", NULL, "code", NULL, "name"
FROM "atlas_spec_ids";
