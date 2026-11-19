import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApplicationStatus, Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApplicationService } from './application.service';

@ApiTags('Отклики')
@ApiBearerAuth()
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Get('me')
  @Roles(Role.CANDIDATE)
  @ApiOperation({ summary: 'История моих откликов' })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationQueryDto) {
    return this.applicationService.listMine(user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Карточка отклика (участник или администратор)' })
  getById(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.getById(user.id, user.role, id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'История статусов отклика' })
  getHistory(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.getHistory(user.id, user.role, id);
  }

  @Post(':id/withdraw')
  @Roles(Role.CANDIDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отозвать отклик' })
  withdraw(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.withdraw(user.id, id);
  }

  @Post(':id/invite')
  @Roles(Role.EMPLOYER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Пригласить соискателя' })
  invite(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.decide(user.id, id, ApplicationStatus.INVITED);
  }

  @Post(':id/reject')
  @Roles(Role.EMPLOYER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отказать соискателю' })
  reject(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.decide(user.id, id, ApplicationStatus.REJECTED);
  }
}
