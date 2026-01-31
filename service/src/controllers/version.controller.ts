import { Request, Response } from 'express';
import { VersionService } from '@/services/version.service';

export class VersionController {
  private versionService: VersionService;

  constructor() {
    this.versionService = new VersionService();
  }

  getVersion = async (_req: Request, res: Response): Promise<void> => {

    try {
      const versionInfo = await this.versionService.getVersionInfo();
      res.status(200).json(versionInfo);
    } catch (error) {
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknow error',
      });
    }
  };
}
