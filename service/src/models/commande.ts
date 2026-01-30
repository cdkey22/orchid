export type CommandeId = bigint;
export type ClientId = bigint;
export type CommandeCreationDate = bigint;

export enum CommandeStatus {
    RECEIVED = "RECEIVED",
    PAID = "PAID",
    PREPARING = "PREPARING",
    SENT = "SENT",
}

export interface Commande {
    id: CommandeId;
    clientId: ClientId;
    status: CommandeStatus;
    creationDate: CommandeCreationDate;
}
