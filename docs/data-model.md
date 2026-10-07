# QuickNotes Data Model

This is the database design for the real QuickNotes service. It has four tables: `users`, `notes`, `tags` and `note_tags`.

## Entities

### users
One row per person with an account.

| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| name | TEXT | NOT NULL |
| email | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NOT NULL (never store plain passwords) |
| created_at | TEXT (timestamp) | NOT NULL |

### notes
One row per note.

| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users(id)`, NOT NULL |
| title | TEXT | NOT NULL, at most 100 characters |
| body | TEXT | Optional |
| created_at | TEXT (timestamp) | NOT NULL |
| updated_at | TEXT (timestamp) | NOT NULL |

### tags
One row per tag a user has created (for example "work" or "shopping").

| Column | Type | Key / rules |
|--------|------|-------------|
| id | INTEGER | Primary key |
| user_id | INTEGER | Foreign key to `users(id)`, NOT NULL |
| name | TEXT | NOT NULL |

A user cannot have two tags with the same name, so `(user_id, name)` is UNIQUE.

### note_tags
The join table. One row for each time a tag is attached to a note.

| Column | Type | Key / rules |
|--------|------|-------------|
| note_id | INTEGER | Foreign key to `notes(id)` |
| tag_id | INTEGER | Foreign key to `tags(id)` |

The primary key is the pair `(note_id, tag_id)`, so the same tag cannot be attached to the same note twice.

## Relationships

- **users to notes: one-to-many.** One user can write many notes, but each note belongs to exactly one user (`notes.user_id`).
- **users to tags: one-to-many.** One user can create many tags, and each tag belongs to one user (`tags.user_id`).
- **notes to tags: many-to-many.** A note can have many tags, and a tag can be on many notes.
- **Why `note_tags` is needed:** a relational database cannot store a many-to-many link inside either table. A list of tags inside a note row would break the one-value-per-cell rule, and repeating notes for each tag would duplicate data. The join table stores one row per note-tag pair, so both sides stay clean.

## CREATE TABLE statements

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE notes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  title      TEXT NOT NULL CHECK (length(title) <= 100),
  body       TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tags (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name    TEXT NOT NULL,
  UNIQUE (user_id, name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE note_tags (
  note_id INTEGER NOT NULL,
  tag_id  INTEGER NOT NULL,
  PRIMARY KEY (note_id, tag_id),
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id)  REFERENCES tags(id)  ON DELETE CASCADE
);
```

`ON DELETE CASCADE` means that when a note is deleted, its rows in `note_tags` are removed automatically, so no orphan links are left behind.

## Example queries

### 1. A user's newest notes (one page of 20)

```sql
SELECT id, title, body, created_at
FROM notes
WHERE user_id = 7
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;
```

This powers `GET /notes?page=1&limit=20`.

### 2. All notes with a given tag (uses JOIN)

```sql
SELECT n.id, n.title, n.created_at
FROM notes n
JOIN note_tags nt ON nt.note_id = n.id
JOIN tags t       ON t.id = nt.tag_id
WHERE n.user_id = 7
  AND t.name = 'work'
ORDER BY n.created_at DESC;
```

This powers `GET /notes?tag=work`.

### 3. How many notes each tag has (uses JOIN and GROUP BY)

```sql
SELECT t.name, COUNT(nt.note_id) AS note_count
FROM tags t
LEFT JOIN note_tags nt ON nt.tag_id = t.id
WHERE t.user_id = 7
GROUP BY t.id, t.name
ORDER BY note_count DESC;
```

Using LEFT JOIN means tags with no notes still appear, with a count of 0.

### 4. Delete one note, but only if it belongs to the user

```sql
DELETE FROM notes
WHERE id = 42 AND user_id = 7;
```

Checking `user_id` in the query stops one user from deleting another user's note.

## Indexes

```sql
CREATE INDEX idx_notes_user_created ON notes(user_id, created_at DESC);
CREATE INDEX idx_note_tags_tag_id ON note_tags(tag_id);
```

- **`notes(user_id, created_at DESC)`:** almost every request is "show this user's newest notes". With this index the database jumps straight to that user's notes, already in the right order, instead of scanning millions of rows. With 1 million users this is the most important index in the system.
- **`note_tags(tag_id)`:** the primary key already covers lookups by note, but "find all notes with this tag" starts from the tag. This index makes that direction fast.

The trade-off is that every index makes writes slightly slower and uses extra storage, so we only add indexes for queries we actually run.

## SQL or NoSQL?

I choose **SQL** (a relational database such as PostgreSQL or MySQL). QuickNotes data is structured and connected: users own notes, notes have tags, and tags are shared across notes. SQL handles these links with foreign keys and JOINs, and it enforces the rules for us: unique emails, no duplicate tags, no notes without an owner, and cascading deletes. Transactions also keep multi-step changes safe, such as creating a note and attaching its tags together. The load is modest for SQL: about 10 writes and 500 reads per second on average, which one primary database with a read replica and a cache can handle. NoSQL would be worth considering if we later needed huge scale or very flexible note formats, but today the structure and the guarantees of SQL are a better fit.
