# 🌸 Orchid API

API REST TypeScript avec MySQL, RabbitMQ et Redis

## Prérequis

### Pour le développement
- Node.js (v18 ou supérieur)
- npm ou yarn
- Accès à MySQL, Redis et RabbitMQ (via Docker ou installation locale)

### Pour la production
- Docker et Docker Compose (obligatoire)

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

Toute la configuration est dans le fichier `.env` :
```env
NODE_ENV=development
PORT=3000
API_PREFIX=/api/v1

# MySQL
DB_HOST=localhost
DB_PORT=3306
DB_NAME=tech_test
DB_USER=root
DB_PASSWORD=root_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USER=guest
RABBITMQ_PASSWORD=guest
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
- `npm test` - Lancer les tests
- `npm run test:watch` - Lancer les tests en mode watch
- `npm run test:coverage` - Générer le rapport de couverture des tests
- `npm run lint` - Vérifier le code avec ESLint
- `npm run lint:fix` - Corriger automatiquement les erreurs ESLint
- `npm run format` - Formater le code avec Prettier

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
src/
├── controllers/    # Contrôleurs REST - Gèrent les requêtes HTTP et retournent les réponses
├── services/       # Services métier - Contiennent la logique métier de l'application
├── dao/            # Couche données - Gèrent l'accès en lecture et en écriture à tous les système tiers de gestion de données (MySQL, Redis, RabbitMQ)
├── models/         # Modèles de données métiers
│   └── dto/        # Défini les modèles utilisée par l'api REST
│   └── bo/         # Défini les objets metiers 
├── routes/         # Définition des routes API et mapping vers les contrôleurs
└── index.ts        # Point d'entrée de l'application - Configuration Express et middlewares

tests/
└── integration/    # Tests d'intégration des endpoints API

service/
└── Dockerfile      # Configuration Docker pour la construction de l'image
```

### Architecture

L'application suit une architecture en couches :
- **Routes** : Définissent les endpoints et valident les requêtes
- **Controllers** : Orchestrent les appels aux services et formatent les réponses
- **Services** : Contiennent la logique métier et orchestrent les accès aux données
- **DAO** : Gèrent l'accès aux sources de données (MySQL, Redis, RabbitMQ)
- **Models/DTO** : Définissent les structures de données typées

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

### Version
- `GET /api/v1/version` - Retourne les informations de version de l'API
