/**
 * host.test.js — Tests for the page hosting engine.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const host = require('./host');
const registrar = require('./registrar');
const config = require('./config');

before(() => {
  const sitesDir = config.get().sitesDir;
  const domainDir = path.join(sitesDir, 'welcome.k');
  fs.mkdirSync(domainDir, { recursive: true });
  fs.writeFileSync(path.join(domainDir, 'index.html'), '<h1>Welcome</h1>');
  fs.writeFileSync(path.join(domainDir, 'style.css'), 'body{}');
  registrar.registerDomain('welcome.k', 'Test');
});

after(() => {
  const sitesDir = config.get().sitesDir;
  fs.rmSync(path.join(sitesDir, 'welcome.k'), { recursive: true, force: true });
  const registry = path.join(config.get().dataDir, 'domains.json');
  if (fs.existsSync(registry)) fs.rmSync(registry, { force: true });
});

test('serveDomain serves index.html for a directory request', () => {
  const result = host.serveDomain('welcome.k', '/');
  assert.strictEqual(result.status, 200);
  assert.strictEqual(result.content.toString(), '<h1>Welcome</h1>');
  assert.match(result.type, /text\/html/);
});

test('serveDomain serves nested paths', () => {
  const result = host.serveDomain('welcome.k', '/style.css');
  assert.strictEqual(result.status, 200);
  assert.ok(result.content.length > 0);
  assert.match(result.type, /text\/css/);
});

test('serveDomain returns 404 for unknown files', () => {
  const result = host.serveDomain('welcome.k', '/nope.txt');
  assert.strictEqual(result.status, 404);
});

test('serveDomain returns null for unknown domains', () => {
  const result = host.serveDomain('unknown.k', '/');
  assert.strictEqual(result, null);
});

test('serveDomain rejects path traversal', () => {
  const result = host.serveDomain('welcome.k', '/../secret.txt');
  assert.strictEqual(result.status, 403);
  // Also up-encoded variants
  const result2 = host.serveDomain('welcome.k', '/%2e%2e/config.json');
  assert.ok(result2.status === 403 || result2.status === 404);
});