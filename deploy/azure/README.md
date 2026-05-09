# Azure Ubuntu VPS deployment

This directory contains everything you need to run Email-Verifier on a
fresh Azure Ubuntu VM at your own domain.

## What you'll need

| Item | Why |
| --- | --- |
| Azure VM, Ubuntu 22.04+ (B1s or larger) | The host. |
| A DNS record pointing at the VM (A or AAAA) | For TLS via Let's Encrypt. |
| Ports **80** and **443** open in the Azure NSG | For Caddy + ACME challenge. |
| Port **22** open for SSH | For initial setup. |
| `FIREBASE_ADMIN_CREDENTIALS` (service-account JSON) | Backend ID-token verification. |

You do **not** need:

- A separate database server. Per-user data lives in Firestore.
- A managed PaaS (Render, Railway, …). Caddy + systemd is enough.
- Outbound port 25 unless you opt-in to live SMTP probing
  (`EMAIL_VERIFIER_ENABLE_SMTP=true`). Most cloud providers block 25
  by default; Azure is no exception.

## Install (one-shot)

SSH into the VM as a user with `sudo`, then run:

```bash
curl -fsSL https://raw.githubusercontent.com/mdhossain-2437/Email-Verifier/init/deploy/azure/install.sh \
  | sudo DOMAIN=verifier.example.com \
         EMAIL=you@example.com \
         FIREBASE_ADMIN_CREDENTIALS="$(cat firebase-admin.json)" \
         bash
```

Replace `verifier.example.com` and `you@example.com` with your real values
and put the path to your service-account JSON file in `FIREBASE_ADMIN_CREDENTIALS`.

The script:

1. Installs Node 20, Python 3, Poetry, Caddy, git, and ufw.
2. Creates a `email-verifier` system user.
3. Clones the repo to `/opt/email-verifier`.
4. Builds the frontend (`npm run build` -> `frontend/dist`).
5. Installs backend deps (`poetry install --without dev`).
6. Writes `/etc/email-verifier/env` with your Firebase admin JSON
   and other tunables.
7. Installs the systemd unit + drop-in.
8. Renders `Caddyfile` from the template in this directory.
9. Reloads systemd + Caddy.

When it finishes, your app is live at `https://${DOMAIN}` with a real
Let's Encrypt cert.

## Optional environment variables

| Var | Default | Description |
| --- | --- | --- |
| `EMAIL_VERIFIER_MAX_UPLOAD_BYTES` | `0` (unlimited) | Upload cap, in bytes. Set this on a small VM. |
| `EMAIL_VERIFIER_ENABLE_SMTP` | `false` | Allow live SMTP probing. Most clouds block port 25 outbound. |
| `APP_DIR` | `/opt/email-verifier` | Install root. |
| `APP_USER` | `email-verifier` | Service account that runs the backend. |
| `REPO_URL` | upstream | Override if you forked. |

## Operations

| What | How |
| --- | --- |
| Backend logs | `journalctl -u email-verifier -f` |
| Caddy logs | `journalctl -u caddy -f` |
| Restart backend | `sudo systemctl restart email-verifier` |
| Update to latest | `sudo bash /opt/email-verifier/deploy/azure/install.sh` (re-run the same command) |
| Tail live verifier health | `curl https://${DOMAIN}/healthz` |
| API version | `curl https://${DOMAIN}/api/version` |

## Hardening checklist

After install:

1. **Disable password SSH**, leave key auth only:
   `sudo sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config && sudo systemctl reload ssh`
2. **Enable UFW** if it's not already:
   `sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw enable`
3. **Set an upload cap** if your VM is small (e.g. B1s/B1ms):
   edit `/etc/email-verifier/env` and set `EMAIL_VERIFIER_MAX_UPLOAD_BYTES=2147483648` (2 GiB), then
   `sudo systemctl restart email-verifier`.
4. **Restrict Authorised domains** in Firebase Console -> Authentication
   -> Settings -> Authorized domains. Add `${DOMAIN}` and remove any
   you don't use.
5. **Deploy `firestore.rules`** from the repo root with `firebase deploy --only firestore:rules`.

## Uninstall

```bash
sudo systemctl disable --now email-verifier
sudo systemctl disable --now caddy
sudo rm -rf /opt/email-verifier /etc/email-verifier \
  /etc/systemd/system/email-verifier.service \
  /etc/systemd/system/email-verifier.service.d \
  /etc/caddy/Caddyfile
sudo userdel -r email-verifier || true
sudo systemctl daemon-reload
```
