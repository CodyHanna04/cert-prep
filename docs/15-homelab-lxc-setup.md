# 15 — Homelab production setup (Proxmox LXC, Debian 13)

**As built (2026-11-02):** CT 104 `CertPrep`, `192.168.86.227`, Debian 13, 2 cores, 4 GB RAM, 512 MB swap, 40 GB disk. Sections 2–4 are done: SSH is key-only (`deploy` user), Docker is installed, the app runs from `/srv/certprep`, and the admin site is at `https://certprep-admin.tailbacb1d.ts.net`. Not done yet: nginx (section 5, on your nginx LXC), DNS, the first account, and the section 8 checks that need another LAN machine. Backups (section 6) are skipped for now.

Step-by-step setup for `study.codycodez.com` on the homelab. Assumes **Proxmox VE** and an **existing nginx host** that already terminates HTTPS for the homelab (decisions D46, D48). Placeholders in angle brackets: fill them in as you go.

| Placeholder | Meaning |
|---|---|
| `<CTID>` | New container id (next free in Proxmox) |
| `<LXC_IP>` | Next free static IP on the LAN (section 1.1) |
| `<GW>` / `<DNS>` / `<CIDR>` | LAN gateway, DNS server, prefix (usually `/24`) |
| `<NGINX_IP>` | The host running your nginx reverse proxy |
| `<ADMIN_IP>` | The PC you SSH from (this Windows machine) |
| `<LAN>` | Your LAN range, e.g. `192.168.1.0/24` |

## 0. Shape of the deployment

```
Internet ─443/80─▶ router ─▶ nginx host (<NGINX_IP>, TLS, rate limits)
                                   │ http :3000 (only this host may connect)
                                   ▼
                     LXC "certprep" (<LXC_IP>, Debian 13, Docker)
                       ├ web      Next.js, APP_MODE=web    (published on <LXC_IP>:3000)
                       ├ db       Postgres 17               (internal Docker network only)
                       ├ admin    Next.js, APP_MODE=admin   (no published port)
                       └ ts-admin Tailscale sidecar ─▶ tailnet-only HTTPS for the admin site
```

Ports, in full:

| Port | Where | Open to |
|---|---|---|
| 443, 80 | router → nginx host (probably already forwarded) | Internet |
| 3000/tcp | `<LXC_IP>` | `<NGINX_IP>` only |
| 22/tcp | `<LXC_IP>` | `<ADMIN_IP>` only |
| 5432 | inside Docker only | nobody outside the LXC; never published |
| Admin site | tailnet HTTPS (`https://certprep-admin.<tailnet>.ts.net`) | your Tailscale login only |
| Outbound | LXC → internet (apt, Docker Hub, npm, Tailscale) | allowed; LXC → rest of LAN is blocked |

## 1. Create the LXC (on the Proxmox host)

### 1.1 Find the next free IP

On the Proxmox host shell, list the static IPs already given to containers and VMs:

```bash
for id in $(pct list | awk 'NR>1{print $1}'); do echo "CT $id: $(pct config $id | grep -o 'ip=[^,]*')"; done
for id in $(qm list | awk 'NR>1{print $1}'); do echo "VM $id: $(qm config $id | grep -o 'ip=[^,]*')"; done
```

Pick the next address after the highest one, and confirm it is outside your router's DHCP range and not in use (`ping -c2 <LXC_IP>` gets no reply). VMs configured inside the guest (not by cloud-init) won't show here, so check the router's client list too.

### 1.2 Resources

| Resource | Value | Why |
|---|---|---|
| Type | **Unprivileged** container | root inside is not root on the host |
| Template | Debian 13 standard | `pveam update && pveam available \| grep debian-13`, then `pveam download local <name>` |
| CPU | 2 cores | the Next.js build is the only heavy step |
| RAM | 4096 MB | build peaks around 2 GB; running it all uses about 0.6–1 GB |
| Swap | 512 MB | |
| Disk | 32 GB | OS ~1.5 GB, Docker images and build cache ~4–6 GB, database tiny, room for local dumps |
| Features | `nesting=1,keyctl=1` | required for Docker inside LXC |
| Start at boot | yes | |

### 1.3 Create it

From the Proxmox shell (or the same values in the GUI wizard):

