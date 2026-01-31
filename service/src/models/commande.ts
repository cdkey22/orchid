import { Brand } from '@/models/generic';

export type CommandeId = Brand<number, 'CommandeId'>;
export type ClientId = Brand<number, 'ClientId'>;
export type CommandeCreationDate = Brand<Date, 'CommandeCreationDate'>;

export enum CommandeStatus {
  RECEIVED = 'RECEIVED',
  PAID = 'PAID',
  PREPARING = 'PREPARING',
  SENT = 'SENT',
}

export interface Commande {
  id: CommandeId;
  clientId: ClientId;
  status: CommandeStatus;
  creationDate: CommandeCreationDate;
}
