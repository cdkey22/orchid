import { CommandeService } from '@/services/commande.service';
import { BddCommandeDao } from '@/dao/bddCommande';
import { RabbitmqCommandeDao } from '@/dao/rabbitmqCommande';
import { RedisCommandeDao } from '@/dao/redisCommande';
import { ClientId, CommandeCreationDate, CommandeStatus } from '@/models/commande';

jest.mock('@/dao/bddCommande');
jest.mock('@/dao/rabbitmqCommande');
jest.mock('@/dao/redisCommande');

describe('CommandeService', () => {
  let commandeService: CommandeService;
  let mockBddCommandeDao: jest.Mocked<BddCommandeDao>;
  let mockRabbitmqCommandeDao: jest.Mocked<RabbitmqCommandeDao>;
  let mockRedisCommandeDao: jest.Mocked<RedisCommandeDao>;

  beforeEach(() => {
    mockBddCommandeDao = new BddCommandeDao() as jest.Mocked<BddCommandeDao>;
    mockRabbitmqCommandeDao = new RabbitmqCommandeDao() as jest.Mocked<RabbitmqCommandeDao>;
    mockRedisCommandeDao = new RedisCommandeDao() as jest.Mocked<RedisCommandeDao>;
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

    it('devrait rejeter une commande avec une date dans le futur', async () => {
      const clientId = 123 as ClientId;
      const futureDate = new Date(Date.now() + 86400000) as CommandeCreationDate; // +1 jour

      await expect(commandeService.createCommande(clientId, futureDate)).rejects.toThrow(
        'La date de création est dans le futur'
      );

      expect(mockBddCommandeDao.createCommande).not.toHaveBeenCalled();
    });

    it('devrait propager les erreurs du DAO', async () => {
      const clientId = 123 as ClientId;
      const creationDate = new Date('2024-01-15T10:00:00Z') as CommandeCreationDate;

      mockBddCommandeDao.createCommande = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(commandeService.createCommande(clientId, creationDate)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
