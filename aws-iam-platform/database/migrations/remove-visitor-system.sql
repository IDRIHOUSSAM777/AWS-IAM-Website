-- Upgrade an existing database that was created before the visitor system was removed.
-- Run once as an admin, after stopping the website's API.
--
-- What it does:
--   1. renames quiz_assignments.visitor_id to session_id (the UUIDs stay valid, so answers
--      already saved are kept, now attached to an anonymous browser session);
--   2. drops the visitors table, which held the display names.
--
-- New installations do not need this file: use database/schema.sql instead.

ALTER TABLE aws_iam_platform.quiz_assignments
  CHANGE COLUMN visitor_id session_id CHAR(36) NOT NULL;

DROP TABLE IF EXISTS aws_iam_platform.visitors;

-- The website account keeps working: it only needs the quiz_assignments grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON aws_iam_platform.quiz_assignments TO 'aws'@'%';
FLUSH PRIVILEGES;
