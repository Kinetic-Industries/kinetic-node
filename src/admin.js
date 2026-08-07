/**
 * admin.js — Admin API (Local Network)
 *
 * Serves the administrative API for domain management, node info,
 * settings, and credential changes. Bound to the local network and
 * guarded by session-token authentication.
 */

const crypto = require('crypto');
const config = require('./config');
const registrar = require('./registrar');
const cert = require('./cert');

const sessions = new Map(); // token -> { username, createdAt }

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token || !sessions.has(token)) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return false;
  }
  req.sessionToken = token;
  return true;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Parse JSON body from a request. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function handleAdmin(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const path = url.pathname;

  // ── Login (no auth) ────────────────────────────────────────────
  if (req.method === 'POST' && path === '/api/admin/login') {
    return readBody(req).then(
      async (body) => {
        const { username, password } = body;
        if (config.verifyAdmin(username, password)) {
          const token = crypto.randomBytes(32).toString('hex');
          sessions.set(token, { username, createdAt: new Date().toISOString() });
          json(res, 200, { token, username });
        } else {
          json(res, 401, { error: 'Invalid credentials' });
        }
      },
      (err) => json(res, 400, { error: err.message })
    );
  }

  // ── Logout ─────────────────────────────────────────────────────
  if (req.method === 'POST' && path === '/api/admin/logout') {
    if (!requireAuth(req, res)) return;
    sessions.delete(req.sessionToken);
    return json(res, 200, { ok: true });
  }

  // ── Session ────────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/api/admin/session') {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (token && sessions.has(token)) {
      return json(res, 200, { authenticated: true, username: sessions.get(token).username });
    }
    return json(res, 200, { authenticated: false });
  }

  // ── Everything below requires auth ─────────────────────────────
  if (!requireAuth(req, res)) return;

  const identity = cert.ensureIdentity();

  // ── Node info ──────────────────────────────────────────────────
  if (req.method === 'GET' && path === '/api/admin/node') {
    return json(res, 200, {
      nodeId: identity.nodeId,
      name: config.get().name,
      description: config.get().description,
      certPem: identity.certPem,
      certFingerprint: cert.certFingerprint(identity.certPem),
    });
  }

  // ── Domain management ──────────────────────────────────────────
  if (req.method === 'GET' && path === '/api/admin/domains') {
    return json(res, 200, { domains: registrar.listDomains() });
  }

  if (req.method === 'POST' && path === '/api/admin/domains') {
    return readBody(req).then(
      (body) => {
        try {
          const entry = registrar.registerDomain(body.name, body.description);
          json(res, 201, entry);
        } catch (err) {
          json(res, err.status || 500, { error: err.message });
        }
      },
      (err) => json(res, 400, { error: err.message })
    );
  }

  const domainMatch = path.match(/^\/api\/admin\/domains\/(.+)$/);
  if (req.method === 'DELETE' && domainMatch) {
    try {
      const result = registrar.unregisterDomain(decodeURIComponent(domainMatch[1]));
      json(res, 200, result);
    } catch (err) {
      json(res, err.status || 500, { error: err.message });
    }
    return;
  }

  // ── Settings ───────────────────────────────────────────────────
  if (req.method === 'PATCH' && path === '/api/admin/settings') {
    return readBody(req).then(
      (body) => {
        const cfg = config.get();
        if (typeof body.name === 'string' && body.name.trim()) {
          cfg.name = body.name.trim();
        }
        if (typeof body.description === 'string') {
          cfg.description = body.description;
        }
        config.save();
        json(res, 200, { name: cfg.name, description: cfg.description });
      },
      (err) => json(res, 400, { error: err.message })
    );
  }

  // ── Credentials ────────────────────────────────────────────────
  if (req.method === 'PATCH' && path === '/api/admin/credentials') {
    return readBody(req).then(
      (body) => {
        const { currentPassword, newUsername, newPassword } = body;
        if (!config.verifyAdmin(config.get().admin.user, currentPassword)) {
          return json(res, 401, { error: 'Incorrect current password' });
        }
        if (!newPassword || newPassword.length < 8) {
          return json(res, 400, { error: 'New password must be at least 8 characters' });
        }
        config.setAdminCredentials(newUsername || config.get().admin.user, newPassword);
        json(res, 200, { ok: true });
      },
      (err) => json(res, 400, { error: err.message })
    );
  }

  // ── Unknown admin route ────────────────────────────────────────
  json(res, 404, { error: 'Not Found' });
}

module.exports = { handleAdmin };