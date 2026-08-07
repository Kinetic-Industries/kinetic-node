/**
 * cert.js — Identity Engine
 *
 * Generates and manages the node's self-signed certificate and derives
 * the Node ID (a SHA-256 fingerprint of the certificate's public key,
 * formatted as k1:xxxx:xxxx:...).
 */

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');

const CERT_DIR = () => path.join(require('./config').get().dataDir, 'certs');
const CERT_PEM = () => path.join(CERT_DIR(), 'node.pem');
const KEY_PEM = () => path.join(CERT_DIR(), 'node.key');

/** Generate a self-signed X.509 certificate for this node. */
function generateCertificate(nodeName) {
  const keys = forge.pki.rsa.generateKeyPair(2048);

  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01' + Date.now().toString(16).toUpperCase();

  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 10);

  const attrs = [
    { name: 'commonName', value: nodeName },
    { name: 'organizationName', value: 'Kinetic Industries' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: 'basicConstraints', cA: true },
    { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, keyCertSign: true },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    keyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}

/** Derive the Node ID: "k1:" + SHA-256 fingerprint as 4-hex-digit groups. */
function deriveNodeId(certPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
  const md = forge.md.sha256.create();
  md.update(der.getBytes());
  const hex = md.digest().toHex();

  // k1:xxxx:xxxx:xxxx:xxxx (4 hex digits per group)
  const groups = hex.match(/.{1,4}/g).slice(0, 8);
  return 'k1:' + groups.join(':');
}

/** Compute the SHA-256 fingerprint of a certificate (PEM string). */
function certFingerprint(certPem) {
  const cert = forge.pki.certificateFromPem(certPem);
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert));
  const md = forge.md.sha256.create();
  md.update(der.getBytes());
  return md.digest().toHex().toUpperCase();
}

/** Ensure a certificate exists; generate one if not. Returns identity. */
function ensureIdentity() {
  const config = require('./config').get();
  fs.mkdirSync(CERT_DIR(), { recursive: true });

  let certPem, keyPem;
  const certPath = CERT_PEM();
  const keyPath = KEY_PEM();

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    certPem = fs.readFileSync(certPath, 'utf8');
    keyPem = fs.readFileSync(keyPath, 'utf8');
  } else {
    console.log('[kinetic-node] Generating self-signed certificate...');
    const generated = generateCertificate(config.name);
    certPem = generated.certPem;
    keyPem = generated.keyPem;
    fs.writeFileSync(certPath, certPem, { mode: 0o644 });
    fs.writeFileSync(keyPath, keyPem, { mode: 0o600 });
  }

  const nodeId = deriveNodeId(certPem);
  return { certPem, keyPem, nodeId };
}

module.exports = { ensureIdentity, deriveNodeId, certFingerprint };