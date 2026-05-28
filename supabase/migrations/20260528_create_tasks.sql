-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT        NOT NULL,
  description TEXT,
  deadline    TIMESTAMPTZ,
  priority    TEXT        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status      TEXT        NOT NULL DEFAULT 'Новая'  CHECK (status IN ('Новая', 'В работе', 'Готово')),
  created_by  TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task comments table (cascade delete when task is deleted)
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text       TEXT        NOT NULL,
  author     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
