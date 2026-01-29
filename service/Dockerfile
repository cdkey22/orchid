# Stage 1: Construction
FROM node:24-alpine AS builder

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installation de toutes les dépendances (dev incluses)
RUN npm ci

# Copie du code source
COPY src ./src

# Compilation TypeScript
RUN npm run build

# Stage 2: Production
FROM node:24-alpine

WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation uniquement des dépendances de production
RUN npm ci --only=production

# Copie des fichiers compilés depuis le stage builder
COPY --from=builder /app/dist ./dist

# Création d'un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

# Exposition du port
EXPOSE 3000

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=3000

# Démarrage de l'application
CMD ["node", "dist/index.js"]
