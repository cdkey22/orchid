import { CommandeService } from '@/services/commande.service';
import { BddCommandeService } from '@/dao/bddCommande';
import { ClientId, CommandeCreationDate, CommandeStatus } from '@/models/commande';

jest.mock('@/dao/bddCommande');

describe('CommandeService', () => {
  let commandeService: CommandeService;
  let mockBddCommandeService: jest.Mocked<BddCommandeService>;

  beforeEach(() => {
    mockBddCommandeService = new BddCommandeService() as jest.Mocked<BddCommandeService>;
    commandeService = new CommandeService();
    (commandeService as any).bddCommandeService = mockBddCommandeService;
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

      mockBddCommandeService.createCommande = jest.fn().mockResolvedValue(mockCommande);

      const result = await commandeService.createCommande(clientId, creationDate);

      expect(mockBddCommandeService.createCommande).toHaveBeenCalledWith(clientId, creationDate);
      expect(result).toEqual(mockCommande);
    });

    it('devrait rejeter une commande avec une date dans le futur', async () => {
      const clientId = 123 as ClientId;
      const futureDate = new Date(Date.now() + 86400000) as CommandeCreationDate; // +1 jour

      await expect(commandeService.createCommande(clientId, futureDate)).rejects.toThrow(
        'La date de création est dans le futur'
      );

      expect(mockBddCommandeService.createCommande).not.toHaveBeenCalled();
    });

    it('devrait propager les erreurs du DAO', async () => {
      const clientId = 123 as ClientId;
      const creationDate = new Date('2024-01-15T10:00:00Z') as CommandeCreationDate;

      mockBddCommandeService.createCommande = jest
        .fn()
        .mockRejectedValue(new Error('Database error'));

      await expect(commandeService.createCommande(clientId, creationDate)).rejects.toThrow(
        'Database error'
      );
    });
  });
});
