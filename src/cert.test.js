/**
 * cert.test.js — Tests for certificate generation and Node ID derivation.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { generateCertificate, deriveNodeId } = require('./cert');

test('deriveNodeId returns k1-prefixed grouped fingerprint', () => {
  const { certPem } = generateCertificate('test-node');
  const id = deriveNodeId(certPem);
  assert.match(id, /^k1:[0-9a-f]{4}(:[0-9a-f]{4}){7}$/);
});

test('deriveNodeId is deterministic for the same cert', () => {
  const { certPem } = generateCertificate('test-node');
  assert.strictEqual(deriveNodeId(certPem), deriveNodeId(certPem));
});

test('different certs produce different Node IDs', () => {
  const a = deriveNodeId(generateCertificate('node-a').certPem);
  const b = deriveNodeId(generateCertificate('node-b').certPem);
  assert.notStrictEqual(a, b);
});