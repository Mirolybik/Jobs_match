import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../dist/app.module.js';

const API = '/api/v1';

describe('JobsMatch API (e2e)', { concurrency: false }, () => {
  let app;
  let prisma;
  let candidate;
  let employer;
  let admin;
  let vacancyId;
  let applicationId;

  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  before(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    await app.init();

    prisma = new PrismaClient();
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        "audit_logs",
        "application_status_events",
        "complaints",
        "refresh_tokens",
        "applications",
        "vacancy_intervals",
        "vacancies",
        "availability_intervals",
        "candidate_profiles",
        "companies",
        "users"
      RESTART IDENTITY CASCADE
    `);

    await prisma.user.create({
      data: {
        email: 'admin@e2e.ru',
        passwordHash: await hash('Admin12345', 4),
        role: Role.ADMIN,
      },
    });
  });

  after(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('отдаёт health и request id', async () => {
    const response = await request(app.getHttpServer()).get(`${API}/health`).expect(200);

    assert.equal(response.body.status, 'ok');
    assert.equal(response.body.database, 'up');
    assert.ok(response.headers['x-request-id']);
  });

  it('регистрирует соискателя и работодателя', async () => {
    const candidateResponse = await request(app.getHttpServer())
      .post(`${API}/auth/register/candidate`)
      .send({
        email: 'candidate@e2e.ru',
        password: 'Candidate123',
        fullName: 'Тестовый Соискатель',
        city: 'Москва',
      })
      .expect(201);

    candidate = {
      id: candidateResponse.body.user.id,
      accessToken: candidateResponse.body.tokens.accessToken,
    };
    assert.equal(candidateResponse.body.user.role, Role.CANDIDATE);

    const employerResponse = await request(app.getHttpServer())
      .post(`${API}/auth/register/employer`)
      .send({
        email: 'employer@e2e.ru',
        password: 'Employer123',
        companyName: 'Кофейня E2E',
        city: 'Москва',
        address: 'ул. Тестовая, 1',
      })
      .expect(201);

    employer = {
      id: employerResponse.body.user.id,
      accessToken: employerResponse.body.tokens.accessToken,
    };
    assert.equal(employerResponse.body.user.role, Role.EMPLOYER);
    assert.equal(employerResponse.body.user.company.name, 'Кофейня E2E');
  });

  it('сохраняет график доступности', async () => {
    const response = await request(app.getHttpServer())
      .put(`${API}/candidates/me/availability`)
      .set(auth(candidate.accessToken))
      .send({
        intervals: [
          { dayOfWeek: 2, start: '18:00', end: '22:00' },
          { dayOfWeek: 4, start: '18:00', end: '22:00' },
        ],
      })
      .expect(200);

    assert.equal(response.body.availability.length, 2);
  });

  it('публикует вакансию и показывает причину совпадения', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API}/vacancies`)
      .set(auth(employer.accessToken))
      .send({
        title: 'Бариста',
        description: 'Обслуживание гостей и приготовление напитков',
        city: 'Москва',
        address: 'ул. Тестовая, 1',
        hourlyRate: 400,
        responseDeadlineHours: 48,
        schedule: [
          { dayOfWeek: 2, start: '18:00', end: '22:00' },
          { dayOfWeek: 4, start: '18:00', end: '22:00' },
        ],
      })
      .expect(201);

    vacancyId = created.body.id;
    assert.equal(created.body.status, 'DRAFT');

    await request(app.getHttpServer())
      .post(`${API}/vacancies/${vacancyId}/publish`)
      .set(auth(employer.accessToken))
      .expect(200);

    const catalog = await request(app.getHttpServer())
      .get(`${API}/vacancies`)
      .set(auth(candidate.accessToken))
      .expect(200);

    assert.equal(catalog.body.items[0].title, 'Бариста');
    assert.equal(catalog.body.items[0].match.status, 'MATCHED');
    assert.match(catalog.body.items[0].match.reasons[0], /входят в ваш график/);
  });

  it('создаёт отклик со снимком условий и историей статусов', async () => {
    const applied = await request(app.getHttpServer())
      .post(`${API}/vacancies/${vacancyId}/applications`)
      .set(auth(candidate.accessToken))
      .expect(201);

    applicationId = applied.body.id;
    assert.equal(applied.body.status, 'PENDING');
    assert.equal(applied.body.snapshot.hourlyRate, 400);
    assert.equal(applied.body.snapshot.city, 'Москва');
    assert.equal(applied.body.snapshot.weeklyHours, 8);
    assert.equal(applied.body.snapshot.estimatedWeeklyPay, 3200);
    assert.equal(applied.body.history.length, 1);
    assert.equal(applied.body.history[0].status, 'PENDING');

    await request(app.getHttpServer())
      .post(`${API}/vacancies/${vacancyId}/applications`)
      .set(auth(candidate.accessToken))
      .expect(409);
  });

  it('приглашает соискателя и ведёт историю перехода', async () => {
    const invited = await request(app.getHttpServer())
      .post(`${API}/applications/${applicationId}/invite`)
      .set(auth(employer.accessToken))
      .expect(200);

    assert.equal(invited.body.status, 'INVITED');
    assert.equal(invited.body.history.length, 2);

    const history = await request(app.getHttpServer())
      .get(`${API}/applications/${applicationId}/history`)
      .set(auth(candidate.accessToken))
      .expect(200);

    assert.equal(history.body.length, 2);
    assert.equal(history.body[1].previousStatus, 'PENDING');
    assert.equal(history.body[1].status, 'INVITED');
    assert.equal(history.body[1].actor.email, 'employer@e2e.ru');
  });

  it('запрещает отклик при несовпадении графика', async () => {
    const created = await request(app.getHttpServer())
      .post(`${API}/vacancies`)
      .set(auth(employer.accessToken))
      .send({
        title: 'Продавец',
        description: 'Работа в торговом зале с покупателями',
        city: 'Москва',
        address: 'ул. Тестовая, 1',
        hourlyRate: 350,
        schedule: [{ dayOfWeek: 3, start: '12:00', end: '17:00' }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`${API}/vacancies/${created.body.id}/publish`)
      .set(auth(employer.accessToken))
      .expect(200);

    const mismatch = await request(app.getHttpServer())
      .post(`${API}/vacancies/${created.body.id}/applications`)
      .set(auth(candidate.accessToken))
      .expect(422);

    assert.equal(mismatch.body.code, 'SCHEDULE_MISMATCH');
    assert.match(mismatch.body.details.match.reasons[0], /Среда/);
  });

  it('позволяет администратору смотреть журнал и блокировать пользователя', async () => {
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: 'admin@e2e.ru', password: 'Admin12345' })
      .expect(200);

    admin = { accessToken: login.body.tokens.accessToken };

    const audit = await request(app.getHttpServer())
      .get(`${API}/admin/audit-logs`)
      .set(auth(admin.accessToken))
      .expect(200);

    const actions = audit.body.items.map((item) => item.action);
    for (const action of [
      'USER_REGISTERED',
      'VACANCY_PUBLISHED',
      'APPLICATION_CREATED',
      'APPLICATION_INVITED',
    ]) {
      assert.ok(actions.includes(action), `в журнале нет ${action}`);
    }

    const users = await request(app.getHttpServer())
      .get(`${API}/admin/users?role=CANDIDATE`)
      .set(auth(admin.accessToken))
      .expect(200);

    const target = users.body.items.find((item) => item.email === 'candidate@e2e.ru');
    assert.ok(target);

    const blocked = await request(app.getHttpServer())
      .patch(`${API}/admin/users/${target.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'BLOCKED' })
      .expect(200);

    assert.equal(blocked.body.status, 'BLOCKED');

    const forbidden = await request(app.getHttpServer())
      .get(`${API}/applications/me`)
      .set(auth(candidate.accessToken))
      .expect(401);

    assert.equal(forbidden.body.code, 'UNAUTHORIZED');

    await request(app.getHttpServer())
      .patch(`${API}/admin/users/${target.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('скрывает вакансии приостановленной компании', async () => {
    const companies = await request(app.getHttpServer())
      .get(`${API}/admin/companies`)
      .set(auth(admin.accessToken))
      .expect(200);

    const company = companies.body.items[0];

    await request(app.getHttpServer())
      .patch(`${API}/admin/companies/${company.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'SUSPENDED' })
      .expect(200);

    const catalog = await request(app.getHttpServer()).get(`${API}/vacancies`).expect(200);
    assert.equal(catalog.body.items.length, 0);

    await request(app.getHttpServer())
      .patch(`${API}/admin/companies/${company.id}/status`)
      .set(auth(admin.accessToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
  });

  it('обрабатывает жалобу и снимает вакансию', async () => {
    const complaint = await request(app.getHttpServer())
      .post(`${API}/complaints`)
      .set(auth(candidate.accessToken))
      .send({
        vacancyId,
        reason: 'Недостоверные условия',
        comment: 'Ставка в описании не совпала',
      })
      .expect(201);

    const resolved = await request(app.getHttpServer())
      .patch(`${API}/admin/complaints/${complaint.body.id}`)
      .set(auth(admin.accessToken))
      .send({
        status: 'RESOLVED',
        resolutionComment: 'Нарушение подтверждено',
        removeVacancy: true,
      })
      .expect(200);

    assert.equal(resolved.body.status, 'RESOLVED');

    const vacancy = await request(app.getHttpServer())
      .get(`${API}/vacancies/${vacancyId}`)
      .expect(404);

    assert.equal(vacancy.body.code, 'NOT_FOUND');
  });
});