```bash
pct create <CTID> local:vztmpl/<debian-13-template>.tar.zst \
  --hostname certprep --ostype debian --unprivileged 1 \
  --cores 2 --memory 4096 --swap 512 \
  --rootfs local-lvm:32 \
  --net0 name=eth0,bridge=vmbr0,ip=<LXC_IP>/<CIDR>,gw=<GW>,firewall=1 \
  --nameserver <DNS> \
  --features nesting=1,keyctl=1 \
  --onboot 1 \
  --password
pct start <CTID>
```

(Change `local-lvm` if your storage is named differently.)

**Tailscale device (only if the admin sidecar later fails to start):** the Tailscale image runs in userspace networking by default, which needs no device. If it complains about `/dev/net/tun`, add these two lines to `/etc/pve/lxc/<CTID>.conf` and restart the container:

```
lxc.cgroup2.devices.allow: c 10:200 rwm
lxc.mount.entry: /dev/net dev/net none bind,create=dir
```

### 1.4 Backup disk mount

Give the container a directory on a **different physical disk** for database dumps:

```bash
mkdir -p /mnt/<backupdisk>/certprep
chown 100000:100000 /mnt/<backupdisk>/certprep     # container root maps to host uid 100000
pct set <CTID> -mp0 /mnt/<backupdisk>/certprep,mp=/srv/backups
```

Also add the container to a Proxmox backup job (Datacenter → Backup), daily or weekly, **snapshot** mode.

### 1.5 Proxmox firewall (this is the real network boundary)

Docker writes its own iptables rules for published ports, which skip `ufw` inside the container. So filtering is done **by Proxmox, outside the container**, where nothing inside can change it.

1. Datacenter → Firewall → Options → **Firewall: Yes**. (Before you do: Proxmox keeps the web UI (8006) and SSH reachable from the local network by default, but have console access to the host just in case.)
2. Create `/etc/pve/firewall/<CTID>.fw`:

```
[OPTIONS]
enable: 1
policy_in: DROP
policy_out: ACCEPT

[RULES]
IN ACCEPT -source <NGINX_IP> -p tcp -dport 3000 -log nolog
IN ACCEPT -source <ADMIN_IP> -p tcp -dport 22 -log nolog
IN ACCEPT -p icmp -log nolog
OUT ACCEPT -dest <DNS> -p udp -dport 53 -log nolog
OUT ACCEPT -dest <DNS> -p tcp -dport 53 -log nolog
OUT ACCEPT -dest <GW> -log nolog
OUT DROP -dest <LAN> -log nolog
```

Rules run top to bottom: the container can reach DNS and the gateway (for the internet), and nothing else on the LAN. Replies to nginx's connections are allowed by connection tracking. If your DNS server is the gateway, the DNS lines are redundant but harmless.

## 2. Inside the LXC: base system

Open a console (`pct enter <CTID>`) or SSH as root with the password you set (temporarily).

```bash
apt update && apt full-upgrade -y
apt install -y ca-certificates curl git sudo unattended-upgrades apt-listchanges openssh-server
timedatectl set-timezone <Your/Timezone>      # e.g. America/New_York; also goes in APP_TIMEZONE
dpkg-reconfigure -plow unattended-upgrades     # answer Yes: automatic security updates
```

### 2.1 Users

```bash
adduser cody                       # you
usermod -aG sudo cody
adduser --disabled-password deploy # the account Claude Code uses (section 7)
```

Put your public key in `/home/cody/.ssh/authorized_keys` (mode 600, directory 700, owned by `cody`).

### 2.2 SSH hardening

`/etc/ssh/sshd_config.d/10-certprep.conf`:

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers cody deploy
X11Forwarding no
AllowTcpForwarding no
```

```bash
sshd -t && systemctl restart ssh
```

Test a new key-based login as `cody` **before** closing the root session.

## 3. Docker

From Docker's own repository (Debian's `docker.io` package lags behind):

```bash
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian trixie stable" \
  > /etc/apt/sources.list.d/docker.list
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

`/etc/docker/daemon.json` (log rotation, containers survive a daemon restart):

```json
{ "log-driver": "local", "log-opts": { "max-size": "10m", "max-file": "5" }, "live-restore": true }
```

```bash
systemctl restart docker
docker run --rm hello-world
usermod -aG docker deploy
```

Membership of the `docker` group is root-equivalent **inside this container**. That is acceptable because the container is unprivileged and firewalled; it is still a reason to give `deploy` nothing else.

