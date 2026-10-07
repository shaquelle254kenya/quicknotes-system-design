# QuickNotes System Design

QuickNotes is moving from a browser-only app to a real online service for 1 million people. This project has two halves. First, a small API client built with HTML, CSS and JavaScript proves the front end can talk to an API, using the JSONPlaceholder practice API for GET, POST and DELETE requests. Second, three design documents describe the real backend: the API, the database and the overall architecture.

## How to run the API client

1. Clone the repository: `git clone https://github.com/shaquelle254kenya/quicknotes-system-design.git`
2. Open the `quicknotes-system-design` folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server**, or just double-click `index.html` to open it in your browser. No installation is needed.
4. Click **Load notes** to fetch 10 notes (GET), fill in the form to create a note (POST), and use the **Delete** button on a note to remove it (DELETE).

The client needs an internet connection because it calls `https://jsonplaceholder.typicode.com/posts`. JSONPlaceholder does not really save new notes, so notes you create are removed from the screen without a server call, while notes loaded from the server get a real DELETE request.

## Documents

- [API design](docs/api-design.md): the REST endpoints, request and response examples, and error codes for the real QuickNotes API
- [Data model](docs/data-model.md): the users, notes, tags and note_tags tables, SQL, indexes, and the SQL vs NoSQL decision
- [Architecture](docs/architecture.md): requirements, load estimates for 1 million users, the architecture diagram, request flows, trade-offs and single points of failure

## What I learned

- How to talk to an API with `fetch`, `async` / `await` and `try` / `catch` / `finally`, and why we check `response.ok` because `fetch` does not throw on 404 or 500 errors.
- How to show loading, success, error and empty states, and disable buttons during a request so users cannot send the same request twice.
- How to design a RESTful API with nouns in the paths, the right HTTP methods and the right status codes (201, 204, 400, 401, 403, 404 and 500).
- How to model many-to-many data with a join table, and why an index on `notes(user_id, created_at)` matters at scale.
- How to estimate load (10 writes and 500 reads per second) and use it to decide on a CDN, load balancer, cache, read replica and queue, while avoiding single points of failure.
