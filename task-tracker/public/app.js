const rows = document.getElementById('task-rows');
const count = document.getElementById('count');
const newTaskForm = document.getElementById('new-task-form');
const filterForm = document.getElementById('filter-form');
const formMessage = document.getElementById('form-message');
const prevPage = document.getElementById('prev-page');
const nextPage = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');

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

// Resolves to { body } on success, or { error } with a message to show
async function fetchTasks(params) {
  let res;
  try {
    res = await fetch(`/tasks?${params}`);
  } catch {
    return { error: 'Could not reach the server' };
  }

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

  const { body, error } = await fetchTasks(params);
  if (request !== latestRequest) return;

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
  const first = items.length ? (page - 1) * limit + 1 : 0;
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

  const res = await fetch('/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

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

loadTasks(1);
