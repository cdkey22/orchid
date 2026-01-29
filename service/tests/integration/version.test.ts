import request from 'supertest';
import app from '../../src/index';

describe('GET /api/v1/version', () => {
  it('devrait retourner les informations de version', async () => {
    const response = await request(app).get('/api/v1/version');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('name', 'orchid');
    expect(response.body).toHaveProperty('version', '1.0.0');
    expect(response.body).toHaveProperty('description');
    expect(response.body).toHaveProperty('nodeVersion');
    expect(response.body).toHaveProperty('environment');
  });

  it('devrait retourner un format de version valide', async () => {
    const response = await request(app).get('/api/v1/version');

    expect(response.status).toBe(200);
    expect(response.body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