**If containers fail to start** with a "permission denied" on a `sysctl` such as `net.ipv4.ip_unprivileged_port_start`: that was a known Docker-in-LXC breakage in late 2025 after a `runc` security update. Update the Proxmox host first (`apt full-upgrade` on the host, which brings fixed LXC packages), then retry.

## 4. The app

### 4.1 Code

```bash
mkdir -p /srv/certprep && chown deploy:deploy /srv/certprep
```

The code gets there either with `git clone` from a private GitHub repository (with a read-only deploy key), or copied from your PC. The repository has no remote yet; see the open questions in the chat. Then:

```bash
cd /srv/certprep
rm -f docker-compose.override.yml      # dev-only: it publishes Postgres on loopback
```

### 4.2 Secrets: `/srv/certprep/.env`

Generate each password separately. Hex keeps them safe inside connection URLs.

```bash
for v in POSTGRES_PASSWORD OWNER_PASSWORD APP_PASSWORD AUTH_PASSWORD ADMIN_PASSWORD; do echo "$v=$(openssl rand -hex 24)"; done
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 48)"
```

```
POSTGRES_PASSWORD=…
OWNER_PASSWORD=…
APP_PASSWORD=…
AUTH_PASSWORD=…
ADMIN_PASSWORD=…
BETTER_AUTH_SECRET=…

APP_ORIGIN=https://study.codycodez.com
PASSKEY_RP_ID=study.codycodez.com
APP_TIMEZONE=<Your/Timezone>
WEB_BIND=<LXC_IP>

ADMIN_TAILSCALE_LOGINS=<your tailscale login>
TS_AUTHKEY=<tskey-auth-…>
```

```bash
chmod 600 .env && chown deploy:deploy .env
```

Never add `ALLOW_DEV_PASSWORD_LOGIN` here: the server refuses to boot in production if it is set. Keep a copy of this file in your password manager; losing it means losing database access from the app.

### 4.3 First start

```bash
docker compose -f docker-compose.yml build
docker compose -f docker-compose.yml up -d db
docker compose -f docker-compose.yml run --rm migrate
docker compose -f docker-compose.yml up -d web
curl -sI http://<LXC_IP>:3000/sign-in | head -1     # expect 200
docker compose -f docker-compose.yml run --rm migrate node scripts/create-user.mjs "Cody"
```

The last command prints a single-use enrollment link. Open it **after** nginx is set up (section 5), on `https://study.codycodez.com`, create a passkey, then add a second one on the Account page (a phone and a PC, or a hardware key).

### 4.4 Admin site over Tailscale

In the Tailscale admin console first: enable **MagicDNS** and **HTTPS certificates**; create an auth key (single use, pre-approved) and put it in `TS_AUTHKEY`. **The key is required:** without it the sidecar prints a login link but gives up after 60 seconds and restarts with a new link, so a browser sign-in rarely completes in time (found 2026-11-02). After the first start the node's identity lives in the `ts-state` volume, so you can blank `TS_AUTHKEY` again. Then:

```bash
docker compose -f docker-compose.yml --profile admin up -d
```

Open `https://certprep-admin.<your-tailnet>.ts.net` from a device signed in to Tailscale **as you** (not a tagged device: those send no identity, and the site rejects them). Funnel stays off.

## 5. nginx host

1. Namecheap: an **A record**, host `study`, value = your public IP.
2. Router: 443 (and 80 for certificate renewal) forwarded to `<NGINX_IP>`, which is probably already the case.
3. Copy `docker/nginx-study.conf.example` into your nginx config. Change the upstream to `server <LXC_IP>:3000;` and create `/etc/nginx/certprep-proxy.conf` from the comment at the bottom of that file. If you already have a `default_server` block, drop the one in the example.
4. Certificate: `certbot --nginx -d study.codycodez.com` (or however your other sites get theirs).
5. `nginx -t && systemctl reload nginx`.

The app trusts `X-Forwarded-For` for its rate limits. That is safe only because the firewall lets nobody but nginx reach port 3000, and nginx overwrites the header.

## 6. Backups

`/usr/local/bin/certprep-backup` (mode 755):

