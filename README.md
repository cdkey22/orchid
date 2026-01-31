# 🌸 Orchid API

API REST TypeScript avec MySQL, RabbitMQ et Redis

## Prérequis

| Outil | Développement | Tests d'intégration | Production |
|-------|:-------------:|:-------------------:|:----------:|
| Node.js (v18+) | ✅ | ✅ | - |
| npm | ✅ | ✅ | - |
| Docker | - | ✅ (Testcontainers) | ✅ |
| Docker Compose | Optionnel | - | ✅ |

## Environnement de développement

### Installation

```bash
# Cloner le projet
git clone <repository-url>
cd orchid/service

# Installer les dépendances
npm install
```

### Configuration

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
RABBITMQ_QUEUE_COMMANDE_STATUS=commande.status.changed
```

### Démarrer les services dépendants (pour tester pendant la phase de développement )

```bash
# Démarrer uniquement MySQL, Redis et RabbitMQ avec Docker
docker-compose up -d mysql redis rabbitmq
```

### Lancer l'application en mode développement

```bash
cd service
npm run dev
```

L'API sera accessible sur `http://localhost:3000/api/v1`

### Scripts de développement

- `npm run dev` - Démarrer le serveur en mode développement avec hot-reload
- `npm run build` - Compiler le projet TypeScript
- `npm run lint` - Vérifier le code avec ESLint
- `npm run lint:fix` - Corriger automatiquement les erreurs ESLint
- `npm run format` - Formater le code avec Prettier

## Tests

Le projet utilise **Jest** avec deux types de tests :

### Tests Unitaires

Tests isolés avec mocks, sans dépendances externes.

```bash
npm run test:unit          # Exécuter les tests unitaires
npm run test:watch         # Mode watch (développement)
npm run test:coverage      # Avec rapport de couverture
```

### Tests d'Intégration

Tests top-to-bottom avec **Testcontainers** (MySQL + RabbitMQ + Redis dans Docker).

```bash
npm run test:integration             # Exécuter les tests d'intégration
npm run test:integration:keep-alive  # Garder les conteneurs actifs après les tests
npm run test:watch:integration       # Mode watch
npm run test:coverage:integration    # Avec rapport de couverture
```

**Prérequis** : Docker doit être en cours d'exécution.

#### Optimisation des temps d'exécution

Les conteneurs Docker sont configurés avec l'option `reuse` pour être réutilisés entre les exécutions de tests. Pour activer cette fonctionnalité, créer le fichier `~/.testcontainers.properties` :

```properties
testcontainers.reuse.enable=true
```

**Chemin** :
`~/.testcontainers.properties`

**Garder les conteneurs actifs** :

Par défaut, les conteneurs sont arrêtés à la fin des tests. Pour les garder actifs (utile en développement) :

```bash
# Via le script npm
npm run test:integration:keep-alive

# Ou via la variable d'environnement
TESTCONTAINERS_KEEP_ALIVE=true npm run test:integration
```

**Avantages** :
- Premier run : Les conteneurs sont démarrés en parallèle
- Runs suivants : Les conteneurs existants sont réutilisés (gain significatif)

**Arrêter les conteneurs manuellement** :
```bash
npm run test:containers:stop
```

Les tests d'intégration vérifient :
- L'insertion en base de données MySQL
- La publication des messages dans RabbitMQ
- Le stockage du statut dans Redis

### Tous les Tests

```bash
npm run test:all           # Tests unitaires + intégration
npm run test:coverage:all  # Avec rapport de couverture complet
```

### Architecture des Tests

```
tests/
├── unit/                    # Tests unitaires (avec mocks)
│   └── services/
└── integration/             # Tests d'intégration (MySQL Testcontainers)
    ├── setup/
    │   └── testcontainers.setup.ts
    ├── commande.integration.test.ts
    └── version.integration.test.ts
```

### Pourquoi Testcontainers ?

- **100% compatible production** : Vraie base MySQL, pas de SQLite
- **Isolé** : Conteneur jetable, aucun impact sur l'environnement
- **Reproductible** : Même version MySQL que la production
- **Autonome** : Pas besoin d'installer MySQL localement

## Déploiement en production

**Le déploiement en production utilise obligatoirement Docker.**

