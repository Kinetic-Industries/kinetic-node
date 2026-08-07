/**
 * host.js — Page Hosting Engine
 *
 * Serves static content (HTML, CSS, JS, assets) from the directories
 * designated by the domain registrar over KNET (HTTP) and KEST (TLS).
 */

const fs = require('fs');
const path = require('path');
const registrar = require('./registrar');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};

/** Resolve a request path within a domain directory, preventing traversal. */
function resolveFilePath(requestPath) {
  // Normalize and reject traversal attempts
  const normalized = path.normalize(requestPath).replace(/\\/g, '/');
  if (normalized.includes('..')) return null;
  return normalized.replace(/^\/+/, '');
}

/** Serve the content of a domain path. Returns {status, content, type} or null. */
function serveDomain(domain, requestPath) {
  const root = registrar.resolveDomain(domain);
  if (!root) return null;

  let rel = resolveFilePath(requestPath || '/');
  if (rel === null) return { status: 403, error: 'Forbidden' };

  // Default to index.html for directory requests
  let filePath = path.join(root, rel);
  let finalPath = filePath;

  let stat;
  try {
    stat = fs.statSync(finalPath);
  } catch {
    return { status: 404, error: 'Not Found' };
  }

  if (stat.isDirectory()) {
    finalPath = path.join(filePath, 'index.html');
    try {
      stat = fs.statSync(finalPath);
    } catch {
      return { status: 404, error: 'Not Found' };
    }
  }

  if (!stat.isFile()) {
    return { status: 404, error: 'Not Found' };
  }

  const ext = path.extname(finalPath).toLowerCase();
  const type = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(finalPath);
  return { status: 200, content, type };
}

module.exports = { serveDomain, MIME_TYPES, resolveFilePath };