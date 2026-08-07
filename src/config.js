/**
 * config.js — Persistent node configuration.
 *
 * Loads node settings from environment variables (with sane defaults)
 * and persists admin credentials to data/config.json.
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, '..', 'data');
const configPath = path.join(dataDir, 'config.json');

function defaultConfig() {
  return {
    name: process.env.NODE_NAME || 'kin-node',
    description: process.env.NODE_DESC || 'A Kinetic Industries node',
    knetPort: parseInt(process.env.KNET_PORT || '8080', 10),
    kestPort: parseInt(process.env.KEST_PORT || '8443', 10),
    adminPort: parseInt(process.env.ADMIN_PORT || '4040', 10),
    dataDir,
    sitesDir: path.join(__dirname, '..', 'sites'),
    admin: {
      user: process.env.ADMIN_USER || 'admin',
      // Hash of initial password; changed via admin dashboard/API.
      passHash: bcrypt.hashSync(process.env.ADMIN_PASS || 'change-me', 10),
    },
  };
}

let cache = null;

/** Load (or initialize) the node's configuration. */
function get() {
  if (cache) return cache;

  fs.mkdirSync(dataDir, { recursive: true });
  let cfg = defaultConfig();

  if (fs.existsSync(configPath)) {
    try {
      const saved = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      cfg = {
        ...cfg,
        ...saved,
        dataDir,
        sitesDir: path.join(__dirname, '..', 'sites'),
      };
    } catch {
      // Corrupt config — fall back to defaults.
    }
  }

  cache = cfg;
  return cfg;
}

/** Persist the current configuration to disk. */
function save() {
  const cfg = get();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
}

/** Verify admin credentials. Returns true if they match. */
function verifyAdmin(user, pass) {
  const cfg = get();
  return user === cfg.admin.user && bcrypt.compareSync(pass, cfg.admin.passHash);
}

/** Change admin credentials. */
function setAdminCredentials(newUser, newPass) {
  const cfg = get();
  cfg.admin.user = newUser;
  cfg.admin.passHash = bcrypt.hashSync(newPass, 10);
  save();
}

module.exports = { get, save, verifyAdmin, setAdminCredentials };