### Construction

```bash
cd service
docker build --no-cache . -t orchid:latest
```

### Démarrage

```bash
# Construire et démarrer tous les services
docker-compose up

# Vérifier les logs
docker-compose logs -f app

# Vérifier le statut des services
docker-compose ps
```

L'API sera accessible sur `http://localhost:8080/api/v1`

### Commandes Docker utiles

```bash
# Arrêter tous les services
docker-compose down

# Voir les logs d'un service spécifique
docker-compose logs -f mysql

# Redémarrer un service
docker-compose restart app
```

## Structure du projet

```
orchid/
├── docker-compose.yml       # Orchestration des services (app, mysql, redis, rabbitmq)
├── sql/
│   └── ddl.sql              # Scripts de création des tables
│
└── service/
    ├── Dockerfile           # Image Docker de l'application
    ├── src/
    │   ├── index.ts         # Point d'entrée Express
    │   ├── config/
    │   │   ├── database.ts  # Pool de connexions MySQL
    │   │   ├── rabbitmq.ts  # Connexion RabbitMQ
    │   │   ├── redis.ts     # Connexion Redis
    │   │   └── logger.ts    # Configuration Winston
    │   ├── controllers/     # Gestion des requêtes HTTP
    │   │   └── types/       # Types utilitaires API
    │   ├── services/        # Logique métier
    │   ├── dao/             # Accès aux données (MySQL, Redis, RabbitMQ)
    │   ├── models/          # Modèles de données
    │   │   ├── dto/         # Data Transfer Objects (API)
    │   │   └── bo/          # Business Objects
    │   ├── middlewares/     # Middlewares Express
    │   └── routes/          # Définition des routes
    │
    └── tests/
        ├── unit/            # Tests unitaires (avec mocks)
        │   └── services/
        └── integration/     # Tests d'intégration (Testcontainers)
            └── setup/       # Configuration Testcontainers
```

### Architecture en couches

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

- Typage fort

Tous les champs métier sont typés avec un type dédié. 
Cette approche issue du BDD (Behaviour Driven Development) permet d'implémenter les contraintes métiers au sein du code de façon structurelle.

De plus la description des tables de la BDD (Base de données) sont très contraintes afin de garantir l'intégritée maximale des données.

- Séparation des données et SQL Natif

Pour ce projet nous n'allons pas utiliser d'ORM et décorréler toute la maintenance applicative de la BDD du code. 

Toutes la partie structure de la BDD est dans des scripts dédiées. 
Les éventuelles migrations techniques (modification de tables, ajout de tables, ...) seront gérée hors du code applicatif.

- Pas de code métier dans la persistence

Afin de ne pas avoir de règles métier un peu partout, l'ensemble des règles métiers sera centralisée dans l'applicatif.

Ainsi le remplissage de la table order_history ne serra pas gérer via une procèdure stockée dans la BDD. 

La très lègere perte de performance induite par ce choix, se justifie par la centralisation et une meilleure lisibilités des règles métiers.

Cette règle pourra évoluer en fonction des contraintes de performance 


## Technologies

- **TypeScript** - Typage statique et meilleure maintenabilité du code
- **Express** - Framework web 
- **MySQL** - Base de données relationnelle pour la persistance
- **Redis** - Cache en mémoire pour améliorer les performances
- **RabbitMQ** - Message broker pour la gestion des files d'attente asynchrones
- **Jest** - Framework de tests unitaires et d'intégration
- **Docker** - Containerisation pour un déploiement simplifié

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

**Exemple de transitions valides** :
- `RECEIVED` → `PAID` ✅
- `RECEIVED` → `PREPARING` ✅ (saut de statut autorisé)
- `PAID` → `RECEIVED` ❌ (retour en arrière interdit)

## Événements RabbitMQ

Un message est publiée à chaque changement de statut d'une commande.

### Queue : `commande.status.changed` (configurable)

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
| status | string | Nouveau statut (`RECEIVED`, `PAID`, `PREPARING`, `SENT`) |

**Caractéristiques** :
- Queue durable
- Messages persistants
- Publiée lors de la création d'une commande (statut `RECEIVED`)

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

Le statut est mis à jour à chaque changement de statut d'une commande.
