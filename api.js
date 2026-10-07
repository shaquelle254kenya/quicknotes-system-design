const API_URL = "https://jsonplaceholder.typicode.com/posts";

const loadBtn = document.querySelector("#load-btn");
const statusEl = document.querySelector("#status");
const notesList = document.querySelector("#notes-list");

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

    li.append(title, body);
    notesList.append(li);
  }
}

// GET: load 10 notes from the server
async function loadNotes() {
  setStatus("Loading notes...", "info");
  loadBtn.disabled = true;

  try {
    const result = await request(API_URL + "?_limit=10");
    notes = result.data;
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

loadBtn.addEventListener("click", loadNotes);

renderNotes();
