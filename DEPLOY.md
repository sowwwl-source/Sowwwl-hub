# SOWWWL Mosaic Monitor - Déploiement

## 🚀 Déploiement local rapide

```bash
npm install
npm run start
open http://localhost:3311
```

## 🐳 Déploiement Docker sur VPS

### 1. Préparer ton repo GitHub

```bash
git add .
git commit -m "deploy sowwwl.org with Docker + Caddy"
git push
```

### 2. Créer un VPS Ubuntu 24.04

- DigitalOcean Droplet ou OVH Cloud
- Configuré avec clé SSH

### 3. Pointer le domaine vers le VPS

Dans ton DNS (OVH, Cloudflare, etc.):
```
A   @     IP_DU_VPS
A   www   IP_DU_VPS
```

### 4. Installer Docker sur le VPS

```bash
ssh root@IP_DU_VPS

# Installer Docker (procédure officielle Ubuntu 24.04)
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run hello-world
```

### 5. Déployer l'app

```bash
mkdir -p /srv/sowwwl
cd /srv/sowwwl
git clone https://github.com/0o0o0o0o0o0o0o0o0o0/brasdefer.git app
cd app
sudo docker compose up -d --build
```

### 6. Vérifier le déploiement

```bash
sudo docker compose ps
sudo docker compose logs -f app
sudo docker compose logs -f caddy
curl http://127.0.0.1:3311/healthz
```

Puis ouvre: `https://sowwwl.org`

## ⚙️ Configuration

- **Port local:** 3311
- **Capture:** 1 fps, décalage 11ms entre domaines
- **Domaines captifs:**
  - sowwwl.com
  - sowwwl.art
  - sowwwl.net
  - sowwwl.fr
  - sowwwl.cloud

## 📝 Mises à jour après déploiement

```bash
cd /srv/sowwwl/app
git pull
sudo docker compose up -d --build
sudo docker compose logs -f app
```

## 🆘 Problèmes courants

**Caddy n'émet pas le certificat:**
- Vérifie que le domaine pointe vraiment vers l'IP
- Vérifie que les ports 80/443 sont accessibles
- Attends ~1 minute après la propagation DNS

**App ne démarre pas:**
```bash
sudo docker compose logs app
```

**Port 3311 déjà utilisé:**
```bash
# Modifier docker-compose.yml ligne ports:
# - "3312:3311"  # au lieu de 3311:3311
```

## 🔗 Ressources

- Docker Engine: https://docs.docker.com/engine/install/ubuntu/
- Caddy: https://caddyserver.com/docs/
- Playwright: https://playwright.dev/docs/intro
