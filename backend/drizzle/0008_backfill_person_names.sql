-- Every account gets its first and last name from full_name (ADR 0023):
-- everything before the first space is the first name, the rest is the last
-- name, and a one-word name has an empty last name. A part over 40 characters
-- is cut to 40. Never edit this file once merged.
UPDATE accounts SET
  first_name = left(split_part(full_name, ' ', 1), 40),
  last_name = CASE
    WHEN strpos(full_name, ' ') = 0 THEN ''
    ELSE btrim(left(btrim(substr(full_name, strpos(full_name, ' ') + 1)), 40))
  END;
