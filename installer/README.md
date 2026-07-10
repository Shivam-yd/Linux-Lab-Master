# Linux Labs — Installer Guide

## Ubuntu (one command)

Run this from the project root on the target machine:

```bash
sudo bash installer/install.sh
```

That's it. The script installs Docker, builds the images, pulls lab containers, and registers a systemd service that starts on boot. Open `http://localhost` when it finishes.

| Command | What it does |
|---|---|
| `sudo systemctl status linuxlabs` | Check if it's running |
| `sudo systemctl stop linuxlabs` | Stop |
| `sudo systemctl start linuxlabs` | Start |
| `journalctl -u linuxlabs -f` | Live logs |

---

# Building the Windows Installer

## What it does

The installer packages Linux Labs as a self-contained Windows application:

- Installs Docker Desktop (via winget) if not already present
- Builds all Docker images from source (Node.js API, nginx frontend, PostgreSQL)
- Pre-pulls the four lab container images so labs start instantly
- Registers a Windows service (`LinuxLabs`) that starts on boot
- Creates a desktop shortcut that opens `http://localhost` in the browser

After installation the user never touches a terminal — the service manages everything.

## Prerequisites (for building the installer, not for end users)

| Tool | Where to get it |
|---|---|
| [Inno Setup 6](https://jrsoftware.org/isinfo.php) | Free, ~5 MB |
| [WinSW v3](https://github.com/winsw/winsw/releases) | Download `WinSW-x64.exe`, rename to `WinSW.exe`, place in this folder |

## Build steps

1. Install Inno Setup 6
2. Download `WinSW-x64.exe` from https://github.com/winsw/winsw/releases/latest  
   and save it as `installer\WinSW.exe`
3. Open `installer\setup.iss` in the Inno Setup IDE
4. Press **Ctrl+F9** (Build → Compile)
5. The installer is written to `installer\Output\LinuxLabs-Setup.exe`

## What the installer bundles

- The entire project source tree (needed by Docker to build images)
- `WinSW.exe` (Windows service wrapper)
- `docker-compose.yml` and `Dockerfile` (at the project root)
- `installer\nginx.conf` (copied into the web Docker image at build time)

## End-user requirements

- Windows 10 (build 17763) or Windows 11
- Virtualization enabled in BIOS (required by Docker Desktop)
- Internet connection during installation (for Docker Desktop + image pulls)
- ~10 GB free disk space (Docker images + build cache)

## Service management (for end users)

| Action | How |
|---|---|
| Start | Services → Linux Labs → Start, or `net start LinuxLabs` |
| Stop | Services → Linux Labs → Stop, or `net stop LinuxLabs` |
| Logs | `C:\Program Files\LinuxLabs\LinuxLabs.out.log` |
| Uninstall | Add/Remove Programs → Linux Labs |

## Architecture

```
Browser → nginx:80
            ├── /api/*  →  api:8080  (Node.js + Express)
            └── /*      →  static files (React build)

api:8080  →  postgres:5432  (schema auto-migrated on each start)
api:8080  →  /var/run/docker.sock  (spawns lab containers on the host)
```

The Windows service runs `docker compose up --no-build`.  
Images are built once during installation and reused on every subsequent start.
