# Deploying Filadex on Synology Container Manager (SQLite)

> Comprehensive deployment guide. Reference files: [`docker-compose.synology.yml`](../docker-compose.synology.yml), [`README.md`](../README.md), [`docs/adr/0004-sqlite-alongside-postgres.md`](adr/0004-sqlite-alongside-postgres.md).

**Deployment pipeline:** Build image on PC → Export to `.tar` → Import into Container Manager → Create Docker Compose project → Autostart → HTTPS via DSM Reverse Proxy.

---

## Before You Begin — Five Details Specific to This Project

These requirements stem directly from the Filadex codebase and will cause deployment failure or confusing behavior if overlooked:

**1. Login requires HTTPS (Secure Cookie).**
In [`server/routes/auth.ts`](../server/routes/auth.ts), the session cookie is set with:
```typescript
secure: process.env.NODE_ENV === "production"
```
In a production container, `NODE_ENV=production` is active, so the browser receives a cookie with the `Secure` flag. If accessed over plain HTTP (e.g., `http://NAS_IP:8080`), modern browsers will reject storing and transmitting the cookie. You will experience an endless redirection loop back to `/login`. A reverse proxy with a valid SSL/TLS certificate is an operational prerequisite.
*(Exception: `http://localhost:8080` works when accessed on the same machine because browsers treat localhost as a secure origin; this is useful for local verification on your PC).*

**2. `DATABASE_URL` must be an absolute path starting with `file:`.**
In [`server/db.sqlite.ts`](../server/db.sqlite.ts), relative paths (such as `file:./dev.db`) are explicitly rejected when `NODE_ENV=production`:
```typescript
if (!path.isAbsolute(filePath) && process.env.NODE_ENV === "production") {
  throw new Error(`DATABASE_URL must name an absolute path in production...`);
}
```
A relative path resolves against the container's working directory (`/app`), placing database writes into the ephemeral container layer rather than the mounted volume. Any restart or image update would destroy all data. Always use:
```env
DATABASE_URL=file:/data/filadex.db
```

**3. Persistent sessions require `JWT_SECRET`.**
In [`server/auth.ts`](../server/auth.ts), if `JWT_SECRET` is unset, the server generates a random 32-byte secret in memory on every startup. Every time the container restarts (NAS reboot, container update, or config change), all active user session tokens become invalid and all users are logged out. Generate and set a static 32+ character random string:
```bash
openssl rand -hex 32
```

**4. Initial admin credentials & immediate password change.**
On first startup, [`server/auth.ts`](../server/auth.ts) automatically creates the default administrator account:
* Username: `admin`
* Password: `admin`
* Force password change: `forceChangePassword: true`

There is no variable that sets this password. The account is created whenever no account has the admin role, so renaming it does not bring a second one back. Until the password has been changed, the server answers every request from that account except the change itself with `403`, and the web interface takes you to `/change-password`.

**4a. `APP_URL`.** Set this to the address users open Filadex at (for example `https://filadex.your-nas.synology.me`). Verification and password-reset emails link to it, and they are not sent while it is unset - the link must not come from the request, whose `Host` header anyone can forge.

**5. `TRUST_PROXY=true` behind Synology Reverse Proxy.**
Filadex enforces brute-force rate limiting (e.g., 15 login attempts per 15 minutes in [`server/routes/auth.ts`](../server/routes/auth.ts)). When running behind DSM Reverse Proxy (Nginx on the host), setting `TRUST_PROXY=true` in [`server/index.ts`](../server/index.ts) instructs Express to trust the `X-Forwarded-For` header. Without this, all incoming requests appear to come from the NAS host loopback (`127.0.0.1`), causing rate limits to be shared globally across all users and devices.

---

## Stage 1 — Build the Docker Image on PC

We build the Docker image on a workstation rather than compiling directly on the Synology NAS. This avoids high CPU load, potential Out-Of-Memory errors on low-spec NAS hardware, and keeps the NAS free of build dependencies.

In your terminal (PowerShell, bash, or zsh) inside the project root:

```bash
docker build -t filadex:1.0.0 -t filadex:latest .
```

The build is a multi-stage Dockerfile (`node:20-alpine`) that compiles the Vite frontend, the Express backend bundles (both Postgres and SQLite engines), database migrators, and seeders.

