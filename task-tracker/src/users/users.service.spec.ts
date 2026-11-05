import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull } from 'typeorm';
import { User } from './user.entity';
import { HashedUserEntry, UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  const updateBuilder = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn(),
  };
  const manager = {
    upsert: jest.fn(),
    createQueryBuilder: jest.fn(() => updateBuilder),
  };
  const repository = {
    findOneBy: jest.fn(),
    manager: { transaction: jest.fn((work: (m: typeof manager) => unknown) => work(manager)) },
  };

  const entries: HashedUserEntry[] = [
    { email: 'admin@example.com', name: 'Admin', role: 'admin', passwordHash: 'scrypt$a$b' },
    { email: 'alice@example.com', name: 'Alice', role: 'user', passwordHash: 'scrypt$c$d' },
  ];

  beforeEach(async () => {
    jest.clearAllMocks();
    updateBuilder.execute.mockResolvedValue({ affected: 1 });
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(User), useValue: repository }],
    }).compile();
    service = moduleRef.get(UsersService);
  });

  describe('replaceAll (AC1.1)', () => {
    it('upserts every entry by email so existing users keep their id', async () => {
      await service.replaceAll(entries);

      expect(manager.upsert).toHaveBeenCalledWith(
        User,
        entries.map((entry) => ({ ...entry, removedAt: null })),
        ['email'],
      );
    });

    it('marks active users missing from the file as removed', async () => {
      await service.replaceAll(entries);

      expect(updateBuilder.update).toHaveBeenCalledWith(User);
      expect(updateBuilder.where).toHaveBeenCalledWith('removed_at IS NULL');
      expect(updateBuilder.andWhere).toHaveBeenCalledWith('email NOT IN (:...emails)', {
        emails: ['admin@example.com', 'alice@example.com'],
      });
    });

    it('does both writes in one transaction, upsert first', async () => {
      await service.replaceAll(entries);

      expect(repository.manager.transaction).toHaveBeenCalledTimes(1);
      expect(manager.upsert.mock.invocationCallOrder[0]).toBeLessThan(
        updateBuilder.execute.mock.invocationCallOrder[0],
      );
    });

    it('reports how many users were loaded and removed', async () => {
      await expect(service.replaceAll(entries)).resolves.toEqual({ loaded: 2, removed: 1 });
    });

    it('only writes the User table, never tasks', async () => {
      await service.replaceAll(entries);

      expect(manager.upsert.mock.calls.every(([entity]) => entity === User)).toBe(true);
      expect(updateBuilder.update.mock.calls.every(([entity]) => entity === User)).toBe(true);
    });

    it('lets a failed write reject, so the transaction rolls back', async () => {
      updateBuilder.execute.mockRejectedValue(new Error('db down'));
      await expect(service.replaceAll(entries)).rejects.toThrow('db down');
    });
  });

  describe('lookups', () => {
    it('finds an active user by the exact email (AC1.4)', async () => {
      await service.findActiveByEmail('Alice@example.com');
      expect(repository.findOneBy).toHaveBeenCalledWith({ email: 'Alice@example.com', removedAt: IsNull() });
    });

    it('finds an active user by id, skipping removed users', async () => {
      await service.findActiveById('id-1');
      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 'id-1', removedAt: IsNull() });
    });
  });
});
