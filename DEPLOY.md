# SOWWWL hub deploy

## 1. Ouvrir le projet dans VS Code

Dans le terminal integre de VS Code:

```bash
cd "/Users/pabloespallergues/Documents/Sowwwl.org HUB MOSAIC/sowwwl-mosaic-monitor/Sowwwl-hub"
```

## 2. Lancer le hub en local

Si Node est installe sur ton Mac:

```bash
npm install
npm run start
open http://localhost:3311
```

Ne tape pas `http://localhost:3311` seul dans le terminal. Il faut faire `open http://localhost:3311`.

Quand le serveur Node tourne maintenant:

```text
/        -> facade publique habitee avec fond sowwwl-pi via /camera/live
/hub/    -> moniteur capture + mosaïque Playwright
```

## 3. Envoyer le code sur GitHub

```bash
git add .
git commit -m "Prepare sowwwl.org hub deploy"
git push origin "$(git branch --show-current)"
```

## 4. Pointer le DNS OVH vers le VPS

Ajoute ces deux enregistrements:

```text
A   @     IP_DU_VPS
A   www   IP_DU_VPS
```

Attends que `sowwwl.org` resolve bien vers l IP du serveur avant de lancer Caddy.

## 5. Installer Docker sur le VPS Ubuntu

Dans le terminal VS Code:

```bash
ssh root@IP_DU_VPS
```

Puis sur le serveur:

```bash
apt update
apt install -y ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources >/dev/null <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
docker run hello-world
```

## 6. Deployer le repo sur le VPS

```bash
mkdir -p /srv/sowwwl
cd /srv/sowwwl
git clone https://github.com/0o0o0o0o0o0o0o0o0o0/brasdefer.git app
cd app
docker compose up -d --build
docker compose ps
docker compose logs --tail=120 app caddy
```

Le hub sera ensuite disponible sur:

```text
https://sowwwl.org
```

Et le moniteur interne restera visible sur:

```text
https://sowwwl.org/hub/
```

## 7. Mettre a jour plus tard

```bash
cd /srv/sowwwl/app
git pull
docker compose up -d --build
docker compose logs --tail=120 app caddy
```

## 8. Si ca bloque

Copie-moi ces sorties:

```bash
git status
docker compose ps
docker compose logs --tail=120 app caddy
```
