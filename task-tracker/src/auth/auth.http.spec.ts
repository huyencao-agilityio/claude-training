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
import { UsersController } from '../users/users.controller';
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
  let admin: User;

  const queryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    setQueryRunner: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
    stream: jest.fn(),
  };
  const taskRepository = {
    createQueryBuilder: jest.fn(() => queryBuilder),
    findOne: jest.fn(),
    create: jest.fn((task: Partial<Task>) => task),
    save: jest.fn(),
    delete: jest.fn(),
    manager: { connection: { createQueryRunner: () => ({ release: jest.fn() }) } },
  };
  // GET /users (UsersService.listActive)
  const userQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const userRepository = { findOneBy: jest.fn(), createQueryBuilder: jest.fn(() => userQueryBuilder) };

  // Every call that reads or writes task data
  const taskDataCalls = () =>
    taskRepository.createQueryBuilder.mock.calls.length +
    taskRepository.findOne.mock.calls.length +
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
    admin = {
      id: '5b2d8c1e-3f4a-4b6c-8d7e-9f0a1b2c3d4e',
      email: 'admin@example.com',
      name: 'Admin',
      role: 'admin',
      passwordHash: alice.passwordHash,
      removedAt: null,
    } as User;

    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController, AuthController, UsersController],
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
    userRepository.findOneBy.mockImplementation(
      async (where: Partial<User>) =>
        [alice, admin].find((u) => (where.id ?? u.id) === u.id && (where.email ?? u.email) === u.email) ?? null,
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

    it('GET /users returns 401 and reads no user list', async () => {
      expect((await call('GET', '/users')).status).toBe(401);
      expect(userRepository.createQueryBuilder).not.toHaveBeenCalled();
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
      taskRepository.findOne.mockResolvedValue({ id: TASK_ID, title: 'A', status: 'todo', dueDate: null });
      const res = await call(method, path, { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(200);
    });

    it('lets a user see every task (AC4.3, TC-14)', async () => {
      const res = await call('GET', '/tasks', { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(200);
      // No per-user condition: only the filters sent in the query
      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('as a user (AC4.2, TC-13)', () => {
    const FORBIDDEN = { statusCode: 403, message: 'Forbidden' };

    it('POST /tasks returns 403 and saves nothing', async () => {
      const res = await call('POST', '/tasks', { cookie: sessionCookie(alice.id), body: { title: 'New task' } });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('checks the role before validating the body: POST /tasks with {} is 403, not 400', async () => {
      const res = await call('POST', '/tasks', { cookie: sessionCookie(alice.id), body: {} });
      expect(res.status).toBe(403);
    });

    it('DELETE /tasks/:id returns 403 and deletes nothing', async () => {
      const res = await call('DELETE', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id) });
      expect(res.status).toBe(403);
      expect(taskDataCalls()).toBe(0);
    });

    it.each([
      ['title', { title: 'B' }],
      ['description', { description: 'New text' }],
      ['description (null)', { description: null }],
      ['dueDate', { dueDate: '2026-04-01T00:00:00.000Z' }],
      ['dueDate (null)', { dueDate: null }],
    ])('PATCH /tasks/:id with %s returns 403 and changes nothing', async (_field, body) => {
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(FORBIDDEN);
      expect(taskDataCalls()).toBe(0);
    });

    it('PATCH /tasks/:id with an invalid value returns 400 before the role check', async () => {
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { status: 'urgent' } });
      expect(res.status).toBe(400);
      expect(taskDataCalls()).toBe(0);
    });

    it('PATCH /tasks/:id with none of those fields returns 200 and changes nothing', async () => {
      const task = { id: TASK_ID, title: 'A', status: 'todo', dueDate: null };
      taskRepository.findOne.mockResolvedValue({ ...task });
      taskRepository.save.mockImplementation(async (saved: Partial<Task>) => saved);
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: {} });
      expect(res.status).toBe(200);
      expect(taskRepository.save).toHaveBeenCalledWith(task);
    });

    it('PATCH /tasks/:id with a priority returns 200 and saves it (AC2.3, TC-18)', async () => {
      const task = { id: TASK_ID, title: 'A', status: 'todo', priority: 'low', dueDate: null };
      taskRepository.findOne.mockResolvedValue({ ...task });
      taskRepository.save.mockImplementation(async (saved: Partial<Task>) => saved);
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { priority: 'high' } });
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ priority: 'high' });
      expect(taskRepository.save).toHaveBeenCalledWith({ ...task, priority: 'high' });
    });

    it.each(['urgent', null])('PATCH /tasks/:id with priority %p returns 400 and changes nothing', async (priority) => {
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { priority } });
      expect(res.status).toBe(400);
      expect(taskDataCalls()).toBe(0);
    });
  });

  describe('as an admin (AC4.1, TC-11)', () => {
    it('POST /tasks creates a task with status todo by default (AC4.9)', async () => {
      taskRepository.save.mockImplementation(async (task: Partial<Task>) => ({ id: TASK_ID, dueDate: null, ...task }));
      const res = await call('POST', '/tasks', { cookie: sessionCookie(admin.id), body: { title: 'New task' } });
      expect(res.status).toBe(201);
      expect(taskRepository.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'New task', status: 'todo' }));
    });

    it('POST /tasks with an unknown priority returns 400 and saves nothing (AC2.2, TC-17)', async () => {
      const res = await call('POST', '/tasks', {
        cookie: sessionCookie(admin.id),
        body: { title: 'New task', priority: 'urgent' },
      });
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({
        message: ['priority must be one of the following values: high, medium, low'],
      });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('PATCH /tasks/:id updates every field and clears the due date with null (AC4.6)', async () => {
      taskRepository.findOne.mockResolvedValue({
        id: TASK_ID,
        title: 'A',
        description: 'Old',
        status: 'todo',
        dueDate: new Date('2026-03-20T00:00:00.000Z'),
      });
      taskRepository.save.mockImplementation(async (task: Partial<Task>) => task);
      const res = await call('PATCH', `/tasks/${TASK_ID}`, {
        cookie: sessionCookie(admin.id),
        body: { title: 'B', description: null, status: 'in_progress', dueDate: null },
      });
      expect(res.status).toBe(200);
      expect(taskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'B', description: null, status: 'in_progress', dueDate: null }),
      );
    });

    it('PATCH /tasks/:id on a deleted task returns 404 (AC4.5)', async () => {
      taskRepository.findOne.mockResolvedValue(null);
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(admin.id), body: { status: 'done' } });
      expect(res.status).toBe(404);
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('DELETE /tasks/:id deletes a task', async () => {
      taskRepository.delete.mockResolvedValue({ affected: 1 });
      const res = await call('DELETE', `/tasks/${TASK_ID}`, { cookie: sessionCookie(admin.id) });
      expect(res.status).toBe(204);
      expect(taskRepository.delete).toHaveBeenCalledWith(TASK_ID);
    });

    it('gets 403 on the next save once the users file makes them a user (AC4.8)', async () => {
      userRepository.findOneBy.mockResolvedValue({ ...admin, role: 'user' });
      // Status needs the task's assignee since T3, so the task is read first; it isn't theirs
      taskRepository.findOne.mockResolvedValue({ id: TASK_ID, title: 'A', status: 'todo', dueDate: null, assigneeId: null });
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(admin.id), body: { status: 'done' } });
      expect(res.status).toBe(403);
      expect(taskRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('assignee (T3)', () => {
    const task = (assignee: User | null = null) => ({
      id: TASK_ID,
      title: 'A',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      assigneeId: assignee?.id ?? null,
      assignee,
    });

    beforeEach(() => {
      taskRepository.save.mockImplementation(async (saved: Partial<Task>) => saved);
    });

    it('GET /users returns the active users with id, name and email only (AC3.7, AC3.18)', async () => {
      const listed = [{ id: admin.id, name: 'Admin', email: 'admin@example.com' }];
      userQueryBuilder.getMany.mockResolvedValue(listed);

      const res = await call('GET', '/users', { cookie: sessionCookie(alice.id) });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual(listed);
      expect(userQueryBuilder.select).toHaveBeenCalledWith(['user.id', 'user.name', 'user.email']);
      expect(userQueryBuilder.where).toHaveBeenCalledWith('user.removedAt IS NULL');
    });

    it('lets a user assign a task to another user (AC3.5, TC-35)', async () => {
      taskRepository.findOne.mockResolvedValue(task());

      const res = await call('PATCH', `/tasks/${TASK_ID}`, {
        cookie: sessionCookie(alice.id),
        body: { assigneeId: admin.id },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.assignee).toEqual({ id: admin.id, name: 'Admin' });
      // Never the email, role or hash of the assignee (AC3.7)
      expect(JSON.stringify(body)).not.toMatch(/admin@example\.com|passwordHash|"role"/);
    });

    it('lets a user unassign a task with null (AC3.3)', async () => {
      taskRepository.findOne.mockResolvedValue(task(admin));

      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { assigneeId: null } });

      expect(res.status).toBe(200);
      expect((await res.json()).assignee).toBeNull();
    });

    it('returns 400 for an id that is not an existing user and saves nothing (AC3.6, TC-36)', async () => {
      taskRepository.findOne.mockResolvedValue(task());

      const res = await call('PATCH', `/tasks/${TASK_ID}`, {
        cookie: sessionCookie(admin.id),
        body: { assigneeId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' },
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ message: 'assigneeId must be an existing user' });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('returns 400 for an assigneeId that is not a uuid, before reading the task', async () => {
      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { assigneeId: 'bob' } });

      expect(res.status).toBe(400);
      expect(taskDataCalls()).toBe(0);
    });

    it("lets the task's assignee change its status (AC3.10, TC-43)", async () => {
      taskRepository.findOne.mockResolvedValue(task(alice));

      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { status: 'done' } });

      expect(res.status).toBe(200);
      expect(taskRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' }));
    });

    it.each([
      ['assigned to someone else (TC-44)', () => task(admin)],
      ['unassigned (TC-45)', () => task()],
    ])('returns 403 when a user changes the status of a task %s (AC3.11)', async (_case, stored) => {
      taskRepository.findOne.mockResolvedValue(stored());

      const res = await call('PATCH', `/tasks/${TASK_ID}`, { cookie: sessionCookie(alice.id), body: { status: 'done' } });

      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({ statusCode: 403, message: 'Forbidden' });
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('filters "Assigned to me" on the logged-in user (AC3.8)', async () => {
      const res = await call('GET', '/tasks?assignee=me', { cookie: sessionCookie(alice.id) });

      expect(res.status).toBe(200);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('task.assigneeId = :userId', { userId: alice.id });
    });
  });

  describe('with a login, other checks', () => {

    it('finds the session cookie among other cookies', async () => {
      const res = await call('GET', '/tasks', { cookie: `theme=dark; ${sessionCookie(alice.id)}; lang=en` });
      expect(res.status).toBe(200);
    });

    it('GET /auth/me returns the id, name and role (AC1.13)', async () => {
      const res = await call('GET', '/auth/me', { cookie: sessionCookie(alice.id) });
      expect(await res.json()).toEqual({ id: alice.id, name: 'Alice', role: 'user' });
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
    it('returns 200 with the id, name and role and sets the session cookie (AC1.3, AC1.18)', async () => {
      const res = await call('POST', '/auth/login', { body: { email: 'alice@example.com', password: 'Passw0rd' } });

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ id: alice.id, name: 'Alice', role: 'user' });
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
      expect(await res.json()).toEqual({ id: alice.id, name: 'Alice', role: 'user' });
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
