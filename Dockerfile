FROM node:18-alpine

# Installer les dépendances Chromium pour Playwright
RUN apk add --no-cache \
    chromium \
    noto-sans \
    tini

WORKDIR /app

# Copier les dépendances
COPY package*.json ./

# Installer npm sans brave (dev dependencies non nécessaires)
RUN npm ci --production

# Copier le code
COPY server.mjs ./
COPY public/ ./public/

# Exposer le port
EXPOSE 3311

# Utiliser tini pour gérer les signaux correctement
ENTRYPOINT ["/sbin/tini", "--"]

# Démarrer le serveur
CMD ["node", "server.mjs"]
