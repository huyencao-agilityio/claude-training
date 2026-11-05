import { DataSource, QueryRunner, Repository } from 'typeorm';
import { dataSourceOptions } from '../data-source';
import { Task } from '../tasks/task.entity';
import { User } from './user.entity';
import { HashedUserEntry, UsersService } from './users.service';

// Runs against the real PostgreSQL from `npm run db:up` (run with `npm run test:db`), in a database
// where the app has started once with this code so the users table exists.
// Each test runs in a transaction that is rolled back, so the dev data is untouched.
describe('UsersService.replaceAll (PostgreSQL)', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  let users: Repository<User>;
  let service: UsersService;

  const entry = (name: string): HashedUserEntry => ({
    email: `${name.toLowerCase()}.db-spec@example.com`,
    name,
    role: 'user',
    passwordHash: `scrypt$${name}$hash`,
  });
  const ann = entry('Ann');
  const ben = entry('Ben');

  const row = (email: string) => users.findOneByOrFail({ email });

  beforeAll(async () => {
    dataSource = await new DataSource({ ...dataSourceOptions(), synchronize: false }).initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.startTransaction();
    users = queryRunner.manager.getRepository(User);
    service = new UsersService(users);
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  it('keeps the id of a user who is in the file again, and updates their fields', async () => {
    await service.replaceAll([ann]);
    const before = await row(ann.email);

    await service.replaceAll([{ ...ann, name: 'Ann B', role: 'admin', passwordHash: 'scrypt$new$hash' }]);
    const after = await row(ann.email);

    expect(after.id).toBe(before.id);
    expect(after).toMatchObject({ name: 'Ann B', role: 'admin', passwordHash: 'scrypt$new$hash', removedAt: null });
  });

  it('marks a user missing from the file as removed, and clears it when they come back', async () => {
    await service.replaceAll([ann, ben]);
    await service.replaceAll([ann]);
    expect((await row(ben.email)).removedAt).toBeInstanceOf(Date);
    expect(await service.findActiveByEmail(ben.email)).toBeNull();

    const removedId = (await row(ben.email)).id;
    await service.replaceAll([ann, ben]);
    const back = await row(ben.email);
    expect(back.removedAt).toBeNull();
    expect(back.id).toBe(removedId);
  });

  it('counts only users who were active before as removed', async () => {
    await service.replaceAll([ann, ben]);
    await expect(service.replaceAll([ann])).resolves.toEqual({ loaded: 1, removed: 1 });
    // Ben is already removed, so loading Ann alone again removes nobody
    await expect(service.replaceAll([ann])).resolves.toEqual({ loaded: 1, removed: 0 });
  });

  it('does not change any task', async () => {
    const tasks = queryRunner.manager.getRepository(Task);
    const snapshot = () =>
      tasks.createQueryBuilder('task').select('COUNT(*)', 'count').addSelect('MAX(task.updated_at)', 'lastUpdate').getRawOne();
    const before = await snapshot();

    await service.replaceAll([ann, ben]);

    expect(await snapshot()).toEqual(before);
  });
});
