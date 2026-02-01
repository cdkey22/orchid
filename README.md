# 🌸 Orchid API

API REST TypeScript avec MySQL, RabbitMQ et Redis

---

# Installation & Configuration

## Prérequis

| Outil | Développement | Tests d'intégration | Production |
|-------|:-------------:|:-------------------:|:----------:|
| Node.js (v18+) | ✅ | ✅ | - |
| npm | ✅ | ✅ | - |
| Docker | - | ✅ (Testcontainers) | ✅ |
| Docker Compose | Optionnel | - | ✅ |

## Installation

```bash
# Cloner le projet
git clone <repository-url>
cd orchid/service

# Installer les dépendances
npm install
```

## Configuration

Copier le fichier `.env.example` en `.env` et adapter les valeurs :

```bash
cp .env.example .env
```

Variables disponibles :

```env
# Application
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1
LOG_LEVEL=info

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tech_test
DB_USER=app_user
DB_PASSWORD=app_password
DB_CONNECTION_LIMIT=10

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
RABBITMQ_QUEUE_COMMANDE_STATUS=order.notifications
```

## Démarrer les services

### Services dépendants (Docker)

```bash
docker-compose up -d mysql redis rabbitmq
```

### Application en mode développement

```bash
cd service
npm run dev
```

L'API sera accessible sur `http://localhost:3000/api/v1`

## Scripts disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Démarrer en mode développement (hot-reload) |
| `npm run build` | Compiler le projet TypeScript |
| `npm run start` | Démarrer en mode production |
| `npm run lint` | Vérifier le code avec ESLint |
| `npm run lint:fix` | Corriger automatiquement les erreurs ESLint |
| `npm run format` | Formater le code avec Prettier |

## Tests

Le projet utilise **Jest** avec deux types de tests.

### Tests Unitaires

```bash
npm run test:unit              # Exécuter les tests unitaires
npm run test:coverage:unit     # Avec rapport de couverture
```

### Tests d'Intégration

Tests avec **Testcontainers** (MySQL + RabbitMQ + Redis dans Docker).

```bash
npm run test:integration           # Exécuter les tests d'intégration
npm run test:coverage:integration  # Avec rapport de couverture
```

**Prérequis** : Docker doit être en cours d'exécution.

#### Réutilisation des conteneurs

Les conteneurs sont configurés avec `withReuse()` pour accélérer les exécutions successives :

- **Premier run** : ~50s (démarrage des conteneurs)
- **Runs suivants** : ~20s (conteneurs réutilisés)

Testcontainers identifie les conteneurs existants via un hash de configuration stocké dans les labels Docker. Les conteneurs restent actifs entre les exécutions.

```bash
# Voir les conteneurs réutilisables
docker ps --filter "label=org.testcontainers.reuse=true"

# Arrêter manuellement les conteneurs
docker stop $(docker ps -q --filter "label=org.testcontainers.reuse=true")
```

### Tous les tests

```bash
npm run test           # Tests unitaires + intégration
npm run test:coverage  # Avec rapport de couverture complet
```

## Déploiement en production

### Construction

```bash
cd service
docker build --no-cache . -t orchid:latest
```

### Démarrage

```bash
docker-compose up                # Démarrer tous les services
docker-compose logs -f app       # Voir les logs
docker-compose ps                # Vérifier le statut
```

L'API sera accessible sur `http://localhost:8080/api/v1`

### Commandes Docker utiles

```bash
docker-compose down              # Arrêter tous les services
docker-compose logs -f mysql     # Logs d'un service spécifique
docker-compose restart app       # Redémarrer un service
```

---

# Code & Architecture

## Technologies

| Technologie | Usage |
|-------------|-------|
| **TypeScript** | Typage statique et maintenabilité |
| **Express** | Framework web |
| **MySQL** | Base de données relationnelle |
| **Redis** | Cache en mémoire |
| **RabbitMQ** | Message broker asynchrone |
| **Jest** | Tests unitaires et d'intégration |
| **Docker** | Containerisation |

## Structure du projet

