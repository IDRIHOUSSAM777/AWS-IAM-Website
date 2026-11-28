-- AWS Student Builder: anonymous quiz progress. Own database, separate from Caddy.
-- Run this whole script once, connected as an ADMIN account, in DBeaver (SQL Editor, Alt+X).
-- It is safe to run twice.
--
-- There are no visitor accounts, no names and no cookies. Each browser keeps a random
-- quiz session id in localStorage; only the nine question assignments and answers are stored.

CREATE DATABASE IF NOT EXISTS aws_iam_platform
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Quiz: nine questions per anonymous session, one row per question.
CREATE TABLE IF NOT EXISTS aws_iam_platform.quiz_assignments (
  session_id   CHAR(36)     NOT NULL,                              -- random id kept by the browser (no personal data)
  slot         TINYINT      NOT NULL,                              -- question number, 1 to 9
  question_key VARCHAR(40)  NOT NULL,                              -- which question of the bank this session received
  option_order VARCHAR(20)  NOT NULL,                              -- the order in which the answers are shown, for example 2,0,1
  chosen_index TINYINT      NULL,                                  -- the answer chosen (empty until the question is submitted)
  is_correct   TINYINT(1)   NULL,                                  -- 1 = point earned, 0 = no point
  answered_at  TIMESTAMP    NULL DEFAULT NULL,
  PRIMARY KEY (session_id, slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The website account needs access to the quiz table.
GRANT SELECT, INSERT, UPDATE, DELETE ON aws_iam_platform.quiz_assignments TO 'aws'@'%';
FLUSH PRIVILEGES;

-- Upgrading an existing installation that still has a visitors table?
-- Run database/migrations/remove-visitor-system.sql once as an admin.

-- To create the website account from scratch, remove the leading "-- " and choose your own
-- password (no spaces, quotes or # character):
-- CREATE USER IF NOT EXISTS 'aws'@'%' IDENTIFIED BY 'choose-your-password-here';
-- GRANT SELECT, INSERT, UPDATE, DELETE ON aws_iam_platform.quiz_assignments TO 'aws'@'%';
-- FLUSH PRIVILEGES;
-- Check with:  SHOW GRANTS FOR 'aws'@'%';
