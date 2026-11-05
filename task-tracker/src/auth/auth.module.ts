import { Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { assertSessionSecretConfigured } from './session-token';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  // Global: every endpoint of every module needs a login unless marked @Public()
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule implements OnModuleInit {
  // Runs after ConfigModule has loaded .env, before the app listens
  onModuleInit() {
    assertSessionSecretConfigured();
  }
}
