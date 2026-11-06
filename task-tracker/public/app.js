const rows = document.getElementById('task-rows');
const count = document.getElementById('count');
const newTaskForm = document.getElementById('new-task-form');
const filterForm = document.getElementById('filter-form');
const formMessage = document.getElementById('form-message');
const prevPage = document.getElementById('prev-page');
const nextPage = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-btn');
const loginMessage = document.getElementById('login-message');
const appSection = document.getElementById('app');
const currentUser = document.getElementById('current-user');
const formCard = document.getElementById('task-form-card');
const formHeading = document.getElementById('task-form-heading');
const saveButton = document.getElementById('save-btn');
const cancelEditButton = document.getElementById('cancel-edit-btn');
const listMessage = document.getElementById('list-message');
const actionsHeader = document.getElementById('actions-header');
const deleteDialog = document.getElementById('delete-dialog');
const deleteText = document.getElementById('delete-text');
const tabs = document.getElementById('tabs');

const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
// In list order, most urgent first (AC2.4)
const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };
// The tab shown after login (AC2.8)
const DEFAULT_TAB = 'active';

// "Saved" and errors above the table go away after this long (Q-31, Q-48)
const LIST_MESSAGE_MS = 5000;

// Role of the logged-in user, from GET /auth/me or the login response
let currentRole = null;
// Tasks of the rows on screen, by id, for Edit and Delete
let shownTasks = new Map();
// The task open in the Edit form, as last opened or saved; null when the form creates a task
let editing = null;
// The task the delete dialog asks about
let pendingDelete = null;
let listMessageTimer;

// Page shown in the table and its total; only changed after a page loads successfully
let currentPage = 1;
let totalPages = 1;
// Only the latest request may update the table; a slower, older response is dropped
let latestRequest = 0;
// Tab and filters of the page shown in the table, set only once that page loads.
// Prev/Next page through these, not through whatever is typed in the filter form.
let appliedFilters = new URLSearchParams({ tab: DEFAULT_TAB });

// The filter form as typed, on the tab shown
function readFilterForm() {
  const params = new URLSearchParams({ tab: appliedFilters.get('tab') });
  const data = new FormData(filterForm);
  for (const name of ['search', 'status', 'priority']) {
    if (data.get(name)) params.set(name, data.get(name));
  }
  return params;
}

// Puts the filter form back to the filters of the page shown
function showFiltersInForm(filters) {
  for (const name of ['search', 'status', 'priority']) {
    filterForm.elements[name].value = filters.get(name) ?? '';
  }
}

