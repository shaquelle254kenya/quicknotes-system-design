const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusEl = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");
const form = document.querySelector("#note-form");
const titleInput = document.querySelector("#title-input");
const bodyInput = document.querySelector("#body-input");
const submitBtn = document.querySelector("#submit-btn");

const MAX_TITLE = 100;

// Every note in this array has a unique "key" used to find it on the page.
// Notes loaded from the server also have local: false.
// Notes created by POST have local: true (see deleteNote for why).
let notes = [];

// Show a message in #status. type is "success", "error" or "info"
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = type || "";
}

// Reusable request helper: calls fetch, checks response.ok, throws on errors
async function request(url, options) {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error("Request failed with status " + response.status);
  }

  const data = await response.json();
  return { status: response.status, data: data };
}

// Draw the notes array on the page (textContent only, never innerHTML)
function renderNotes() {
  notesList.replaceChildren();

  if (notes.length === 0) {
    const empty = document.createElement("li");
    empty.classList.add("empty");
    empty.textContent = "No notes to show yet.";
    notesList.append(empty);
    return;
  }

  for (const note of notes) {
    const li = document.createElement("li");
    li.classList.add("note");

    const title = document.createElement("h3");
    title.textContent = note.title;

    const body = document.createElement("p");
    body.textContent = note.body;

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.textContent = "Delete";
    deleteBtn.addEventListener("click", function () {
      deleteNote(note, deleteBtn);
    });

    li.append(title, body, deleteBtn);
    notesList.append(li);
  }
}

// GET: load 10 notes from the server
async function loadNotes() {
  setStatus("Loading notes...", "info");
  loadBtn.disabled = true;

  try {
    const result = await request(API_URL + "?_limit=10");

    notes = result.data.map(function (note) {
      return { ...note, key: "server-" + note.id, local: false };
    });
    renderNotes();

    if (notes.length === 0) {
      setStatus("The server has no notes yet.", "info");
    } else {
      setStatus(`Loaded ${notes.length} notes from the server.`, "success");
    }
  } catch (error) {
    setStatus("Sorry, we could not load your notes. Please try again.", "error");
  } finally {
    loadBtn.disabled = false;
  }
}

// POST: create a new note
async function createNote(title, body) {
  setStatus("Saving your note...", "info");
  submitBtn.disabled = true;

  try {
    const result = await request(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title, body: body, userId: 1 }),
    });

    // JSONPlaceholder returns id 101 for EVERY new note, so we give each
    // created note its own unique key to tell them apart on the page.
    const note = {
      ...result.data,
      key: "local-" + Date.now(),
      local: true,
    };

    // Add the note to the top of the list
    notes.unshift(note);
    renderNotes();

    setStatus(
      `Note created (status ${result.status}, id ${result.data.id}).`,
      "success"
    );

    // Clear the form
    titleInput.value = "";
    bodyInput.value = "";
  } catch (error) {
    setStatus("Sorry, we could not save your note. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
  }
}

// DELETE: remove a note
//
// How we handle JSONPlaceholder's fake storage:
// JSONPlaceholder does not really save notes we create, so a note made with
// POST (id 101) does not exist on the server. Sending DELETE /posts/101 would
// return a 404 error even though the note is on our screen. So:
//   - notes loaded from the server (local: false) get a real DELETE request,
//     and are removed from the list only if the request succeeds;
//   - notes we created ourselves (local: true) are removed from the list
//     without a server call, because there is nothing on the server to delete.
// A real backend would delete both kinds with the same DELETE /notes/{id}.
async function deleteNote(note, button) {
  setStatus("Deleting note...", "info");
  button.disabled = true;

  try {
    let message = "Note removed.";

    if (!note.local) {
      const result = await request(API_URL + "/" + note.id, {
        method: "DELETE",
      });
      message = `Note deleted (status ${result.status}).`;
    }

    notes = notes.filter(function (item) {
      return item.key !== note.key;
    });
    renderNotes();
    setStatus(message, "success");
  } catch (error) {
    setStatus("Sorry, we could not delete that note. Please try again.", "error");
    button.disabled = false;
  }
}

// Validate the form, then create the note
form.addEventListener("submit", function (event) {
  event.preventDefault();

  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (title === "") {
    setStatus("Please enter a title.", "error");
    return;
  }

  if (title.length > MAX_TITLE) {
    setStatus("The title must be 100 characters or fewer.", "error");
    return;
  }

  createNote(title, body);
});

loadBtn.addEventListener("click", loadNotes);

renderNotes();
