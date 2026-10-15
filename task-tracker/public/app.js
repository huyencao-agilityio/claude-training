const rows = document.getElementById('task-rows');
const count = document.getElementById('count');
const newTaskForm = document.getElementById('new-task-form');
const filterForm = document.getElementById('filter-form');
const formMessage = document.getElementById('form-message');

const STATUS_LABELS = { todo: 'To do', in_progress: 'In progress', done: 'Done' };

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

async function loadTasks() {
  const params = new URLSearchParams();
  const data = new FormData(filterForm);
  if (data.get('search')) params.set('search', data.get('search'));
  if (data.get('status')) params.set('status', data.get('status'));

  const res = await fetch(`/tasks?${params}`);
  const tasks = await res.json();

  count.textContent = `${tasks.length} task(s)`;
  rows.innerHTML = tasks
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
    loadTasks();
  } else {
    const err = await res.json();
    formMessage.textContent = [].concat(err.message).join(', ');
    formMessage.className = 'message error';
  }
});

filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  loadTasks();
});

loadTasks();