// The selected tab, and no status filter on the Done tab (AC2.10)
function renderTabs() {
  const tab = appliedFilters.get('tab');
  for (const button of tabs.querySelectorAll('[data-tab]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  filterForm.elements.status.hidden = tab === 'done';
}

// A due date is a calendar day, saved as 00:00 UTC (Q-51): its first 10 characters are the day,
// shown as is to every user, with no conversion to the viewer's time zone (AC2.16)
function formatDueDate(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function isAdmin() {
  return currentRole === 'admin';
}

// One message per failure case (AC4.8). The server's own text is not shown.
function saveErrorMessage(status) {
  if (status === 404) return 'Task not found.';
  if (status === 403) return 'You do not have permission to change this task.';
  return 'Internal server error.';
}

// The line above the table; a new message restarts the 5 seconds
function showListMessage(text, kind) {
  clearTimeout(listMessageTimer);
  listMessage.textContent = text;
  listMessage.className = `message ${kind}`;
  listMessageTimer = setTimeout(() => {
    listMessage.textContent = '';
  }, LIST_MESSAGE_MS);
}

function clearListMessage() {
  clearTimeout(listMessageTimer);
  listMessage.textContent = '';
}

// After a change: reload only the list data, keeping tab, filters and page (Q-30).
// If that page is now past the end, go back to page 1 (AC4.10).
function reloadAfterChange() {
  return loadTasks(currentPage, appliedFilters, { pastEnd: 'first' });
}

// PATCH or DELETE one task. Resolves to { ok: true, task }, { ok: false, error } with the message
// to show, or null after a 401 (the login screen is already shown).
async function sendTaskChange(method, id, body) {
  let res;
  try {
    res = await apiFetch(`/tasks/${id}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
  if (!res) return null;

  const json = await res.json().catch(() => null);
  if (res.ok) return { ok: true, task: json };
  // 400: a value the form let through but the API rejects, e.g. a title over 200 characters
  if (res.status === 400 && json?.message) return { ok: false, error: [].concat(json.message).join(', ') };
  return { ok: false, error: saveErrorMessage(res.status) };
}

// A dropdown in a task's row that saves the field as soon as a value is picked (AC4.4)
function rowSelect(field, labels, value, extraClass = '') {
  const options = Object.entries(labels)
    .map(([option, label]) => `<option value="${option}"${option === value ? ' selected' : ''}>${label}</option>`)
    .join('');
  const label = field === 'status' ? 'Status' : 'Priority';
  return `<select class="row-select ${extraClass}" data-field="${field}" aria-label="${label}" data-old="${value}">${options}</select>`;
}

// AC2.6: text and background take the color of the picked priority
function paintPriority(select) {
  if (select.dataset.field !== 'priority') return;
  for (const value of Object.keys(PRIORITY_LABELS)) {
    select.classList.toggle(`priority-${value}`, select.value === value);
  }
}

function taskRow(task) {
  // Admin: status dropdown and Edit / Delete (AC4.4, AC4.6, AC4.7). User: status as text (AC4.2).
  // Priority: a dropdown for every logged-in user (AC2.3).
  const status = isAdmin() ? rowSelect('status', STATUS_LABELS, task.status) : STATUS_LABELS[task.status];
  const priority = rowSelect('priority', PRIORITY_LABELS, task.priority, `priority priority-${task.priority}`);
  const actions = isAdmin()
    ? `<td class="row-actions">
        <button type="button" class="secondary" data-action="edit">Edit</button>
        <button type="button" class="secondary" data-action="delete">Delete</button>
      </td>`
    : '';
  return `<tr data-id="${task.id}">
    <td>${escapeHtml(task.title)}</td>
    <td>${priority}</td>
    <td>${status}</td>
    <td>${formatDueDate(task.dueDate)}</td>
    ${actions}
  </tr>`;
}

function updatePager() {
  prevPage.disabled = currentPage <= 1;
  nextPage.disabled = currentPage >= totalPages;
}

// Every API call except the login goes through here. A 401 means the login is missing, invalid
// or expired: the login screen is shown and null is returned, so the caller stops (AC1.6, AC1.7).
async function apiFetch(url, options) {
  const res = await fetch(url, options);
  if (res.status !== 401) return res;

  const body = await res.json().catch(() => ({}));
  showLogin(body.error === 'SessionExpired' ? body.message : '');
  return null;
}

// Resolves to { body } on success, { error } with a message to show, or { unauthorized } after a 401
async function fetchTasks(params) {
  let res;
  try {
    res = await apiFetch(`/tasks?${params}`);
  } catch {
    return { error: 'Could not reach the server' };
  }
  if (!res) return { unauthorized: true };

  let body;
  try {
    body = await res.json();
  } catch {
    // The server answered, but not with JSON (e.g. an HTML 502 page from a proxy)
    return { error: `Unexpected response from the server (HTTP ${res.status})` };
  }
  if (!res.ok) {
    return { error: body?.message ? [].concat(body.message).join(', ') : `HTTP ${res.status}` };
  }
  return { body };
}

// The page size is left to the server; the response says which limit it used.
// filters are only stored in appliedFilters once their page loads, so a failed
// Search leaves Prev/Next paging through the filters still shown in the table.
// pastEnd: which page to show when the page asked for no longer exists ('last' or 'first').
// showInForm: once the page loads, put the filter form back to its filters (tab switch).
async function loadTasks(page, filters = appliedFilters, { pastEnd = 'last', showInForm = false } = {}) {
  const request = ++latestRequest;
  // Disabled until this page loads, so a double click can't skip past the last page
  prevPage.disabled = true;
  nextPage.disabled = true;

  const params = new URLSearchParams(filters);
  // No status filter on the Done tab; it stays applied for the other tabs (AC2.10, AC2.14)
  if (params.get('tab') === 'done') params.delete('status');
  params.set('page', page);

  const { body, error, unauthorized } = await fetchTasks(params);
  if (request !== latestRequest || unauthorized) return;

  if (error) {
    // Keep the table, page and filters that were already shown
    count.textContent = `Could not load tasks: ${error}`;
    count.className = 'message error';
    updatePager();
    return;
  }

  const { items, total, limit } = body;
  const lastPage = Math.max(1, Math.ceil(total / limit));
  // Past the end (e.g. tasks were deleted elsewhere): show the last page, or page 1 after a change
  if (page > lastPage) {
    return loadTasks(pastEnd === 'first' ? 1 : lastPage, filters, { showInForm });
  }

  appliedFilters = filters;
  renderTabs();
  if (showInForm) showFiltersInForm(filters);
  currentPage = page;
  totalPages = lastPage;
  const first = items.length ? (page - 1) * limit : 0;
  const last = (page - 1) * limit + items.length;
  count.textContent = `Showing ${first}–${last} of ${total} task(s)`;
  count.className = 'muted';
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  updatePager();

  shownTasks = new Map(items.map((t) => [t.id, t]));
  const columns = isAdmin() ? 5 : 4;
  rows.innerHTML = items.length
    ? items.map(taskRow).join('')
    : `<tr><td colspan="${columns}" class="muted">No tasks match these filters.</td></tr>`;
}

function fillTaskForm(task) {
  const fields = newTaskForm.elements;
  fields.title.value = task.title;
  fields.description.value = task.description ?? '';
  fields.dueDate.value = task.dueDate ? task.dueDate.slice(0, 10) : '';
  fields.status.value = task.status;
  fields.priority.value = task.priority;
}

// AC4.6: the new task form becomes "Edit task" for this task
function startEdit(task) {
  editing = task;
  fillTaskForm(task);
  formHeading.textContent = 'Edit task';
  saveButton.textContent = 'Save changes';
  cancelEditButton.hidden = false;
  formMessage.textContent = '';
  formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  newTaskForm.elements.title.focus({ preventScroll: true });
}

// Back to an empty "New task" form, status "To do" (AC4.9)
function stopEdit() {
  editing = null;
  newTaskForm.reset();
  formHeading.textContent = 'New task';
  saveButton.textContent = 'Save';
  cancelEditButton.hidden = true;
  formMessage.textContent = '';
}

// Only the fields that differ from the task as opened. The due date is sent as the picked day
// ("2026-03-20"); the API saves it as 00:00 UTC of that day (Q-51).
// A cleared description or due date is sent as null (AC4.6, Q-50).
function changedFields(task) {
  const fields = newTaskForm.elements;
  const body = {};
  if (fields.title.value !== task.title) body.title = fields.title.value;
  const description = fields.description.value === '' ? null : fields.description.value;
  if (description !== (task.description ?? null)) body.description = description;
  const dueDay = fields.dueDate.value;
  if (dueDay !== (task.dueDate ? task.dueDate.slice(0, 10) : '')) {
    body.dueDate = dueDay || null;
  }
  if (fields.status.value !== task.status) body.status = fields.status.value;
  if (fields.priority.value !== task.priority) body.priority = fields.priority.value;
  return body;
}

async function saveEdit() {
  const id = editing.id;
  saveButton.disabled = true;
  const result = await sendTaskChange('PATCH', id, changedFields(editing));
  saveButton.disabled = false;
  // null: login screen shown. Another task opened meanwhile: this answer is stale.
  if (!result || editing?.id !== id) return;

  if (result.ok) {
    // The form stays filled with the saved task (Q-32)
    editing = result.task;
    fillTaskForm(result.task);
    formMessage.textContent = 'Task saved';
    formMessage.className = 'message ok';
    reloadAfterChange();
  } else {
    // e.g. "Task not found." when it was deleted elsewhere; nothing is saved
    formMessage.textContent = result.error;
    formMessage.className = 'message error';
  }
}

cancelEditButton.addEventListener('click', stopEdit);

// AC4.4, AC4.5, AC4.8, AC2.3: a status or priority picked in a row is saved at once, with no
// Save button; the reload moves the task to its new place in the list
rows.addEventListener('change', async (event) => {
  const select = event.target.closest('select.row-select');
  if (!select) return;
  const id = select.closest('tr').dataset.id;
  paintPriority(select);
  select.disabled = true;
  const result = await sendTaskChange('PATCH', id, { [select.dataset.field]: select.value });
  if (!result) return;

  select.disabled = false;
  if (result.ok) {
    select.dataset.old = select.value;
    showListMessage('Saved', 'ok');
    reloadAfterChange();
  } else {
    select.value = select.dataset.old;
    paintPriority(select);
    showListMessage(result.error, 'error');
  }
});

rows.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const task = shownTasks.get(button.closest('tr').dataset.id);
  if (!task) return;
  if (button.dataset.action === 'edit') {
    startEdit(task);
  } else {
    // AC4.7: confirm first; the title is set as text, never as HTML
    pendingDelete = task;
    deleteText.textContent = `Delete task "${task.title}"? This cannot be undone.`;
    deleteDialog.returnValue = '';
    deleteDialog.showModal();
  }
});

// Closed by "Delete", "Cancel" or Escape; only "Delete" deletes
deleteDialog.addEventListener('close', async () => {
  const task = pendingDelete;
  pendingDelete = null;
  if (!task || deleteDialog.returnValue !== 'delete') return;

  const result = await sendTaskChange('DELETE', task.id);
  if (!result) return;
  if (result.ok) {
    if (editing?.id === task.id) stopEdit();
  } else {
    showListMessage(result.error, 'error');
  }
  reloadAfterChange();
});

newTaskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (editing) return saveEdit();
  const data = new FormData(newTaskForm);
  const body = {
    title: data.get('title'),
    status: data.get('status'),
    priority: data.get('priority'),
  };
  if (data.get('description')) body.description = data.get('description');
  // The picked day as is ("2026-03-20"); the API saves it as 00:00 UTC (AC2.16)
  if (data.get('dueDate')) body.dueDate = data.get('dueDate');

  const res = await apiFetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  // Login missing or expired: the login screen is shown and nothing was saved
  if (!res) return;

  if (res.ok) {
    formMessage.textContent = 'Task saved';
    formMessage.className = 'message ok';
    newTaskForm.reset();
    // Newest first inside its priority, so back to page 1 of the tab shown
    loadTasks(1);
  } else {
    // 400: the validation message; anything else: one message per case (AC4.8)
    const err = await res.json().catch(() => null);
    formMessage.textContent =
      res.status === 400 && err?.message ? [].concat(err.message).join(', ') : saveErrorMessage(res.status);
    formMessage.className = 'message error';
  }
});

filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadTasks(1, readFilterForm());
});

// AC2.13 to AC2.15: page 1 of the clicked tab, with the applied search, status and priority.
// A priority picked without "Search" resets to "All priorities" (Q-37); search text or a
// status changed without "Search" goes back to the applied one.
function switchTab(tab) {
  const filters = new URLSearchParams(appliedFilters);
  filters.set('tab', tab);
  if (filterForm.elements.priority.value !== (appliedFilters.get('priority') ?? '')) {
    filters.delete('priority');
  }
  loadTasks(1, filters, { showInForm: true });
}

tabs.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-tab]');
  if (button) switchTab(button.dataset.tab);
});

prevPage.addEventListener('click', () => loadTasks(currentPage - 1));

nextPage.addEventListener('click', () => loadTasks(currentPage + 1));

// Hides the tasks and shows the login screen with an optional message (the expired one, AC1.7).
// The list is reset, so after logging in again the user gets page 1 with no filters.
function showLogin(message) {
  latestRequest++; // drop any list response still on its way
  appliedFilters = new URLSearchParams({ tab: DEFAULT_TAB });
  renderTabs();
  currentPage = 1;
  totalPages = 1;
  currentRole = null;
  shownTasks = new Map();
  pendingDelete = null;
  if (deleteDialog.open) deleteDialog.close();
  filterForm.reset();
  stopEdit();
  clearListMessage();
  rows.innerHTML = '';
  count.textContent = '';
  pageInfo.textContent = '';
  currentUser.textContent = '';
  appSection.hidden = true;
  loginScreen.hidden = false;
  loginMessage.textContent = message;
}

// Shows the task list for the logged-in user, with "Alice (user)" in the header (AC1.3, AC1.13)
function showApp(user) {
  currentUser.textContent = `${user.name} (${user.role})`;
  // Only the admin creates, edits and deletes tasks (AC4.2)
  currentRole = user.role;
  formCard.hidden = !isAdmin();
  actionsHeader.hidden = !isAdmin();
  loginScreen.hidden = true;
  appSection.hidden = false;
  loadTasks(1, new URLSearchParams({ tab: DEFAULT_TAB }));
}

// AC1.5: an empty field gets a red border and "Required"
function markRequired(input, isEmpty) {
  input.classList.toggle('invalid', isEmpty);
  input.closest('.field').querySelector('.field-error').hidden = !isEmpty;
}

for (const input of [loginForm.elements.email, loginForm.elements.password]) {
  input.addEventListener('input', () => markRequired(input, false));
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { email, password } = loginForm.elements;
  markRequired(email, email.value === '');
  markRequired(password, password.value === '');
  if (email.value === '' || password.value === '') return;

  // Disabled while sending, so one click sends one request
  loginButton.disabled = true;
  loginMessage.textContent = '';
  try {
    // Not apiFetch: here a 401 means a wrong email or password, not a missing login.
    // The email is sent exactly as typed (Q-28).
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      loginForm.reset();
      showApp(body);
    } else {
      // 401: "Email or password is incorrect." (AC1.4)
      loginMessage.textContent = body.message ? [].concat(body.message).join(', ') : `HTTP ${res.status}`;
    }
  } catch {
    loginMessage.textContent = 'Could not reach the server';
  } finally {
    loginButton.disabled = false;
  }
});

// On open: a login from the last 24 hours goes straight to the list (AC1.18); otherwise the
// login screen, with the expired message if the login has run out (AC1.6, AC1.7)
async function start() {
  try {
    const res = await apiFetch('/auth/me');
    if (!res) return;
    if (res.ok) return showApp(await res.json());
    showLogin(`Could not check your login (HTTP ${res.status})`);
  } catch {
    showLogin('Could not reach the server');
  }
}

start();