### Verify Architecture
Ensure the built image matches your Synology NAS CPU architecture (typically `amd64` on Intel/AMD Plus series models):

```bash
docker image inspect filadex:1.0.0 --format "{{.Os}}/{{.Architecture}}"
```
Output should be: `linux/amd64`.

*(Note: If your NAS uses an ARM CPU, such as DS223 or DS423 with Realtek RTD1619B, build using `docker buildx build --platform linux/arm64 -t filadex:1.0.0 -t filadex:latest --load .`)*

### Optional Local Smoke Test
Before copying anything to your NAS, test the image locally on your PC:

```bash
docker run --rm -p 8080:8080 \
  -v ${PWD}/data-test:/data \
  -e DATABASE_URL=file:/data/filadex.db \
  -e JWT_SECRET=test-secret-test-secret-test-secret-32 \
  filadex:1.0.0
```

Open `http://localhost:8080` in your browser. Log in with `admin` / `admin`, verify that it prompts you to change your password, then stop the container (`Ctrl+C`) and delete the temporary `data-test` directory.

---

## Stage 2 — Export the Image to a File

Export the built image into a `.tar` archive:

```bash
docker save filadex:1.0.0 -o filadex-1.0.0.tar
```

* On Windows PowerShell:
  ```powershell
  docker save filadex:1.0.0 -o filadex-1.0.0.tar
  ```

Expect a file size of approximately 200–350 MB. **Do not compress to `.tar.gz`** — Synology Container Manager expects an uncompressed `.tar` archive.

---

## Stage 3 — Import the Image in Container Manager

In DSM, open **Container Manager → Image → Action → Import → Add from file**.

Choose between two import methods:

| Method | When to use | Instructions |
| --- | --- | --- |
| **From local device** | Fast LAN connection | Select `filadex-1.0.0.tar` directly from your PC; upload proceeds via DSM web browser. |
| **From this DSM system** | Large file or remote link | Upload `filadex-1.0.0.tar` to `/docker/filadex/` using File Station first, then select it in Container Manager. |

The import process takes 1–3 minutes. Once completed, `filadex:1.0.0` will appear in your **Image** list. You can safely delete the `.tar` file afterwards.

---

## Stage 4 — Folders and Permissions on NAS

Using File Station, create the following directory structure inside the shared `docker` folder (which Container Manager creates by default):

```text
/docker/filadex/
├── docker-compose.yml
└── data/
```

* Leave the `data/` subdirectory empty.
* When the container starts, it will automatically create:
  * `filadex.db` — the SQLite database
  * `filadex.db-wal` & `filadex.db-shm` — SQLite write-ahead log files
  * `backups/` — automated snapshots created by the built-in backup scheduler

### Permissions Note
Filadex runs with unprivileged user permissions (`PUID` and `PGID`, defaulting to `1000:1000`). On Synology DSM, the primary administrator account typically has UID `1026` and the `users` group has GID `100`.

By default, the Synology Compose template sets `PUID=1026` and `PGID=100`. On startup, when run as root, the container entrypoint asserts ownership of `/data` for that user and drops root privileges via `su-exec`, so the database, its write-ahead log and the backup snapshots under `/docker/filadex/data/` are owned by that user on the NAS. Snapshots are written with mode `0600`, since each holds every password hash. A File Station administrator can still copy or download them; a non-admin DSM user cannot read them by browsing the share.

> [!TIP]
> You can verify your DSM user's UID and GID via SSH by running `id your_dsm_username`.
> If using Synology File Station to manage permissions directly, ensure your administrator user has **Read & Write** permissions on the `data` folder, with **"Apply to this folder, sub-folders and files"** selected.

---

## Stage 5 — Create the Docker Compose Project

In DSM, navigate to: **Container Manager → Project → Create**.

| Field | Value |
| --- | --- |
| **Project Name** | `filadex` (lowercase letters, numbers, hyphens only) |
| **Path** | `/docker/filadex` |
| **Source** | *Create docker-compose.yml* and paste the configuration below |

You can copy the contents directly from [`docker-compose.synology.yml`](../docker-compose.synology.yml) in this repository:

```yaml
version: '3.8'

services:
  filadex:
    image: filadex:1.0.0
    container_name: filadex
    restart: unless-stopped
    ports:
      - "127.0.0.1:8080:8080"
    volumes:
      - ./data:/data
    environment:
      - NODE_ENV=production
      - PORT=8080
      - PUID=1026
      - PGID=100
      - DATABASE_URL=file:/data/filadex.db
      # - JWT_SECRET=            # uncomment, paste your own `openssl rand -hex 32`
      - TRUST_PROXY=true
      - INIT_SAMPLE_DATA=true
      - LOG_LEVEL=INFO
    # pull_policy: never
```

> [!IMPORTANT]
> Generate a fresh secret of your own for `JWT_SECRET`, then uncomment that line and paste
> the value in before starting. On PC or NAS terminal:
> ```bash
> openssl rand -hex 32
> ```
> Never reuse a secret written in this repository or in these docs - a session cookie signed
> with a publicly known key can be forged by anyone. Leaving the line commented out is safe:
> the application generates a random secret per process, at the cost of logging everyone out
> on each restart.

### Why bind port 8080 to `127.0.0.1`?
The mapping `"127.0.0.1:8080:8080"` exposes the container port exclusively to the NAS host loopback interface. DSM Reverse Proxy (Nginx) runs on the host and reaches `localhost:8080` effortlessly. However, the port is completely invisible and unreachable from the local network (LAN). This ensures the only access route is via HTTPS through the reverse proxy, which is required for secure authentication cookies.

*(If you ever need to inspect the raw HTTP server directly for diagnostics, you can temporarily change the mapping to `"8080:8080"` or use SSH: `curl -I http://localhost:8080/`).*

### Why is there no `logging:` driver configured?
Do not add `logging: driver: json-file`. The Docker daemon in Synology DSM uses a proprietary logging driver (`db`), and the Container Manager GUI **Log** tab reads from that database. Explicitly configuring a file-based logging driver diverts container output away from DSM's database, resulting in the Container Manager GUI showing **"No logs available"**. Leaving the logging section unconfigured retains working GUI logs with DSM's native log rotation.

### Why not use `docker-compose.sqlite.template.yml` directly?
The development template in the repository contains `build: .`, which instructions Container Manager to compile the Vite frontend and esbuild bundles on the NAS itself. This would be slow and risks running out of RAM. The Synology compose file uses `image: filadex:1.0.0` to start the pre-built container instantly.

### If you encounter `pull access denied`
If Container Manager attempts to search Docker Hub for `filadex:1.0.0` instead of using the imported local image, uncomment:
```yaml
pull_policy: never
```

Click **Next**, skip the Web Station configuration page, and click **Done**. Container Manager will deploy and start the project.

---

## Stage 6 — Verify First Startup

In DSM: **Container Manager → Container → filadex → Log**.

Expected startup sequence:

```text
Database: SQLite
Applying database migrations...
[INFO] SQLite database: /data/filadex.db
Applying SQLite database migrations...
SQLite database is up to date.
Seeding starter data...
[INFO] SQLite database: /data/filadex.db
Adding starter selection options (manufacturers, materials, colors, etc.)...
Basic starter selection options inserted.
Sample spools need an account to own them; the application creates the default admin next.
Starting application...
[INFO] SQLite database: /data/filadex.db
[INFO] Default admin user created
serving on port 8080
```

`SQLite database: /data/filadex.db` appears three times because the migrator,
the seeder and the application each open the database and each say which file
they opened. Seeing the path you configured, rather than a path under `/app`, is
the check that your volume mapping is correct.

Check File Station under `/docker/filadex/data/`. You should see `filadex.db`, `filadex.db-wal`, and `filadex.db-shm`.

If you have SSH access to your NAS and want to confirm the service is responding:

```bash
curl -I http://localhost:8080/
```
Expected output: `HTTP/1.1 200 OK` (or HTML document response).

### Troubleshooting Common Startup Issues

