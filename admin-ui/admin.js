/* admin.js — Kinetic Node admin dashboard logic */

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const flashEl = document.getElementById('flash');

let token = localStorage.getItem('kin_admin_token') || '';

/* ── Utilities ─────────────────────────────────────────── */

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, { ...options, headers });
  let body = {};
  try { body = await res.json(); } catch {}

  if (res.status === 401 && !path.endsWith('/login') && !path.endsWith('/session')) {
    showLogin();
    throw new Error('Session expired');
  }
  if (!res.ok) throw new Error(body.error || 'Request failed');
  return body;
}

function flash(message, isError = false) {
  flashEl.innerHTML = '';
  const box = document.createElement('div');
  box.className = isError ? 'error-box' : 'success-box';
  box.textContent = message;
  flashEl.appendChild(box);
  setTimeout(() => box.remove(), 4000);
}

/* ── Login / logout ────────────────────────────────────── */

function showLogin() {
  token = '';
  localStorage.removeItem('kin_admin_token');
  loginView.classList.remove('hidden');
  dashboardView.classList.add('hidden');
}

async function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
  await Promise.all([loadNode(), loadDomains()]);
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('login-error');
  errorBox.classList.add('hidden');

  try {
    const username = document.getElementById('login-user').value.trim();
    const password = document.getElementById('login-pass').value;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const body = await res.json();
    if (!res.ok) {
      errorBox.textContent = body.error || 'Login failed';
      errorBox.classList.remove('hidden');
      return;
    }
    token = body.token;
    localStorage.setItem('kin_admin_token', token);
    await showDashboard();
  } catch {
    errorBox.textContent = 'Login failed';
    errorBox.classList.remove('hidden');
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
  showLogin();
});

/* ── Node info ─────────────────────────────────────────── */

async function loadNode() {
  const node = await api('/api/admin/node');
  document.getElementById('node-name').textContent = node.name;
  document.getElementById('node-id').textContent = node.nodeId;
  document.getElementById('cert-nodeid').textContent = node.nodeId;
  document.getElementById('cert-fingerprint').textContent = node.certFingerprint;
  document.getElementById('cert-pem').textContent = node.certPem;
  document.getElementById('settings-name').value = node.name;
  document.getElementById('settings-desc').value = node.description || '';
}

/* ── Domains ───────────────────────────────────────────── */

async function loadDomains() {
  const { domains } = await api('/api/admin/domains');
  const empty = document.getElementById('domains-empty');
  const table = document.getElementById('domains-table');
  const tbody = document.getElementById('domains-body');

  if (domains.length === 0) {
    empty.classList.remove('hidden');
    table.classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');
  table.classList.remove('hidden');
  tbody.innerHTML = '';

  for (const d of domains) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    const code = document.createElement('code');
    code.textContent = d.name;
    tdName.appendChild(code);

    const tdDir = document.createElement('td');
    tdDir.className = 'mono dim';
    tdDir.textContent = d.directory;

    const tdDate = document.createElement('td');
    tdDate.className = 'dim';
    tdDate.textContent = new Date(d.registeredAt).toLocaleDateString();

    const tdDesc = document.createElement('td');
    tdDesc.textContent = d.description || '—';

    const tdActions = document.createElement('td');
    const del = document.createElement('button');
    del.className = 'danger';
    del.textContent = 'Remove';
    del.addEventListener('click', async () => {
      if (!confirm(`Unregister ${d.name}? Content files will be kept.`)) return;
      try {
        await api(`/api/admin/domains/${encodeURIComponent(d.name)}`, { method: 'DELETE' });
        flash(`Unregistered ${d.name}`);
        await loadDomains();
      } catch (err) {
        flash(err.message, true);
      }
    });
    tdActions.appendChild(del);

    tr.append(tdName, tdDir, tdDate, tdDesc, tdActions);
    tbody.appendChild(tr);
  }
}

document.getElementById('domain-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('domain-name').value.trim();
  const desc = document.getElementById('domain-desc').value.trim();

  try {
    const entry = await api('/api/admin/domains', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc }),
    });
    flash(`Registered ${entry.name}`);
    document.getElementById('domain-name').value = '';
    document.getElementById('domain-desc').value = '';
    await loadDomains();
  } catch (err) {
    flash(err.message, true);
  }
});

/* ── Settings ──────────────────────────────────────────── */

document.getElementById('settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        name: document.getElementById('settings-name').value.trim(),
        description: document.getElementById('settings-desc').value.trim(),
      }),
    });
    flash('Settings saved');
    await loadNode();
  } catch (err) {
    flash(err.message, true);
  }
});

/* ── Credentials ───────────────────────────────────────── */

document.getElementById('credentials-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/api/admin/credentials', {
      method: 'PATCH',
      body: JSON.stringify({
        currentPassword: document.getElementById('cred-current').value,
        newUsername: document.getElementById('cred-user').value.trim(),
        newPassword: document.getElementById('cred-pass').value,
      }),
    });
    flash('Credentials updated');
    document.getElementById('cred-current').value = '';
    document.getElementById('cred-user').value = '';
    document.getElementById('cred-pass').value = '';
  } catch (err) {
    flash(err.message, true);
  }
});

/* ── Boot ──────────────────────────────────────────────── */

(async function boot() {
  try {
    const res = await fetch('/api/admin/session', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const session = await res.json();
    if (session.authenticated) {
      await showDashboard();
    } else {
      showLogin();
    }
  } catch {
    showLogin();
  }
})();