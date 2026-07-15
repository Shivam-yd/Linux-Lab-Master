<div align="center">

# 🖥️ Linux Lab Master

**A self-hosted, hands-on DevOps lab platform — spin up real sandboxes and learn by doing.**

[![Tracks](https://img.shields.io/badge/Tracks-Linux%20·%20Terraform%20·%20Jenkins%20·%20Docker%20·%20Git-22d3ee?style=flat-square)](#-lab-tracks)
[![Labs](https://img.shields.io/badge/Labs-78%2B-10b981?style=flat-square)](#-lab-tracks)
[![Platform](https://img.shields.io/badge/Platform-Ubuntu%20·%20Windows-6366f1?style=flat-square)](#-installation)

</div>

---

## What Is This?

Linux Lab Master is a self-hosted web application that provides **browser-based terminal sandboxes** for practising real DevOps skills. Every lab drops you into a live Docker container with a pre-configured environment — no cloud account, no local tool installs, no setup friction.

- **Write real commands** in a real shell — not multiple choice questions
- **Automatic verification** checks your work and tells you exactly what passed or failed
- **Progressive curriculum** — Foundation → Intermediate → Advanced within each track
- **Self-hosted** — runs entirely on your own machine or server, air-gapped friendly

---

## 🗂 Lab Tracks

| Track | Levels | Labs | What you'll learn |
|-------|--------|------|-------------------|
| **Linux** | L1 · L2 · L3 | 29 | Filesystem, processes, networking, permissions, scripting, system administration |
| **Terraform** | L1 · L2 · L3 | 48+ | Infrastructure as Code — variables, modules, state, workspaces, lifecycle rules |
| **Jenkins** | L1 | 5 | CI/CD fundamentals — server setup, plugins, user access, jobs, folders |
| **Docker** | L1 | 5 | Images, containers, exec/logs, Dockerfiles, volumes — all taught via a realistic in-sandbox simulator |
| **Git** | L1 | 5 | Init, commits, branching, remotes, stash & reset |

> Labs are fetched directly from this repository. Click **Fetch Labs** inside the app at any time to pull the latest content without restarting.

---

## 🚀 Installation

### Prerequisites (both platforms)

- **Docker** — the app and every lab sandbox run inside Docker containers
- **4 GB RAM** minimum (8 GB recommended)
- **10 GB free disk space** (Docker images + build cache)
- Internet connection during installation (images are pulled once; after that the app is fully offline)

---

### 🐧 Linux — Ubuntu (Recommended)

Supported: **Ubuntu 20.04 LTS**, **22.04 LTS**, **24.04 LTS**

**1. Clone the repository**

```bash
git clone https://github.com/Shivam-yd/Linux-Lab-Master.git
cd Linux-Lab-Master
```

**2. Run the installer**

```bash
sudo bash installer/install.sh
```

The installer will:
1. Install Docker Engine + Compose plugin (if not already installed)
2. Copy the project to `/opt/linuxlabs`
3. Generate random secrets and write them to `/opt/linuxlabs/.env`
4. Build Docker images (~3–5 minutes on first run)
5. Pre-pull all lab sandbox images so labs start instantly
6. Install and start a **systemd service** that auto-starts on boot

**3. Open the app**

```
http://localhost:8085 or http://ServerIP:8085
```

#### Managing the service

```bash
sudo systemctl status  linuxlabs   # check status
sudo systemctl stop    linuxlabs   # stop
sudo systemctl start   linuxlabs   # start
sudo systemctl restart linuxlabs   # restart
journalctl -u linuxlabs -f         # live logs
```

#### Files and config

| Path | Purpose |
|------|---------|
| `/opt/linuxlabs` | Application files |
| `/opt/linuxlabs/.env` | Secrets (auto-generated, do not edit manually) |
| `journalctl -u linuxlabs` | Application logs |

---

### 🪟 Windows — Windows 10 / Windows Server 2019+

> **Note:** The Windows installer is built with [Inno Setup](https://jrsoftware.org/isinfo.php). A pre-compiled `.exe` is provided in [Releases](../../releases).

#### End-user installation (pre-compiled installer)

**Prerequisites:**
- Windows 10 (build 17763+) or Windows Server 2019+
- [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) installed and running
- Virtualisation enabled in BIOS/UEFI (required by Docker Desktop)

**Steps:**

1. Install **Docker Desktop** and ensure it is running (whale icon in system tray)
2. Download `LinuxLabs-Setup.exe` from [Releases](../../releases)
3. Right-click → **Run as administrator**
4. Follow the wizard — the installer will:
   - Copy all project files to `C:\Program Files\LinuxLabs\`
   - Generate secrets and write `C:\Program Files\LinuxLabs\.env`
   - Build Docker images (~3–5 minutes)
   - Pre-pull all lab sandbox images
   - Register a **Windows service** (`LinuxLabs`) set to start automatically
   - Create a desktop shortcut that opens the app in your browser
5. When the wizard finishes, open **http://localhost:8085** in your browser

#### Managing the Windows service

```powershell
# From an elevated PowerShell or Command Prompt:
net start  LinuxLabs        # start
net stop   LinuxLabs        # stop
sc query   LinuxLabs        # check status

# Or via Services panel:
# Win+R → services.msc → find "Linux Labs" → Start / Stop / Restart
```

#### Logs (Windows)

```
C:\Program Files\LinuxLabs\LinuxLabs.out.log
C:\Program Files\LinuxLabs\LinuxLabs.err.log
```

#### Building the installer from source

| Tool | Where to get it |
|------|----------------|
| [Inno Setup 6](https://jrsoftware.org/isinfo.php) | Free, ~5 MB |
| [WinSW v3](https://github.com/winsw/winsw/releases) | Download `WinSW-x64.exe`, rename to `WinSW.exe`, place in `installer\` |

```
1. Install Inno Setup 6
2. Place WinSW.exe in the installer\ folder
3. Open installer\setup.iss in the Inno Setup IDE
4. Press Ctrl+F9 to compile
5. Installer is written to installer\Output\LinuxLabs-Setup.exe
```

---

## 🔄 Fetching New Labs

Labs are stored as YAML files in this repository under `labs/`. When new labs are pushed, open the app and click **Fetch Labs** in the top-right corner — it pulls the latest YAML files and syncs them into the database instantly, no restart required.

The app also polls for new labs automatically every hour.

---

## 🗄 Architecture

```
Browser
  └── nginx :80
        ├── /api/*  →  Node.js API (Express)  :8080
        │                └── Docker daemon (lab sandboxes)
        └── /*      →  React frontend (static build)

PostgreSQL :5432   — stores labs, progress, session data
```

All components run as Docker containers managed by `docker compose`. Lab sandboxes are additional containers spawned on demand by the API when a student clicks **Deploy Sandbox**.

---

## 📁 Repository Structure

```
.
├── labs/
│   ├── linux/          ← Linux track YAML lab definitions
│   ├── terraform/      ← Terraform track YAML lab definitions
│   └── jenkins/        ← Jenkins track YAML lab definitions
├── artifacts/
│   ├── api-server/     ← Node.js/Express backend
│   └── linux-labs/     ← React frontend
├── installer/
│   ├── install.sh      ← Ubuntu one-shot installer
│   ├── setup.iss       ← Inno Setup script (Windows installer source)
│   └── nginx.conf      ← nginx config bundled into the web Docker image
└── docker-compose.yml  ← Production service definitions
```

---

## 🤝 Contributing Labs

Labs are plain YAML files — no code changes needed to add new content.

1. Fork this repository
2. Create a new `.yaml` file under `labs/<track>/`
3. Follow the lab schema (see any existing lab for reference — key fields: `id`, `track`, `level`, `category`, `difficulty`, `order`, `instructions`, `setupScript`, `verifyScript`)
4. Ensure `## Steps` is a heading in `instructions` — everything under it is hidden behind the *Reveal Step-by-Step Guide* button
5. Test your `verifyScript` locally with `docker run --rm --init ubuntu:24.04 bash -lc '...'`
6. Open a pull request

---

## 📄 License

MIT
