# QuickNotes Architecture

This document describes how QuickNotes can grow from a browser-only app to an online service used by 1 million people.

## Requirements

### Functional requirements
- Users can sign up and log in.
- Users can create, view, edit and delete their own notes.
- Users can add tags to notes and filter notes by tag.
- Users can load their notes from any device.
- Users only ever see their own notes.

### Non-functional requirements
- **Fast:** a notes list should load in under 300 ms for most requests.
- **Available:** the service should stay up even if one server fails (target 99.9%).
- **Scalable:** it should handle growth, and peak traffic of 5x the average.
- **Durable:** a saved note must never be lost.
- **Secure:** passwords are hashed, traffic uses HTTPS, and every request checks the token and note ownership.

## Assumptions

- 1,000,000 daily active users (DAU)
- Each user creates 1 note per day and views their notes list 50 times per day
- An average note takes about 1 KB (title, body and metadata)
- One day is about 100,000 seconds (rounded for easy estimates)
- Peak traffic is 5x the average

## Load estimate

| Measure | Calculation | Average | Peak (5x) |
|---------|-------------|---------|-----------|
| Writes per second | 1,000,000 notes per day / 100,000 | **10 per second** | 50 per second |
| Reads per second | 1,000,000 x 50 = 50,000,000 per day / 100,000 | **500 per second** | 2,500 per second |
| Storage per year | 1,000,000 x 1 KB = 1 GB per day x 365 | **about 365 GB** | n/a |

- The system is **read-heavy**: about 50 reads for every write.
- Storage is small: about 365 GB of notes per year. With indexes and backups, planning for about 1 TB per year is safe.
- Because reads dominate, the design focuses on caching and a read replica.

## Architecture diagram

    [ Client: browser / phone app ]
                  |
                  | 1. looks up the address
                  v
            +-----------+
            |    DNS    |
            +-----------+
                  |
                  v
            +-----------+   serves HTML, CSS, JS (static files)
            |    CDN    |
            +-----+-----+
                  | API requests (/notes, /tags)
                  v
         +-----------------+
         |  Load Balancer  |   (two instances, so it is not a single point of failure)
         +--------+--------+
                  |
        +---------+---------+
        v                   v
    +----------+       +----------+
    | App      |       | App      |    (stateless, more can be added)
    | Server 1 |       | Server 2 |
    +--+----+--+       +--+----+--+
       |    |             |    |
       |    +------+------+    +-----------------------+
       |           |                                   |
       v           v                                   v
    +---------+  +-----------------------+        +---------+
    |  Cache  |  |   Primary Database    |        |  Queue  |
    | (Redis) |  |   (all writes)        |        +----+----+
    +---------+  +----------+------------+             |
                            |                          v
                            | replicates          +----------+
                            v                     |  Worker  |
                  +--------------------+          | (emails, |
                  |   Read Replica     |          |  search  |
                  |   (feed reads)     |          |  index)  |
                  +--------------------+          +----------+

## Components (one sentence each)

- **Client:** the browser or app the user touches, which sends requests to the API and shows the results.
- **DNS:** turns the name `api.quicknotes.example` into the address of our load balancer, so users never need to know IP addresses.
- **CDN:** serves static files such as HTML, CSS and JavaScript from servers close to the user, so pages load fast and our servers carry less traffic.
- **Load balancer:** spreads requests across the app servers so no single server is overloaded and a failed server is skipped.
- **App servers:** run the QuickNotes logic (login, validation, notes, tags) and are stateless, so we can add more when traffic grows.
- **Cache (Redis):** keeps each user's recent notes list in fast memory, so repeated reads do not hit the database.
- **Primary database:** stores users, notes and tags reliably and handles every write.
- **Read replica:** a live copy of the primary that answers read queries, so the primary stays free for writes.
- **Queue:** holds background jobs so a request can finish right away instead of waiting for slow work.
- **Worker:** takes jobs from the queue and does the slow work, such as sending emails and updating the search index.

## Request flows

### GET /notes (read)

1. The client sends `GET /notes` with its token. DNS gives the address, and the request goes through the CDN to the load balancer.
2. The load balancer picks an app server.
3. The app server checks the token and finds the user id.
4. The app server looks in the cache for that user's notes list.
5. **Cache hit:** the app server returns the cached list right away (this is the common case).
6. **Cache miss:** the app server queries the **read replica** for the user's newest notes.
7. The app server stores the result in the cache with a short expiry (for example 60 seconds).
8. The app server returns `200 OK` with the notes as JSON.

### POST /notes (write)

1. The client sends `POST /notes` with the title and body, plus its token. The request reaches an app server through the load balancer.
2. The app server checks the token and validates the data (title required, at most 100 characters). If invalid, it returns `400`.
3. The app server saves the note in the **primary database**, with the user's id as the owner.
4. The app server deletes that user's cached notes list, so the next read gets fresh data.
5. The app server adds a background job to the **queue** (for example "update search index").
6. The app server immediately returns `201 Created` with the new note and a `Location` header.
7. A **worker** takes the job from the queue and does the slow work without making the user wait.
8. The primary database copies the new note to the read replica, usually within a fraction of a second.

## Trade-offs

- **Caching vs fresh data:** the cache makes reads fast and protects the database, but a cached list can be slightly out of date. We reduce this by deleting the cache entry on every write and using a short expiry, and we accept small delays in rare cases.
- **Read replica lag:** the replica copies data from the primary with a small delay, so a user might not see a brand-new note for a moment if their read hits the replica. We scale reads much further, but the data is only eventually consistent. Right after a write, the app can read from the primary for that user to avoid confusion.
- **Queue vs instant processing:** background jobs make requests fast and absorb spikes, but things like search indexing happen a few seconds later instead of instantly.
- **SQL vs NoSQL:** we chose SQL for relationships and guarantees. It is harder to scale writes across many machines than some NoSQL systems, but at 10 to 50 writes per second one primary is more than enough.
- **Cost vs reliability:** extra servers, replicas and instances cost money, but they remove single points of failure.

## Avoiding single points of failure

- **Load balancer:** run two instances (or use a managed, redundant one), so if one fails the other takes over.
- **App servers:** run two or more, and the load balancer stops sending traffic to one that fails. Because they are stateless, any server can handle any request.
- **Primary database:** keep the read replica ready to be promoted to primary if the primary fails, and take regular backups. Run them in different data centres (zones).
- **Cache:** if Redis goes down, the app falls back to the database, which is slower but still works. Run Redis with a standby copy.
- **Queue:** use a durable queue that stores jobs on disk, so jobs are not lost if a worker or server crashes. Run more than one worker.
- **DNS and CDN:** use providers that run on many servers around the world, so one failed location does not take the service down.
