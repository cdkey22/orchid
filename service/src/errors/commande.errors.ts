export class CommandeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandeError';
  }
}

export class CommandeNotFoundError extends CommandeError {
  constructor(commandeId: number) {
    super(`Commande ${commandeId} non trouvée`);
    this.name = 'CommandeNotFoundError';
  }
}

export class CommandeCreationDateInFutureError extends CommandeError {
  constructor() {
    super('La date de création est dans le futur');
    this.name = 'CommandeCreationDateInFutureError';
  }
}

export class CommandeStatusInvalid extends CommandeError {
  constructor() {
    super('Le status voulu pour la commande est invalide');
    this.name = 'CommandeStatusInvalid';
  }
}

export class CommandeDaoError extends CommandeError {
  public readonly cause: Error;

  constructor(operation: string, cause: Error) {
    super(`Erreur lors de ${operation}`);
    this.name = 'CommandeDaoError';
    this.cause = cause;
  }
}
