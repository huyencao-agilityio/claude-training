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

const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

// Page shown in the table and its total; only changed after a page loads successfully
let currentPage = 1;
let totalPages = 1;
// Only the latest request may update the table; a slower, older response is dropped
let latestRequest = 0;
// Filters of the page shown in the table, set only once a Search submit loads.
// Prev/Next page through these, not through whatever is typed in the filter form.
let appliedFilters = new URLSearchParams();

function readFilterForm() {
  const params = new URLSearchParams();
  const data = new FormData(filterForm);
  if (data.get('search')) params.set('search', data.get('search'));
  if (data.get('status')) params.set('status', data.get('status'));
  return params;
}

// "2026-03-20" from <input type="date"> -> ISO timestamp for the API
function toIsoDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toISOString();
}

function formatDueDate(iso) {
  return iso ? iso.slice(0, 10) : '—';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
async function loadTasks(page, filters = appliedFilters) {
  const request = ++latestRequest;
  // Disabled until this page loads, so a double click can't skip past the last page
  prevPage.disabled = true;
  nextPage.disabled = true;

  const params = new URLSearchParams(filters);
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
  // Past the end (e.g. tasks were deleted elsewhere): show the last page instead
  if (page > lastPage) {
    return loadTasks(lastPage, filters);
  }

  appliedFilters = filters;
  currentPage = page;
  totalPages = lastPage;
  const first = items.length ? (page - 1) * limit : 0;
  const last = (page - 1) * limit + items.length;
  count.textContent = `Showing ${first}–${last} of ${total} task(s)`;
  count.className = 'muted';
  pageInfo.textContent = `Page ${page} of ${totalPages}`;
  updatePager();

  rows.innerHTML = items
    .map(
      (t) => `<tr>
        <td>${escapeHtml(t.title)}</td>
        <td>${STATUS_LABELS[t.status]}</td>
        <td>${formatDueDate(t.dueDate)}</td>
        <td>${t.isOverdue ? '<span class="badge">Overdue</span>' : ''}</td>
      </tr>`,
    )
    .join('');
}

newTaskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = new FormData(newTaskForm);
  const body = {
    title: data.get('title'),
    status: data.get('status'),
  };
  if (data.get('description')) body.description = data.get('description');
  if (data.get('dueDate')) body.dueDate = toIsoDate(data.get('dueDate'));

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
    // New tasks sort first, so jump back to page 1 to show it
    loadTasks(1);
  } else {
    const err = await res.json();
    formMessage.textContent = [].concat(err.message).join(', ');
    formMessage.className = 'message error';
  }
});

filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadTasks(1, readFilterForm());
});

prevPage.addEventListener('click', () => loadTasks(currentPage - 1));

nextPage.addEventListener('click', () => loadTasks(currentPage + 1));

// Hides the tasks and shows the login screen with an optional message (the expired one, AC1.7).
// The list is reset, so after logging in again the user gets page 1 with no filters.
function showLogin(message) {
  latestRequest++; // drop any list response still on its way
  appliedFilters = new URLSearchParams();
  currentPage = 1;
  totalPages = 1;
  filterForm.reset();
  newTaskForm.reset();
  formMessage.textContent = '';
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
  loginScreen.hidden = true;
  appSection.hidden = false;
  loadTasks(1, new URLSearchParams());
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
