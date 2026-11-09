import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Any logged-in user: the assignee dropdown (AC3.18)
  @Get()
  findAll() {
    return this.usersService.listActive();
  }
}
