import { CommandeService } from '@/services/commande.service';
import { CommandeBddDao } from '@/dao/commande/bdd';
import { CommandeRabbitmqDao } from '@/dao/commande/rabbitmq';
import { CommandeRedisDao } from '@/dao/commande/redis';
import { ClientId, CommandeCreationDate, CommandeId, CommandeStatus } from '@/models/commande';
import {
  CommandeCreationDateInFutureError,
  CommandeDaoError,
  CommandeNotFoundError,
  CommandeStatusInvalid,
} from '@/errors/commande.errors';

jest.mock('@/dao/commande/bdd');
jest.mock('@/dao/commande/rabbitmq');
jest.mock('@/dao/commande/redis');

describe('CommandeService', () => {
  let commandeService: CommandeService;
  let mockBddCommandeDao: jest.Mocked<CommandeBddDao>;
  let mockRabbitmqCommandeDao: jest.Mocked<CommandeRabbitmqDao>;
  let mockRedisCommandeDao: jest.Mocked<CommandeRedisDao>;

  beforeEach(() => {
    mockBddCommandeDao = new CommandeBddDao() as jest.Mocked<CommandeBddDao>;
    mockRabbitmqCommandeDao = new CommandeRabbitmqDao() as jest.Mocked<CommandeRabbitmqDao>;
    mockRedisCommandeDao = new CommandeRedisDao() as jest.Mocked<CommandeRedisDao>;
    commandeService = new CommandeService();
    (commandeService as any).bddCommandeDao = mockBddCommandeDao;
    (commandeService as any).rabbitmqCommandeDao = mockRabbitmqCommandeDao;
    (commandeService as any).redisCommandeDao = mockRedisCommandeDao;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCommande', () => {
    it('devrait créer une commande avec une date valide', async () => {
      const clientId = 123 as ClientId;
      const creationDate = new Date('2024-01-15T10:00:00Z') as CommandeCreationDate;

      const mockCommande = {
        id: 1,
        clientId,
        status: CommandeStatus.RECEIVED,
        creationDate,
      };

      mockBddCommandeDao.createCommande = jest.fn().mockResolvedValue(mockCommande);
      mockRedisCommandeDao.setStatus = jest.fn().mockResolvedValue(undefined);
      mockRabbitmqCommandeDao.publishStatusChange = jest.fn().mockResolvedValue(undefined);

      const result = await commandeService.createCommande(clientId, creationDate);

      expect(mockBddCommandeDao.createCommande).toHaveBeenCalledWith(clientId, creationDate);
      expect(mockRedisCommandeDao.setStatus).toHaveBeenCalledWith(mockCommande.id, mockCommande.status);
      expect(mockRabbitmqCommandeDao.publishStatusChange).toHaveBeenCalledWith(
        mockCommande.id,
        mockCommande.clientId,
        mockCommande.status
      );
      expect(result).toEqual(mockCommande);
    });

    it('devrait lever CommandeCreationDateInFutureError avec une date dans le futur', async () => {
      const clientId = 123 as ClientId;
      const futureDate = new Date(Date.now() + 86400000) as CommandeCreationDate; // +1 jour

      await expect(commandeService.createCommande(clientId, futureDate)).rejects.toThrow(
        CommandeCreationDateInFutureError
      );

      expect(mockBddCommandeDao.createCommande).not.toHaveBeenCalled();
    });

    it('devrait lever CommandeDaoError en cas d\'erreur du DAO', async () => {
      const clientId = 123 as ClientId;
      const creationDate = new Date('2024-01-15T10:00:00Z') as CommandeCreationDate;

      mockBddCommandeDao.createCommande = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(commandeService.createCommande(clientId, creationDate)).rejects.toThrow(
        CommandeDaoError
      );
    });
  });

  describe('updateStatus', () => {
    it('devrait mettre à jour le statut avec succès', async () => {
      const commandeId = 1 as CommandeId;
      const clientId = 123 as ClientId;
      const currentStatus = CommandeStatus.RECEIVED;
      const newStatus = CommandeStatus.PAID;

      const existingCommande = {
        id: commandeId,
        clientId,
        status: currentStatus,
        creationDate: new Date('2024-01-15T10:00:00Z'),
      };

      mockBddCommandeDao.findById = jest.fn().mockResolvedValue(existingCommande);
      mockBddCommandeDao.updateStatus = jest.fn().mockResolvedValue(undefined);
      mockRedisCommandeDao.setStatus = jest.fn().mockResolvedValue(undefined);
      mockRabbitmqCommandeDao.publishStatusChange = jest.fn().mockResolvedValue(undefined);

      const result = await commandeService.updateStatus(commandeId, newStatus);

      expect(mockBddCommandeDao.findById).toHaveBeenCalledWith(commandeId);
      expect(mockBddCommandeDao.updateStatus).toHaveBeenCalledWith(commandeId, newStatus);
      expect(mockRedisCommandeDao.setStatus).toHaveBeenCalledWith(commandeId, newStatus);
      expect(mockRabbitmqCommandeDao.publishStatusChange).toHaveBeenCalledWith(
        commandeId,
        clientId,
        newStatus
      );
      expect(result.status).toBe(newStatus);
    });

    it('devrait lever CommandeNotFoundError si la commande n\'existe pas', async () => {
      const commandeId = 999 as CommandeId;
      const newStatus = CommandeStatus.PAID;

      mockBddCommandeDao.findById = jest.fn().mockResolvedValue(null);

      await expect(commandeService.updateStatus(commandeId, newStatus)).rejects.toThrow(
        CommandeNotFoundError
      );

      expect(mockBddCommandeDao.updateStatus).not.toHaveBeenCalled();
      expect(mockRedisCommandeDao.setStatus).not.toHaveBeenCalled();
      expect(mockRabbitmqCommandeDao.publishStatusChange).not.toHaveBeenCalled();
    });

    it('devrait lever CommandeDaoError en cas d\'erreur du DAO', async () => {
      const commandeId = 1 as CommandeId;
      const newStatus = CommandeStatus.PREPARING;

      const existingCommande = {
        id: commandeId,
        clientId: 123 as ClientId,
        status: CommandeStatus.RECEIVED,
        creationDate: new Date('2024-01-15T10:00:00Z'),
      };

      mockBddCommandeDao.findById = jest.fn().mockResolvedValue(existingCommande);
      mockBddCommandeDao.updateStatus = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(commandeService.updateStatus(commandeId, newStatus)).rejects.toThrow(
        CommandeDaoError
      );
    });

    it('devrait lever CommandeStatusInvalid si le workflow de statut est invalide', async () => {
      const commandeId = 1 as CommandeId;
      const currentStatus = CommandeStatus.PAID;
      const invalidNewStatus = CommandeStatus.RECEIVED; // Retour en arrière interdit

      const existingCommande = {
        id: commandeId,
        clientId: 123 as ClientId,
        status: currentStatus,
        creationDate: new Date('2024-01-15T10:00:00Z'),
      };

      mockBddCommandeDao.findById = jest.fn().mockResolvedValue(existingCommande);

      await expect(commandeService.updateStatus(commandeId, invalidNewStatus)).rejects.toThrow(
        CommandeStatusInvalid
      );

      expect(mockBddCommandeDao.updateStatus).not.toHaveBeenCalled();
      expect(mockRedisCommandeDao.setStatus).not.toHaveBeenCalled();
      expect(mockRabbitmqCommandeDao.publishStatusChange).not.toHaveBeenCalled();
    });
  });
});
