import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

export type HashedUserEntry = { email: string; name: string; role: UserRole; passwordHash: string };

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  // Exact match: emails are stored lowercase, so "Alice@example.com" finds nobody (Q-28)
  findActiveByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email, removedAt: IsNull() });
  }

  findActiveById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id, removedAt: IsNull() });
  }

  // Replaces the users with the file's entries in one transaction; tasks are never touched.
  // The caller validates the file and hashes the passwords first, so a bad file never gets here.
  async replaceAll(entries: HashedUserEntry[]): Promise<{ loaded: number; removed: number }> {
    return this.users.manager.transaction(async (manager) => {
      // Same email = same row and id, so links to a user (T3's assignee) survive a reload
      await manager.upsert(
        User,
        entries.map((entry) => ({ ...entry, removedAt: null })),
        ['email'],
      );
      const result = await manager
        .createQueryBuilder()
        .update(User)
        .set({ removedAt: () => 'now()' })
        .where('removed_at IS NULL')
        .andWhere('email NOT IN (:...emails)', { emails: entries.map((entry) => entry.email) })
        .execute();
      return { loaded: entries.length, removed: result.affected ?? 0 };
    });
  }
}
