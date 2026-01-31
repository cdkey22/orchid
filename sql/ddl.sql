-- Table des commandes
CREATE TABLE IF NOT EXISTS orders
(
    id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    client_id     BIGINT UNSIGNED NOT NULL,
    status        ENUM('RECEIVED', 'PAID', 'PREPARING', 'SENT') NOT NULL,
    creation_date DATETIME NOT NULL
);

-- Table d'historique
-- Il ne me semble pas nécessaire de gérer un id sur cette table (choix discutable si on veut respecter les formes normales)
CREATE TABLE IF NOT EXISTS order_history
(
    order_id    BIGINT UNSIGNED NOT NULL,
    status      ENUM('RECEIVED', 'PAID', 'PREPARING', 'SENT') NOT NULL,
    change_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_history_order
        FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
);