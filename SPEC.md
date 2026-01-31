# Test technique

## Contexte

L'objectif est de réaliser un petit service backend qui gère le statut des
commandes. Lorsqu'une commande change d'état, le système doit notifier les
clients de manière asynchrone et mettre à jour un cache de lecture.

## Spécifications

Le service doit exposer une route (API REST HTTP) permettant de créer une
nouvelle commande. Cette route a pour vocation d'être appelée par des services
tiers (fictifs). Les deux paramètres de cette route sont : l’identifiant du
client (entier strictement positif) et la date de création de la commande
(format ISO8601, exemple : 2026-01-20T14:29:50Z). Le retour de cette route doit
indiquer l’identifiant de la commande créée. Le contenu de la commande n’est pas
modélisé ici.

Le service doit exposer une route (API REST HTTP) permettant de modifier le
statut d'une commande. Cette route a pour vocation d'être appelée par des
services tiers (fictifs). Les deux paramètres de cette route sont :
l’identifiant de la commande et le nouveau status. Cette route ne retourne pas
d’information particulière.

Les quatre statuts d'une commande sont : Prise en compte, Paiement reçu,
En préparation et Expédiée. Le statut d'une commande ne doit pas pouvoir revenir
en arrière (exemple une commande avec le statut Paiement reçu ne peut évoluer
qu’en statut En préparation).

Les commandes sont enregistrés dans une table `orders`.

Chaque changement de statut doit être enregistré dans une table `order_history`.

Le dernier statut de la commande doit être aussi enregistré dans Redis pour un
accès instantané par des services tiers (fictifs).

Publier un message dans une queue (RabbitMQ) `order.notifications` pour chaque
changement de statut, afin qu'un service tiers (fictif) puisse envoyer un email.
Le contenu du message doit être au format JSON. Les messages sont visibles sur
l'interface de management de RabbitMQ (http://127.0.0.1:15672).

### Logiciels

Les logiciels suivants sont à utiliser :

Node.js, Typescript, express (node package), mysql (node package), MySQL,
RabbitMQ, Redis.

L'utilisation de node packages additionnels est acceptée.

### Docker Compose

Le squelette de fichier ```docker-compose.yml``` à étendre avec le service :

    services:
      mysql:
        image: mysql:8.0
        environment:
          MYSQL_DATABASE: tech_test
          MYSQL_ROOT_PASSWORD: root_password
        ports:
          - "3306:3306"
      redis:
        image: redis:7-alpine
        ports:
          - "6379:6379"
      rabbitmq:
        image: rabbitmq:3-management
        ports:
          - "5672:5672"
          - "15672:15672"
        environment:
          RABBITMQ_DEFAULT_USER: guest
          RABBITMQ_DEFAULT_PASS: guest

## Livrable

Le livrable est un dépôt ```git```.

Le livrable fournit le nécessaire pour démarrer MySQL, RabbitMQ, Redis et
le service écrit en Typescript.

Le fichier ```README.md``` décrit les étapes nécessaires pour démarrer
l'application, initialiser la base de données MySQL, etc..

Le fichier ```docker-compose.yml``` permet de démarrer les différents
containers.

Le répertoire ```service``` contient les sources Typescript du service.

Le fichier ```service/Dockerfile``` permet la construction de l'image docker du
service.

## Évaluation

Les éléments suivants seront évalués :

- la capacité à se conformer aux instructions,
- la capacité à écrire du code de qualité professionnelle,
- la présence de tests automatisés.

Le code doit être maintenable (ajout de nouveaux statuts, ajout ou modification
de pré-conditions, etc.).