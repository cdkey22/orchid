# Guide des Tests

Ce projet contient des tests unitaires et des tests d'intégration top-to-bottom avec MySQL Testcontainers.

## Structure des Tests

```
tests/
├── unit/                           # Tests unitaires (avec mocks)
│   ├── controllers/
│   │   └── commande.controller.test.ts
│   └── services/
│       └── commande.service.test.ts
├── integration/                    # Tests d'intégration (sans mocks, MySQL Testcontainers)
│   ├── setup/
│   │   ├── testcontainers.setup.ts # Configuration Testcontainers
│   │   └── fixtures.ts             # Données de test préconfigurées
│   ├── commande.integration.test.ts
│   └── version.test.ts
└── README.md
```

## Commandes de Test

### Tests Unitaires

Les tests unitaires utilisent des mocks et ne nécessitent pas de services externes.

```bash
# Exécuter tous les tests unitaires
npm run test:unit

# Exécuter en mode watch (développement)
npm run test:watch

# Exécuter avec couverture de code
npm run test:coverage
```

### Tests d'Intégration

Les tests d'intégration utilisent une base de données SQLite en mémoire et ne nécessitent **aucun service externe** (pas de Docker).

```bash
# Exécuter tous les tests d'intégration
npm run test:integration

# Exécuter en mode watch
npm run test:watch:integration

# Exécuter avec couverture de code
npm run test:coverage:integration
```

### Tous les Tests

```bash
# Exécuter tous les tests (unitaires + intégration)
npm run test:all

# Exécuter tous les tests avec couverture
npm run test:coverage:all
```

## Tests par Composant

### CommandeController

**Fichier :** `tests/unit/controllers/commande.controller.test.ts`

Tests couverts (11 scénarios) :
- ✅ Création de commande avec données valides
- ✅ Validation du clientId (manquant, négatif, zéro)
- ✅ Validation de la date (manquante, invalide, future)
- ✅ Gestion des erreurs du service
- ✅ Gestion des erreurs non-standard
- ✅ Validation du Content-Type JSON
- ✅ Validation de la structure de réponse

### ContentType Middleware

**Fichier :** `tests/unit/middlewares/contentType.middleware.test.ts`

Tests couverts (10 scénarios) :
- ✅ Accepte application/json
- ✅ Accepte application/json avec charset
- ✅ Rejette si Content-Type manquant (POST/PUT/PATCH)
- ✅ Rejette text/plain
- ✅ Rejette application/x-www-form-urlencoded
- ✅ Ignore GET sans Content-Type
- ✅ Ignore DELETE sans Content-Type
- ✅ Ignore OPTIONS sans Content-Type

### CommandeService

**Fichier :** `tests/unit/services/commande.service.test.ts`

Tests couverts :
- ✅ Création de commande avec date valide
- ✅ Rejet de date dans le futur
- ✅ Acceptation de date actuelle
- ✅ Propagation des erreurs du DAO

### Tests d'Intégration

**Commandes** - `tests/integration/commande.integration.test.ts`

Tests couverts (13 scénarios) :
- ✅ Création de commande complète (API → MySQL)
- ✅ Vérification de l'insertion en base de données
- ✅ Vérification de l'historique (order_history)
- ✅ Création de multiples commandes
- ✅ Validation des erreurs avec vérification DB
- ✅ Vérification de l'intégrité transactionnelle
- ✅ Validation du Content-Type (415 si non-JSON)
- ✅ Vérification des contraintes ENUM
- ✅ Status par défaut RECEIVED
- ✅ Enregistrement correct des dates

**Version** - `tests/integration/version.integration.test.ts`

Tests couverts (6 scénarios) :
- ✅ Récupération des informations de version
- ✅ Validation du format semver
- ✅ Version de Node.js
- ✅ Environnement
- ✅ Description non vide
- ✅ Content-Type JSON

*Note : Ce test ne nécessite pas de base de données, donc pas de testcontainers*

## Configuration

### Base de Données de Test avec Testcontainers

Les tests d'intégration qui nécessitent une base de données utilisent **MySQL Testcontainers** :
- ✅ Vraie base MySQL (100% compatible production)
- ✅ Pas de conversion de syntaxe nécessaire
- ✅ Isolation complète (conteneur jetable)
- ✅ Pas de MySQL à installer localement
- ✅ Utilise le même DDL que la production

**🐳 Fonctionnement de Testcontainers**

1. **Démarrage automatique** : Un conteneur MySQL est créé avant les tests (uniquement pour les tests qui en ont besoin)
2. **Initialisation** : Le script `sql/ddl.sql` est exécuté automatiquement
3. **Isolation** : Chaque suite de tests nettoie les données (TRUNCATE)
4. **Arrêt automatique** : Le conteneur est détruit après les tests

**Prérequis** : Docker doit être installé et en cours d'exécution (uniquement pour les tests touchant la DB).

✨ **Avantage** : Exactement la même base de données qu'en production, pas de différences de comportement entre les tests et la production.

**Note** : Certains tests d'intégration (comme `version.integration.test.ts`) n'utilisent pas testcontainers car ils ne nécessitent pas de base de données.


### Configurations Jest

- **jest.config.unit.js** : Configuration pour tests unitaires uniquement
- **jest.config.integration.js** : Configuration pour tests d'intégration (timeout 10s)

## Bonnes Pratiques

1. **Tests Unitaires** : Exécuter en continu en mode watch pendant le développement
2. **Tests d'Intégration** : Exécuter avant chaque commit
3. **Isolation** : Chaque test d'intégration nettoie la DB (TRUNCATE TABLE)
4. **Fixtures** : Utiliser les fixtures pour tester avec des données réalistes
5. **Docker** : Assurer que Docker est démarré avant de lancer les tests d'intégration

## Avantages de MySQL Testcontainers

- 🎯 **100% Compatible** : Vraie base MySQL identique à la production
- 🔒 **Isolé** : Conteneur jetable, aucun impact sur votre environnement
- 📦 **Autonome** : Pas besoin d'installer MySQL localement
- 🔄 **Reproductible** : Même version MySQL que la production
- 🧪 **Fiable** : Tests avec la vraie base, pas de surprises en production

## Dépannage

### Les tests d'intégration échouent avec "Cannot connect to Docker"

```bash
# Vérifier que Docker est en cours d'exécution
docker ps

# Sur Windows, assurez-vous que Docker Desktop est démarré
```

### Les tests sont lents ou timeout

```bash
# Augmenter le timeout dans jest.config.integration.js
# Le démarrage du premier conteneur peut prendre 30-60 secondes
```

### Erreur "Port already in use"

```bash
# Arrêter tous les conteneurs
docker stop $(docker ps -aq)

# Ou redémarrer Docker Desktop
```

### Nettoyer les conteneurs testcontainers

```bash
# Supprimer les conteneurs arrêtés
docker container prune

# Supprimer les images testcontainers
docker image prune -a
```

## CI/CD

Pour intégrer ces tests dans une pipeline CI/CD :

```yaml
# Exemple pour GitHub Actions
- name: Install dependencies
  run: npm ci

- name: Run all tests
  run: npm run test:all

- name: Generate coverage report
  run: npm run test:coverage:all
```

## Architecture des Tests d'Intégration

Les tests d'intégration suivent l'approche **Top to Bottom** avec une vraie base MySQL :

```
HTTP Request (supertest)
    ↓
Controller (réel)
    ↓
Service (réel)
    ↓
DAO (réel)
    ↓
MySQL Testcontainers (réel)
```

**Tout est réel**, y compris la base de données MySQL dans un conteneur Docker.
Cela garantit une fidélité maximale avec l'environnement de production.
