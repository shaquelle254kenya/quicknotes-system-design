# QuickNotes API Design

This is the REST API the backend team should build for the real QuickNotes service (not JSONPlaceholder). The URL names the resource and the HTTP method says the action.

## Conventions

- **Base URL:** `https://api.quicknotes.example/v1`
- **Format:** all requests and responses use JSON (`Content-Type: application/json`).
- **Authentication:** every endpoint except `POST /auth/login` needs the header `Authorization: Bearer <token>`.
- **Ownership:** a user can only see and change their own notes.
- **Pagination:** list endpoints accept `?page=1&limit=20` (default limit 20, maximum 100).
- **Timestamps:** ISO 8601 in UTC, for example `2026-10-07T09:30:00Z`.

## Endpoints

| # | Method | Path | Description | Success status |
|---|--------|------|-------------|----------------|
| 1 | GET | `/notes` | List the logged-in user's notes (supports `?tag=`, `?page=`, `?limit=`) | 200 OK |
| 2 | GET | `/notes/{id}` | Get one note by its id | 200 OK |
| 3 | POST | `/notes` | Create a new note | 201 Created |
| 4 | PUT | `/notes/{id}` | Update the title and body of a note | 200 OK |
| 5 | DELETE | `/notes/{id}` | Delete a note | 204 No Content |
| 6 | GET | `/notes?tag=work` | List only the notes that have a given tag | 200 OK |
| 7 | GET | `/tags` | List all tags the user has created | 200 OK |
| 8 | POST | `/notes/{id}/tags` | Attach a tag to a note | 200 OK |
| 9 | POST | `/auth/login` | Log in and receive a token | 200 OK |

## Request and response examples

### Create a note: `POST /notes`

**Request body**

```json
{
  "title": "Buy milk",
  "body": "Two litres of fresh milk and a loaf of bread",
  "tags": ["personal", "shopping"]
}
```

**Response: 201 Created**

```json
{
  "id": 42,
  "title": "Buy milk",
  "body": "Two litres of fresh milk and a loaf of bread",
  "tags": ["personal", "shopping"],
  "userId": 7,
  "createdAt": "2026-10-07T09:30:00Z",
  "updatedAt": "2026-10-07T09:30:00Z"
}
```

The response also sends a `Location: /v1/notes/42` header so the client knows where the new note lives.

### List notes: `GET /notes?page=1&limit=2`

**Response: 200 OK**

```json
{
  "data": [
    {
      "id": 42,
      "title": "Buy milk",
      "body": "Two litres of fresh milk and a loaf of bread",
      "tags": ["personal", "shopping"],
      "createdAt": "2026-10-07T09:30:00Z"
    },
    {
      "id": 41,
      "title": "Email the report",
      "body": "Send the project report to Grace",
      "tags": ["work"],
      "createdAt": "2026-10-06T14:10:00Z"
    }
  ],
  "page": 1,
  "limit": 2,
  "total": 25
}
```

### Update a note: `PUT /notes/42`

**Request body**

```json
{
  "title": "Buy milk and eggs",
  "body": "Two litres of milk, a loaf of bread and a tray of eggs"
}
```

**Response: 200 OK** returns the full updated note, with a new `updatedAt` time.

### Delete a note: `DELETE /notes/42`

No request body. **Response: 204 No Content** with an empty body.

### Log in: `POST /auth/login`

**Request body**

```json
{
  "email": "amina@example.com",
  "password": "my-secret-password"
}
```

**Response: 200 OK**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

## Error codes

Every error uses the same JSON shape:

```json
{
  "error": {
    "code": "TITLE_REQUIRED",
    "message": "The title is required and must be 100 characters or fewer.",
    "status": 400
  }
}
```

| Status | Meaning | Example of when it happens |
|--------|---------|----------------------------|
| 400 Bad Request | The request is malformed or has invalid data | `POST /notes` with an empty title, a title over 100 characters, or broken JSON |
| 401 Unauthorized | The user is not logged in or the token is missing, invalid or expired | `GET /notes` with no `Authorization` header, or with an expired token |
| 403 Forbidden | The user is logged in but not allowed to do this | User 7 tries `DELETE /notes/99` and note 99 belongs to user 12 |
| 404 Not Found | The note or path does not exist | `GET /notes/9999` when no note has that id |
| 500 Internal Server Error | Something went wrong on the server, not the user's fault | The database is down while handling `POST /notes` |

### Example error bodies

**401 Unauthorized**

```json
{
  "error": {
    "code": "TOKEN_INVALID",
    "message": "Your session has expired. Please log in again.",
    "status": 401
  }
}
```

**404 Not Found**

```json
{
  "error": {
    "code": "NOTE_NOT_FOUND",
    "message": "No note exists with id 9999.",
    "status": 404
  }
}
```

## Design notes

- **Nouns, not verbs:** paths are `/notes` and `/tags`, never `/getNotes` or `/deleteNote`.
- **Right method for each action:** GET reads, POST creates, PUT updates, DELETE removes.
- **Right status for each result:** 201 for created, 204 for deleted with nothing to return, and the 4xx and 5xx codes above for failures.
- **Pagination:** the list never returns every note at once, which keeps responses small as users collect thousands of notes.
- **Security:** the server checks the token and note ownership on every request, so users can never read or change another user's notes.
