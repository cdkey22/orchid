import { readFile } from 'fs/promises';
import { join } from 'path';
import { VersionInfo } from '@/models/dto/version';

/**
 * Attention ce service peut poser des problèmes de sécurité.
 * Faire un audi DSI avant une mise en production
 */
export class VersionService {
  async getVersionInfo(): Promise<VersionInfo> {
    const packageJsonPath = join(__dirname, '../../package.json');
    const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent) as {
      name: string;
      version: string;
      description: string;
    };

    return {
      name: packageJson.name,
      version: packageJson.version,
      description: packageJson.description,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