```
orchid/
├── docker-compose.yml       # Orchestration des services
├── sql/
│   └── ddl.sql              # Scripts de création des tables
│
└── service/
    ├── Dockerfile
    ├── src/
    │   ├── index.ts         # Point d'entrée (démarrage serveur)
    │   ├── app.ts           # Configuration Express (middlewares, routes)
    │   ├── config/          # Configuration (database, redis, rabbitmq, logger)
    │   ├── controllers/     # Gestion des requêtes HTTP
    │   ├── services/        # Logique métier
    │   ├── dao/             # Accès aux données
    │   ├── models/          # Modèles de données
    │   ├── errors/          # Erreurs métier
    │   ├── middlewares/     # Middlewares Express
    │   └── routes/          # Définition des routes
    │
    └── tests/
        ├── unit/            # Tests unitaires (avec mocks)
        └── integration/
            ├── *.test.ts    # Tests d'intégration
            └── support/     # Infrastructure de test (Testcontainers)
```

## Architecture en couches

```
HTTP Request
    ↓
Routes          → Définition des endpoints
    ↓
Controllers     → Validation, orchestration, formatage réponses
    ↓
Services        → Logique métier
    ↓
DAO             → Accès aux données (MySQL, Redis, RabbitMQ)
```

## Choix d'implémentations

### Typage fort

Tous les champs métier utilisent des types dédiés (ex: `ClientId`, `CommandeId`, `CommandeStatus`).

Cette approche permet de :
- Valider les contraintes métier directement dans le code
- Éviter les erreurs de type à la compilation
- Rendre le code auto-documenté

Les tables MySQL sont également fortement contraintes (clés étrangères, enums) pour garantir l'intégrité des données.

### SQL natif sans ORM

Le projet n'utilise pas d'ORM. Les requêtes SQL sont écrites directement dans les DAOs.

**Avantages** :
- Contrôle total sur les requêtes
- Pas de magie cachée
- Structure de la BDD gérée via des scripts DDL indépendants (`sql/ddl.sql`)

Les migrations de schéma sont gérées en dehors du code applicatif.

### Logique métier centralisée

Toutes les règles métier sont dans la couche Service, jamais dans la base de données.

**Exemple** : L'historique des statuts (`order_history`) est géré par le code applicatif, pas par un trigger SQL.

**Pourquoi** :
- Une seule source de vérité pour les règles métier
- Code plus lisible et testable
- Légère perte de performance acceptée en contrepartie

---

# Métier

## API Endpoints

Base URL : `http://localhost:3000/api/v1`

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/version` | Informations de version de l'API |
| POST | `/commandes` | Créer une nouvelle commande |
| PATCH | `/commandes/:id/status` | Mettre à jour le statut d'une commande |

Documentation complète : [openapi.yaml](openapi.yaml)

## Workflow des statuts

Une commande suit un cycle de vie linéaire et irréversible :

```
┌──────────┐    ┌──────┐    ┌───────────┐    ┌──────┐
│ RECEIVED │ ─► │ PAID │ ─► │ PREPARING │ ─► │ SENT │
└──────────┘    └──────┘    └───────────┘    └──────┘
```

| Statut | Description |
|--------|-------------|
| `RECEIVED` | Commande reçue (statut initial à la création) |
| `PAID` | Commande payée |
| `PREPARING` | Commande en préparation |
| `SENT` | Commande expédiée (statut final) |

**Règles métier** :
- Une commande est créée avec le statut `RECEIVED`
- Les transitions ne peuvent se faire que vers l'avant (pas de retour en arrière)
- Toute tentative de transition invalide retourne une erreur `400`

**Exemples** :
- `RECEIVED` → `PAID` ✅
- `RECEIVED` → `PREPARING` ✅ (saut de statut autorisé)
- `PAID` → `RECEIVED` ❌ (retour en arrière interdit)

## Événements RabbitMQ

Un message est publié à chaque changement de statut d'une commande.

### Queue : `order.notifications`

**Configuration** : `RABBITMQ_QUEUE_COMMANDE_STATUS`

**Format du message** :
```json
{
  "clientId": 123,
  "commandeId": 1,
  "status": "RECEIVED"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| clientId | number | Identifiant du client |
| commandeId | number | Identifiant de la commande |
| status | string | Nouveau statut |

**Caractéristiques** :
- Queue durable
- Messages persistants

## Cache Redis

Le dernier statut de chaque commande est stocké dans Redis pour un accès rapide.

**Format de la clé** :
```
commande:{commandeId}:status
```

**Exemple** :
```
commande:1:status = "RECEIVED"
commande:2:status = "PAID"
```
