/**
 * registrar.js — Domain Registrar (KNS)
 *
 * Admin-only registration of Kin domains under supported TLDs.
 * Each registered domain maps to a directory on the node's disk.
 */

const fs = require('fs');
const path = require('path');
const config = require('./config');

const SUPPORTED_TLDS = ['.k', '.kin', '.dev.k', '.io.k', '.be.k'];
const RESERVED = new Set(['kin', 'knet', 'kest', 'node', 'admin', 'dns', 'kns', 'www']);
const COUNTRY_CODES = ['be', 'de', 'fr', 'nl', 'uk', 'us', 'pt', 'es', 'it', 'jp'];

/** Path to the domain registry file. */
function registryPath() {
  return path.join(config.get().dataDir, 'domains.json');
}

/** Load the domain registry. */
function loadDomains() {
  const p = registryPath();
  if (fs.existsSync(p)) {
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8')).domains || [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Persist the domain registry. */
function saveDomains(domains) {
  fs.mkdirSync(config.get().dataDir, { recursive: true });
  fs.writeFileSync(registryPath(), JSON.stringify({ domains }, null, 2));
}

/** Validate a domain name against KNS rules. Returns error string or null. */
function validateDomain(name) {
  if (typeof name !== 'string' || name.length === 0) {
    return 'Domain name is required';
  }

  name = name.toLowerCase();

  // Check TLD
  let tld = null;
  for (const suffix of SUPPORTED_TLDS) {
    if (name.endsWith(suffix)) {
      tld = suffix;
      break;
    }
  }

  // Country-code TLD: [cc].k
  if (!tld) {
    const match = name.match(/^([a-z0-9-]+)\.([a-z]{2})\.k$/);
    if (match && COUNTRY_CODES.includes(match[2])) {
      tld = `.${match[2]}.k`;
    }
  }

  if (!tld) {
    return 'Invalid domain: TLD not supported';
  }

  // Label before TLD
  const label = name.slice(0, name.length - tld.length);
  if (!label || label.length < 2 || label.length > 63) {
    return 'Invalid domain: label length must be 2-63 characters';
  }
  if (!/^[a-z0-9-]+$/.test(label)) {
    return 'Invalid domain: characters';
  }
  if (label.startsWith('-') || label.endsWith('-')) {
    return 'Invalid domain: characters';
  }
  if (RESERVED.has(label)) {
    return 'Invalid domain: reserved name';
  }

  return null;
}

/** Register a new domain. Throws on validation failure. */
function registerDomain(name, description = '') {
  const clean = String(name || '').toLowerCase();
  const error = validateDomain(clean);
  if (error) {
    const err = new Error(error);
    err.status = 400;
    throw err;
  }

  const domains = loadDomains();
  if (domains.some((d) => d.name === clean)) {
    const err = new Error('Domain already registered');
    err.status = 400;
    throw err;
  }

  const directory = path.join(config.get().sitesDir, clean);
  fs.mkdirSync(directory, { recursive: true });

  const entry = {
    name: clean,
    directory: `sites/${clean}`,
    registeredAt: new Date().toISOString(),
    description: description || '',
  };
  domains.push(entry);
  saveDomains(domains);
  return entry;
}

/** Unregister a domain. Content directory is kept by design. */
function unregisterDomain(name) {
  const clean = String(name || '').toLowerCase();
  const domains = loadDomains();
  const remaining = domains.filter((d) => d.name !== clean);
  if (remaining.length === domains.length) {
    const err = new Error('Domain not found');
    err.status = 404;
    throw err;
  }
  saveDomains(remaining);
  return { ok: true };
}

/** Resolve a domain to an absolute content directory, or null. */
function resolveDomain(name) {
  const clean = String(name || '').toLowerCase();
  const entry = loadDomains().find((d) => d.name === clean);
  if (!entry) return null;
  return path.join(config.get().sitesDir, clean);
}

/** List all registered domains. */
function listDomains() {
  return loadDomains();
}

module.exports = {
  SUPPORTED_TLDS,
  RESERVED,
  validateDomain,
  registerDomain,
  unregisterDomain,
  resolveDomain,
  listDomains,
};
