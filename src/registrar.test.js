/**
 * registrar.test.js — Tests for the domain registrar (KNS).
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const registrar = require('./registrar');
const config = require('./config');

before(() => {
  // Ensure runtime directories exist
  fs.mkdirSync(config.get().dataDir, { recursive: true });
  fs.mkdirSync(config.get().sitesDir, { recursive: true });
});

after(() => {
  // Clean up test artifacts
  const sitesDir = config.get().sitesDir;
  for (const d of ['hello.k', 'test-kin.k', 'playground.dev.k']) {
    const p = path.join(sitesDir, d);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  }
  const registry = path.join(config.get().dataDir, 'domains.json');
  if (fs.existsSync(registry)) fs.rmSync(registry, { force: true });
});

test('validateDomain accepts .k TLD', () => {
  assert.strictEqual(registrar.validateDomain('hello.k'), null);
});

test('validateDomain accepts country-code TLD .be.k', () => {
  assert.strictEqual(registrar.validateDomain('ghent.be.k'), null);
});

test('validateDomain rejects unsupported TLD', () => {
  assert.match(registrar.validateDomain('hello.com'), /TLD not supported/);
});

test('validateDomain rejects reserved names', () => {
  assert.match(registrar.validateDomain('kin.k'), /reserved name/);
  assert.match(registrar.validateDomain('www.k'), /reserved name/);
});

test('validateDomain rejects invalid characters', () => {
  assert.match(registrar.validateDomain('hello_world.k'), /characters/);
});

test('registerDomain creates the content directory', () => {
  const entry = registrar.registerDomain('hello.k', 'Test site');
  assert.strictEqual(entry.name, 'hello.k');
  const dir = path.join(config.get().sitesDir, 'hello.k');
  assert.ok(fs.existsSync(dir));
});

test('registerDomain rejects duplicates', () => {
  registrar.registerDomain('test-kin.k', 'First');
  assert.throws(() => registrar.registerDomain('test-kin.k', 'Second'), /already registered/);
  registrar.unregisterDomain('test-kin.k');
});

test('resolveDomain maps a name to its directory', () => {
  registrar.registerDomain('playground.dev.k', 'Dev');
  const resolved = registrar.resolveDomain('playground.dev.k');
  assert.strictEqual(
    resolved,
    path.join(config.get().sitesDir, 'playground.dev.k')
  );
  registrar.unregisterDomain('playground.dev.k');
});