| Symptom | Cause | Solution |
| --- | --- | --- |
| Container stops immediately; log shows `no such file or directory` | `docker-entrypoint.sh` has Windows CRLF line endings | Re-normalize line endings to LF (`git add --renormalize .` on PC) and rebuild the Docker image. |
| Container restarts in a loop; log shows `DATABASE_URL must name an absolute path` | `DATABASE_URL` is set to a relative path like `file:./filadex.db` | Change to `file:/data/filadex.db` in your Compose environment. |
| Container status shows `port is already allocated` | Port 8080 is used by another service on the NAS loopback | Change port mapping to `"127.0.0.1:8085:8080"` and update destination port in Reverse Proxy. |
| Log tab in Container Manager shows "No logs available" | Compose file contains `logging: driver: json-file` | Remove the `logging:` section from the compose file and recreate the project. |
| Logging in redirects back to `/login` with no error | Accessing over plain HTTP | Complete Stage 8 (HTTPS Reverse Proxy). In production, the session cookie requires a secure HTTPS origin. |

---

## Stage 7 — Autostart after NAS Reboot

Autostart is primarily managed by `restart: unless-stopped` in the Docker Compose file.

Two conditions must be met for autostart to work reliably:
1. **Do not stop the project manually.** The `unless-stopped` policy remembers manual stops and will not restart the container on boot if it was stopped by the user.
2. **Container Manager package autostart.** Ensure the Container Manager package is configured to run on startup in DSM Package Center.

### Optional Safety Net (Task Scheduler)
On systems with encrypted volumes or delayed volume mounting, the Docker service might start before `/volume1` is fully available, causing container failure on initial boot.

To ensure resilience:
1. Open **Control Panel → Task Scheduler → Create → Triggered Task → User-defined script**.
2. **General**:
   * Task: `filadex autostart`
   * User: `root`
   * Event: `Boot-up`
3. **Task Settings**:
   ```bash
   sleep 90
   /usr/local/bin/docker compose -f /volume1/docker/filadex/docker-compose.yml up -d
   ```

---

## Stage 8 — Configure HTTPS via DSM Reverse Proxy

### 8a. Hostname
* Navigate to **Control Panel → External Access → DDNS → Add**.
* Select provider **Synology** (e.g., `yourdomain.synology.me`).
* Alternatively, use your own custom domain pointing to your NAS external IP (or local DNS record if restricted to LAN).

### 8b. SSL/TLS Certificate
* Go to **Control Panel → Security → Certificate → Add → Get a certificate from Let's Encrypt**.
  * **Public access scenario:** Requires port 80 to be temporarily forwarded to the NAS router during renewal.
  * **LAN-only scenario:** Request a wildcard certificate (`*.yourdomain.synology.me`) via Synology DDNS. Synology resolves this via DNS-01 verification without requiring any inbound router ports.

### 8c. Reverse Proxy Rule
Go to **Control Panel → Login Portal → Advanced → Reverse Proxy → Create**.

**Source (Incoming):**
* Protocol: `HTTPS`
* Hostname: `filadex.yourdomain.synology.me`
* Port: `443`
* Enable HSTS: Checked

**Destination (Internal Container):**
* Protocol: `HTTP`
* Hostname: `localhost`
* Port: `8080`

**Custom Headers:**
Click **Create → WebSocket** (automatically adds `Upgrade` and `Connection`), then manually add:

| Header Name | Value |
| --- | --- |
| `X-Forwarded-Proto` | `https` |
| `X-Forwarded-For` | `$proxy_add_x_forwarded_for` |

### 8d. Assign the Certificate
Go to **Control Panel → Security → Certificate → Settings**. Under the service list, find your new `filadex.yourdomain.synology.me` reverse proxy entry and select the certificate created in Step 8b. Click **Save**.

### 8e. External Access vs. VPN (Tailscale / WireGuard)
* **Direct Internet Access:** If exposing Filadex externally (e.g. checking filament stock while away), forward port `443` (TCP) on your router to your NAS IP. Enable DSM Firewall rules (restricting access to your country to filter automated scans).
* **VPN Alternative (Recommended):** If you prefer not to expose port 443 to the public internet, install **Tailscale** (available in Package Center) or configure WireGuard on your home router. You can connect to your NAS securely with zero forwarded ports.

### 8f. Connectivity Diagnostics

If the domain does not load, run the following diagnostic steps in order:

| Step | Command | Verification Goal |
| --- | --- | --- |
| 1 | `nslookup filadex.yourdomain.synology.me` (on PC) | Verifies if DNS resolves to the correct IP. |
| 2 | `Test-NetConnection -ComputerName NAS_IP -Port 443` (PowerShell) | Verifies DSM Nginx is listening on port 443 and firewall allows traffic. |
| 3 | `curl -k -I -H 'Host: filadex.yourdomain.synology.me' https://127.0.0.1/` (via SSH on NAS) | Verifies DSM Reverse Proxy rule routes to the container. Expected: `HTTP/2 200` or `HTTP/1.1 200`. |
| 4 | `sudo tcpdump -ni any 'tcp port 443 and not net 192.168.0.0/16'` (via SSH during mobile LTE test) | Verifies packets from outside the LAN reach the NAS interface. |

---

## Stage 9 — First Login and Initial Configuration

1. Open `https://filadex.yourdomain.synology.me` in your web browser.
2. Sign in with the default credentials:
   * **Username:** `admin`
   * **Password:** `admin`
3. You will immediately be redirected to the change password form. Enter a strong, secure password.
4. **Starter Data:** Because `INIT_SAMPLE_DATA=true` was set, common manufacturers (Bambu Lab, Prusament, etc.), materials (PLA, PETG, ABS, TPU), and standard 1.75 mm diameters are ready for use.
5. **3D Printer & Moonraker Integration (Optional):**
   * If integrating with Klipper / Moonraker / Mainsail, go to **Settings → API Tokens**.
   * Generate an API token (prefixed with `fdx_`).
   * Filadex implements the subset of Spoolman's REST API that Moonraker's `[spoolman]` module calls, under `/api/spoolman-compat/v1/` (e.g. `/api/spoolman-compat/v1/spool`). Point Moonraker's `server:` setting at `https://filadex.yourdomain.synology.me/api/spoolman-compat` and pass the token.
   * Note the path is **not** `/api/v1/` — that falls through to the web interface and returns HTML, which Moonraker reports as an unhelpful parse error.

---

## Stage 10 — Backups and Maintenance

### 1. Built-in SQLite Automated Backups
Filadex includes native SQLite backup management accessible via **Settings → DB Backups** (admin only):
* **Online Snapshots:** Uses SQLite's `VACUUM INTO` command, generating a consistent database copy on disk without stopping the container or locking concurrent readers.
* **Automated Schedule:** Configure backups to run daily or weekly at a chosen time, with customizable retention pruning (e.g., keep the last 7 snapshots).
* Backups are saved inside your mounted `./data` volume as `/data/backups/filadex-backup-<timestamp>.db`, for example `filadex-backup-2026-09-05T21-21-26-489Z.db`.
* You can also trigger an immediate manual snapshot or download existing backup files directly from the UI.

### 2. Synology Hyper Backup
For external / offsite backup:
* Create a task in **Hyper Backup** pointing to `/docker/filadex/data/`.
* Because SQLite runs in WAL mode (`filadex.db-wal`), copying the active live database mid-transaction can capture uncommitted frames.
* **Safe backup options:**
  1. Rely on the `/docker/filadex/data/backups/` directory (created cleanly by Filadex's internal scheduler), which Hyper Backup can copy at any time without locking issues.
  2. If backing up the root database file, run a brief pre-backup stop task or use **Snapshot Replication** (on Btrfs shared folders) for instant point-in-time volume snapshots.

---

## Upgrading Filadex in the Future

When updating to a newer version:

1. On your PC, pull new changes and build the updated image:
   ```bash
   docker build -t filadex:1.1.0 .
   docker save filadex:1.1.0 -o filadex-1.1.0.tar
   ```
2. In Container Manager, import `filadex-1.1.0.tar`.
3. In **Container Manager → Project → filadex → Action → Edit**:
   Update the image tag:
   ```yaml
   image: filadex:1.1.0
   ```
4. Click **Save** and select **Build / Update**.
5. The container will restart using the new image. `docker-entrypoint.sh` will automatically run any newly added database migrations before starting the application.

> [!TIP]
> Keeping versioned tags (`1.0.0`, `1.1.0`) instead of generic `latest` ensures a painless rollback: if an issue occurs, simply revert the image line in the Compose file to the previous tag. Delete old images only after verifying stability.
