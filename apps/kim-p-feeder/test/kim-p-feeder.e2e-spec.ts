import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MockKimPFeederModule } from './mock-module';

describe('KimPFeeder (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [MockKimPFeederModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('should return 404 for unknown routes', () => {
    return request(app.getHttpServer()).get('/unknown').expect(404);
  });

  it('should handle health check endpoint', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
        expect(res.body).toHaveProperty('dependencies');
        expect(res.body.dependencies).toHaveProperty('webSockets');
        expect(res.body.dependencies).toHaveProperty('redis');
      });
  });
});
