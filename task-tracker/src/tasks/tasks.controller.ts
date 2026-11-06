import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Logger,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  Req,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { AuthenticatedRequest, Roles } from '../auth/auth.guard';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { TaskFilterQuery } from './dto/task-filter.query';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Query() query: ListTasksQuery) {
    return this.tasksService.findAll(query);
  }

  // Declared before ':id' so "export" is not taken as a task id
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="tasks.csv"')
  export(@Query() query: TaskFilterQuery, @Res({ passthrough: true }) res: Response) {
    const csv = this.tasksService.exportCsv(query);
    // Express only unpipes when the client goes away; destroying the stream stops the query
    res.once('close', () => csv.destroy());
    // The default handler answers 400 with the error message; a database failure is a 500
    return new StreamableFile(csv).setErrorHandler((err, response) => {
      this.logger.error(`CSV export failed: ${err.message}`, err.stack);
      if (response.destroyed) return;
      if (!response.headersSent) response.statusCode = 500;
      response.end();
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.findOne(id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateTaskDto) {
    return this.tasksService.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.tasksService.update(id, dto, req.user);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tasksService.remove(id);
  }
}
