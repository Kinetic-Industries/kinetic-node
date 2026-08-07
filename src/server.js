/**
 * server.js — Kinetic Node Entry Point
 *
 * Starts three listeners:
 *   KNET  (HTTP)   :8080 — plaintext page serving + nodeinfo
 *   KEST  (HTTPS)  :8443 — TLS page serving using the node's certificate
 *   Admin (HTTP)   :4040 — local-network admin dashboard + API
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('./config');
const cert = require('./cert');
const host = require('./host');
const registrar = require('./registrar');
const admin = require('./admin');

const VERSION = require('../package.json').version;

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** Shared handler for KNET and KEST page requests. */
function createPageHandler() {
  return (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // Node info endpoint
    if (req.method === 'GET' && pathname === '/_kin/nodeinfo') {
      const identity = cert.ensureIdentity();
      const cfg = config.get();
      return json(res, 200, {
        nodeId: identity.nodeId,
        name: cfg.name,
        description: cfg.description,
        version: VERSION,
        protocols: ['knet', 'kest'],
        registeredDomains: registrar.listDomains().map((d) => d.name),
        certPem: identity.certPem,
      });
    }

    // Page serving: /kin/<domain>/<path>
    const kinMatch = pathname.match(/^\/kin\/([^/]+)(\/.*)?$/);
    if (req.method === 'GET' && kinMatch) {
      const domain = decodeURIComponent(kinMatch[1]);
      const requestPath = kinMatch[2] || '/';
      const result = host.serveDomain(domain, requestPath);

      if (result === null) {
        return json(res, 404, { error: 'Unknown domain' });
      }

      if (result.status === 200) {
        res.writeHead(200, {
          'Content-Type': result.type,
          'X-Kin-Node': cert.ensureIdentity().nodeId,
          'X-Kin-Protocol': req.socket.encrypted ? 'kest' : 'knet',
        });
        return res.end(result.content);
      }

      return json(res, result.status, { error: result.error });
    }

    json(res, 404, { error: 'Not Found' });
  };
}

/** Bind the KNET (HTTP) listener. */
function createKnetServer() {
  return http.createServer(createPageHandler());
}

/** Bind the KEST (HTTPS) listener using the node's certificate. */
function createKestServer() {
  const identity = cert.ensureIdentity();
  const options = {
    key: identity.keyPem,
    cert: identity.certPem,
  };
  return https.createServer(options, createPageHandler());
}

/** Bind the admin dashboard + API listener. */
function createAdminServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');

    // Static dashboard files
    if (req.method === 'GET') {
      const adminUiDir = path.join(__dirname, '..', 'admin-ui');
      let filePath;
      if (url.pathname === '/' || url.pathname === '/index.html') {
        filePath = path.join(adminUiDir, 'index.html');
      } else {
        filePath = path.join(adminUiDir, url.pathname.replace(/^\/+/, ''));
      }

      // Prevent traversal out of admin-ui
      const resolved = path.resolve(filePath);
      if (resolved.startsWith(path.resolve(adminUiDir)) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
        const ext = path.extname(resolved).toLowerCase();
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.ico': 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
        return res.end(fs.readFileSync(resolved));
      }
    }

    // Admin API
    if (url.pathname.startsWith('/api/admin')) {
      return admin.handleAdmin(req, res);
    }

    json(res, 404, { error: 'Not Found' });
  });
}

function start() {
  const cfg = config.get();
  const identity = cert.ensureIdentity();

  // Seed a welcome domain on first boot
  if (registrar.listDomains().length === 0) {
    const welcomeDir = path.join(cfg.sitesDir, 'welcome.k');
    if (!fs.existsSync(path.join(welcomeDir, 'index.html'))) {
      registrar.registerDomain('welcome.k', 'The first domain on this node');
      fs.writeFileSync(
        path.join(welcomeDir, 'index.html'),
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Welcome to Kin</title>
  <style>
    body{font-family:Georgia,'Times New Roman',serif;background:#fbfaf7;color:#1f1e1c;margin:0;padding:0;display:flex;align-items:center;justify-content:center;min-height:100vh}
    .paper{max-width:34rem;padding:2rem;line-height:1.6}
    .label{font-family:ui-monospace,Consolas,monospace;font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:#6b675f}
    h1{font-size:2.25rem;font-weight:400;margin:.4rem 0 1rem}
    p{color:#3a3835}
    .kin{display:inline-block;margin-top:1.5rem;padding:.4rem .8rem;border:1px solid #e8e4dc;border-radius:2px;font-family:ui-monospace,Consolas,monospace;font-size:.8rem;color:#3b6de8;text-decoration:none}
  </style>
</head>
<body>
  <main class="paper">
    <div class="label">Served over KNET from your node</div>
    <h1>Welcome to Kin</h1>
    <p>This page is hosted on <strong>welcome.k</strong>, the first domain
       registered on your node. It lives in <code>sites/welcome.k/</code> on
       your own hardware — no third party in the path.</p>
    <p>Add files to this folder, register new domains in the dashboard, and
       share your Node ID so others can connect their Kinetic Browser.</p>
    <a class="kin" href="kin://welcome.k/">kin://welcome.k/</a>
  </main>
</body>
</html>`
      );
    }
  }

  const knet = createKnetServer();
  const kest = createKestServer();
  const adminServer = createAdminServer();

  knet.listen(cfg.knetPort, () => {
    console.log(`[kinetic-node] KNET  listening on :${cfg.knetPort}`);
  });
  kest.listen(cfg.kestPort, () => {
    console.log(`[kinetic-node] KEST  listening on :${cfg.kestPort}`);
  });
  adminServer.listen(cfg.adminPort, () => {
    console.log(`[kinetic-node] Admin dashboard on  http://localhost:${cfg.adminPort}`);
  });

  console.log('');
  console.log(`[kinetic-node] Node ID: ${identity.nodeId}`);
  console.log(`[kinetic-node] Name:    ${cfg.name}`);
  console.log('');

  // Graceful shutdown
  function shutdown() {
    console.log('\n[kinetic-node] Shutting down...');
    knet.close();
    kest.close();
    adminServer.close();
    process.exit(0);
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Only start when run directly (not when required by tests)
if (require.main === module) {
  start();
}

module.exports = { start, createKnetServer, createKestServer, createAdminServer };