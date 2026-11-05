import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Readable } from 'node:stream';
import { Task } from '../tasks/task.entity';
import { TasksController } from '../tasks/tasks.controller';
import { TasksService } from '../tasks/tasks.service';
import { hashPassword } from '../users/password';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthController } from './auth.controller';
import { AuthGuard, SESSION_EXPIRED_MESSAGE } from './auth.guard';
import { AuthService } from './auth.service';
import { signSession } from './session-token';

// Runs the real guard, controllers, services and validation over HTTP, wired like AppModule
// (AuthGuard as APP_GUARD); only the repositories are mocked.
describe('login over HTTP', () => {
  const TASK_ID = '6f1c2a4e-8a1b-4c3d-9e2f-1a2b3c4d5e6f';
  const HOUR = 60 * 60 * 1000;
  let app: INestApplication;
  let baseUrl: string;
  let alice: User;

  const queryBuilder = {
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setQueryRunner: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    stream: jest.fn(),
  };
  const taskRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOneBy: jest.fn(),
    create: jest.fn((task: Partial<Task>) => task),
    save: jest.fn(),
    delete: jest.fn(),
    manager: { connection: { createQueryRunner: () => ({ release: jest.fn() }) } },
  };
  const userRepository = { findOneBy: jest.fn() };

  // Every call that reads or writes task data
  const taskDataCalls = () =>
    taskRepository.createQueryBuilder.mock.calls.length +
    taskRepository.findOneBy.mock.calls.length +
    taskRepository.save.mock.calls.length +
    taskRepository.delete.mock.calls.length;

  const call = (method: string, path: string, init: { cookie?: string; body?: object } = {}) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.cookie ? { Cookie: init.cookie } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

  const sessionCookie = (userId: string, loginAt = Date.now()) => `session=${signSession(userId, loginAt)}`;

  beforeAll(async () => {
    alice = {
      id: '0e9769f6-5998-47bd-ad0f-811ce374384f',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'user',
      passwordHash: await hashPassword('Passw0rd'),
      removedAt: null,
    } as User;

    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController, AuthController],
      providers: [
        TasksService,
        UsersService,
        AuthService,
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: getRepositoryToken(Task), useValue: taskRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same options as the global pipe in main.ts
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  afterAll(() => app.close());

  beforeEach(() => {
    jest.clearAllMocks();
    // Active users only, like UsersService's IsNull() filter on removed_at
    userRepository.findOneBy.mockImplementation(async (where: Partial<User>) =>
      (where.id ?? alice.id) === alice.id && (where.email ?? alice.email) === alice.email ? alice : null,
    );
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
    queryBuilder.stream.mockImplementation(async () => Readable.from([]));
  });

  // Every row has 3 items: with fewer, Jest takes the 3rd test parameter for a done() callback
  const TASK_ENDPOINTS: [string, string, object | undefined][] = [
    ['GET', '/tasks', undefined],
    ['GET', '/tasks/export', undefined],
    ['GET', `/tasks/${TASK_ID}`, undefined],
    ['POST', '/tasks', { title: 'Sneaky task' }],
    ['PATCH', `/tasks/${TASK_ID}`, { title: 'Renamed' }],
    ['DELETE', `/tasks/${TASK_ID}`, undefined],
  ];

  describe('without a login (AC1.6, TC-09)', () => {
    it.each(TASK_ENDPOINTS)('%s %s returns 401 and touches no task data', async (method, path, body) => {
      const res = await call(method, path, { body });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({ statusCode: 401, message: 'Unauthorized' });
      expect(taskDataCalls()).toBe(0);
    });

    it('GET /auth/me returns 401', async () => {
      expect((await call('GET', '/auth/me')).status).toBe(401);
    });

    it('checks the login before validating the body: POST /tasks with {} is 401, not 400', async () => {
      const res = await call('POST', '/tasks', { body: {} });
      expect(res.status).toBe(401);
    });

    it('rejects a signed token whose user id is not a uuid without querying users', async () => {
      const res = await call('GET', '/tasks', { cookie: `session=${signSession('not-a-uuid')}` });
      expect(res.status).toBe(401);
      expect(userRepository.findOneBy).not.toHaveBeenCalled();
    });

    it.each([
      ['a forged token', 'session=abc.def'],
      ['another cookie only', 'theme=dark'],
      ['an empty session cookie', 'session='],
    ])('treats %s as not logged in', async (_, cookie) => {
      const res = await call('GET', '/tasks', { cookie });
      expect(res.status).toBe(401);
      expect(taskDataCalls()).toBe(0);
    });
  });

  describe('with a login', () => {
    it.each(TASK_ENDPOINTS.filter(([method]) => method === 'GET'))('%s %s works', async (method, path) => {
      taskRepository.findOneBy.mockResolvedValue({ id: TASK_ID, title: 'A', status: 'todo', dueDate: null });
      const res = await call(method, path, { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(200);
    });

    // Until T4, every logged-in user can still create, edit and delete tasks
    it('POST /tasks creates a task', async () => {
      taskRepository.save.mockImplementation(async (task: Partial<Task>) => ({ id: TASK_ID, dueDate: null, ...task }));
      const res = await call('POST', '/tasks', { cookie: sessionCookie(alice.id), body: { title: 'New task' } });
      expect(res.status).toBe(201);
      expect(taskRepository.save).toHaveBeenCalled();
    });

    it('PATCH /tasks/:id updates a task', async () => {
      taskRepository.findOneBy.mockResolvedValue({ id: TASK_ID, title: 'A', status: 'todo', dueDate: null });
      taskRepository.save.mockImplementation(async (task: Partial<Task>) => task);
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { title: 'B' } });
      expect(res.status).toBe(200);
      expect(taskRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'B' }));
    });

    it('DELETE /tasks/:id deletes a task', async () => {
      taskRepository.delete.mockResolvedValue({ affected: 1 });
      const res = await call('DELETE', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(204);
      expect(taskRepository.delete).toHaveBeenCalledWith(TASK_ID);
    });

    it('finds the session cookie among other cookies', async () => {
      const res = await call('GET', '/tasks', { cookie: `theme=dark; ${sessionCookie(alice.id)}; lang=en` });
      expect(res.status).toBe(200);
    });

    it('GET /auth/me returns the name and role (AC1.13)', async () => {
      const res = await call('GET', '/auth/me', { cookie: sessionCookie(alice.id) });
      expect(await res.json()).toEqual({ name: 'Alice', role: 'user' });
    });

    it('is still accepted just under 24 hours after login (AC1.18)', async () => {
      const res = await call('GET', '/tasks', { cookie: sessionCookie(alice.id, Date.now() - 24 * HOUR + 60_000) });
      expect(res.status).toBe(200);
    });

    it('rejects the login of a user removed from the users file (AC1.1)', async () => {
      userRepository.findOneBy.mockResolvedValue(null);
      const res = await call('GET', '/tasks', { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(401);
      expect(taskDataCalls()).toBe(0);
    });
  });

  describe('after 24 hours (AC1.7, TC-10)', () => {
    const expiredCookie = () => sessionCookie(alice.id, Date.now() - 24 * HOUR);

    it('returns 401 with the expired message', async () => {
      const res = await call('GET', '/tasks', { cookie: expiredCookie() });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        statusCode: 401,
        message: SESSION_EXPIRED_MESSAGE,
        error: 'SessionExpired',
      });
    });

    it('does not save the action', async () => {
      const res = await call('POST', '/tasks', { cookie: expiredCookie(), body: { title: 'Late task' } });

      expect(res.status).toBe(401);
      expect(taskRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/login', () => {
    it('returns 200 with the name and role and sets the session cookie (AC1.3, AC1.18)', async () => {
      const res = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'Passw0rd' } });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ name: 'Alice', role: 'user' });
      const cookie = res.headers.get('set-cookie') ?? '';
      expect(cookie).toMatch(/^session=[\w-]+\.[\w-]+;/);
      expect(cookie).toContain('Max-Age=2592000');
      expect(cookie).toContain('Path=/');
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
    });

    it('logs in with the cookie it set', async () => {
      const login = await call('POST', '/auth/login', {
        body: { email: 'alice@example.com', password: 'Passw0rd' },
      });
      const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];

      const res = await call('GET', '/auth/me', { cookie });
      expect(await res.json()).toEqual({ name: 'Alice', role: 'user' });
    });

    it.each([
      ['a wrong password', 'alice@example.com', 'Wrong0pass'],
      ['an unknown email', 'nobody@example.com', 'Passw0rd'],
      ['an uppercase email', 'Alice@example.com', 'Passw0rd'],
    ])('returns 401 with the generic message for %s (AC1.4)', async (_, email, password) => {
      const res = await call('POST', '/auth/login', { body: { email, password } });

      expect(res.status).toBe(401);
      expect(await res.json()).toEqual({
        statusCode: 401,
        message: 'Email or password is incorrect.',
        error: 'Unauthorized',
      });
      expect(res.headers.get('set-cookie')).toBeNull();
    });

    it('returns 400 for an empty field (AC1.5)', async () => {
      const res = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: '' } });
      expect(res.status).toBe(400);
    });
  });
});