```bash
#!/bin/sh
set -eu
cd /srv/certprep
f="/srv/backups/certprep-$(date +%F).dump"
docker compose -f docker-compose.yml exec -T db pg_dump -U postgres -Fc certprep > "$f.tmp"
mv "$f.tmp" "$f"
find /srv/backups -name 'certprep-*.dump' -mtime +14 -delete
```

`/etc/systemd/system/certprep-backup.service`:

```
[Unit]
Description=CertPrep database dump
[Service]
Type=oneshot
ExecStart=/usr/local/bin/certprep-backup
```

`/etc/systemd/system/certprep-backup.timer`:

```
[Unit]
Description=Nightly CertPrep database dump
[Timer]
OnCalendar=*-*-* 03:30
Persistent=true
[Install]
WantedBy=timers.target
```

```bash
systemctl daemon-reload && systemctl enable --now certprep-backup.timer
systemctl start certprep-backup.service && ls -lh /srv/backups
```

**Restore drill (once, before inviting anyone):**

```bash
docker compose -f docker-compose.yml exec -T db createdb -U postgres certprep_restore
docker compose -f docker-compose.yml exec -T db pg_restore -U postgres -d certprep_restore --no-owner < /srv/backups/<latest>.dump
docker compose -f docker-compose.yml exec -T db psql -U postgres -d certprep_restore -c 'select count(*) from auth."user"'
docker compose -f docker-compose.yml exec -T db dropdb -U postgres certprep_restore
```

The dumps hold every user's data in clear form: keep the backup disk private to the Proxmox host.

## 7. Giving Claude Code access (to this LXC only)

Recommended, and better than access to the Proxmox host: I never need the host, and the firewall above keeps the container away from everything else.

On this Windows PC (PowerShell):

```powershell
ssh-keygen -t ed25519 -f "$HOME\.ssh\certprep_lxc" -C "claude-code certprep" -N '""'
Get-Content "$HOME\.ssh\certprep_lxc.pub"
```

The key has no passphrase because I can't type one; it only opens the `deploy` account on this container, and you delete it when we're done. Add to `$HOME\.ssh\config`:

```
Host certprep
  HostName <LXC_IP>
  User deploy
  IdentityFile ~/.ssh/certprep_lxc
  IdentitiesOnly yes
```

In the LXC, put that public key in `/home/deploy/.ssh/authorized_keys`. For the setup period only, allow `deploy` to use sudo:

```bash
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy-temp && chmod 440 /etc/sudoers.d/deploy-temp
```

Then tell me `ssh certprep` works, and I can do sections 3, 4 and 6 myself. When setup is finished: `rm /etc/sudoers.d/deploy-temp` (deploy keeps Docker access for future deploys), or remove the key entirely.

## 8. Checks before inviting anyone

Run these and record the results in doc 13 (they map to the [doc 11 §6](11-auth-and-tenancy.md) checklist):

| Check | Command / how | Expect |
|---|---|---|
| Postgres not listening outside Docker | `ss -tlnp` in the LXC | nothing on 5432 at `<LXC_IP>` or `0.0.0.0` |
| 3000 blocked from the LAN | from another LAN machine: `curl -m3 http://<LXC_IP>:3000` | timeout |
| 3000 open to nginx | from the nginx host: same command | HTTP response |
| LXC can't reach the LAN | in the LXC: `curl -m3 http://<some LAN host>` | timeout |
| No admin on the public site | `curl -sI https://study.codycodez.com/admin` | 404 |
| HTTPS and HSTS | `curl -sI https://study.codycodez.com` | `strict-transport-security` header |
| Dev login off | `docker compose exec web env \| grep ALLOW_DEV` | no output |
| Rate limit | 30 quick `curl`s at `/api/auth/get-session` | some 429/503 |
| Admin needs your identity | open the admin site from a device signed in as someone else, or tagged | rejected |
| Restore works | section 6 drill | row count matches |

## 9. Routine

- **Deploy an update:** `cd /srv/certprep && sh scripts/deploy.sh` (pulls `main`, builds the app and the migrate image, applies migrations, restarts web and admin, checks `/sign-in`). Build with `--profile tools`, or the migrate image keeps old migrations: `docker compose build` alone skips it.
- **Monthly:** `docker compose -f docker-compose.yml pull db ts-admin`, rebuild the app (picks up the Node base image's security fixes), `docker image prune -f`. OS updates install themselves.
- **Postgres major upgrades** (17 → 18) need a dump and restore; don't just change the image tag.
