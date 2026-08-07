# Kinetic Node

**The server.** A self-hostable Kin network node — the engine that powers
decentralized hosting and identity.

A Kinetic Node generates its own cryptographic identity on first boot,
registers domains under the Kin TLDs, and serves static pages over the KNET
(HTTP) and KEST (HTTPS) protocols. It is designed to run on your own hardware
via Docker, with no accounts, no vendors, and no central authority.

---

## Quick Start

```bash
git clone https://github.com/kinetic-industries/kinetic-node
cd kinetic-node

cp .env.example .env        # optional — adjust ports/name/credentials
docker compose up -d
```

On first boot the node:

1. Generates a self-signed certificate and derives its **Node ID**.
2. Starts three listeners:
   - **KNET** (HTTP)  — `:8080`
   - **KEST** (HTTPS) — `:8443`
   - **Admin UI**     — `http://localhost:4040`
3. Registers the `welcome.k` demo domain and serves its page.

```
[kinetic-node] KNET  listening on :8080
[kinetic-node] KEST  listening on :8443
[kinetic-node] Admin dashboard on  http://localhost:4040

[kinetic-node] Node ID: k1:9f3a:...:c41d
```

**Write down the Node ID.** Browsers use it to find and trust your node.

---

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Purpose |
|---|---|---|
| `NODE_NAME` | `kin-node` | Human-readable node name |
| `NODE_DESC` | `A Kinetic Industries node` | Short description |
| `KNET_PORT` | `8080` | Plaintext serving port |
| `KEST_PORT` | `8443` | TLS serving port |
| `ADMIN_PORT` | `4040` | Admin dashboard port |
| `ADMIN_USER` | `admin` | Initial admin username |
| `ADMIN_PASS` | `change-me` | Initial admin password — **change on first login** |

---

## Hosting a Domain

1. Open `http://localhost:4040` and log in as the administrator.
2. In *Registered Domains → Register a domain*, enter e.g. `hello.k`.
3. Drop files into `sites/hello.k/`:

```bash
mkdir -p sites/hello.k
echo '<h1>Hello, Kin!</h1>' > sites/hello.k/index.html
```

4. Visit the site with the Kinetic Browser:

```
kin://hello.k/
```

Or any browser/file tool, via the node directly:

```
curl http://localhost:8080/kin/hello.k/
```

---

## Running Without Docker

Requires Node.js 18+:

```bash
npm install
npm start
```

---

## Development

```bash
npm test        # runs src/*.test.js
```

Tests cover certificate generation/Node ID derivation, registrar validation
(TLDs, reserved names, duplicates), the hosting engine (index resolution,
traversal protection), and admin auth.

---

## Project Layout

```
kinetic-node/
├── src/
│   ├── server.js      # Entry point; binds KNET, KEST, and admin listeners
│   ├── cert.js        # Certificate generation & Node ID derivation
│   ├── registrar.js   # Admin-only domain registration & validation
│   ├── host.js        # Static page hosting engine
│   ├── admin.js       # Admin API + session auth
│   └── config.js      # Persistent configuration & admin credentials
├── admin-ui/          # Local admin dashboard (HTML/CSS/JS)
├── data/              # Runtime state: certs, config, domains (gitignored)
└── sites/             # Hosted content — one folder per registered domain
```

---

## License

MIT — see [`LICENSE`](LICENSE). Built as part of
[Kinetic Industries](https://github.com/kinetic-industries).