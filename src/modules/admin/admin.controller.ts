import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { AdminVacancyQueryDto } from '../vacancies/dto/vacancy.dto';
import { ComplaintQueryDto, ResolveComplaintDto } from '../complaints/dto/complaint.dto';
import {
  AdminCompanyQueryDto,
  AdminUserQueryDto,
  UpdateCompanyStatusDto,
  UpdateUserStatusDto,
} from './dto/admin.dto';

@ApiTags('Администратор')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('vacancies')
  @ApiOperation({ summary: 'Все объявления, включая черновики и снятые' })
  listVacancies(@Query() query: AdminVacancyQueryDto) {
    return this.adminService.listVacancies(query);
  }

  @Post('vacancies/:id/remove')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Снять вакансию с публикации' })
  removeVacancy(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.removeVacancy(id);
  }

  @Get('complaints')
  @ApiOperation({ summary: 'Жалобы пользователей' })
  listComplaints(@Query() query: ComplaintQueryDto) {
    return this.adminService.listComplaints(query);
  }

  @Get('complaints/:id')
  @ApiOperation({ summary: 'Карточка жалобы' })
  getComplaint(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.adminService.getComplaint(id);
  }

  @Patch('complaints/:id')
  @ApiOperation({ summary: 'Рассмотреть жалобу' })
  resolveComplaint(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ResolveComplaintDto) {
    return this.adminService.resolveComplaint(id, dto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Пользователи с профилями и статусами' })
  listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Заблокировать или разблокировать пользователя' })
  updateUserStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adminService.updateUserStatus(user.id, id, dto);
  }

  @Get('companies')
  @ApiOperation({ summary: 'Компании с владельцами и числом вакансий' })
  listCompanies(@Query() query: AdminCompanyQueryDto) {
    return this.adminService.listCompanies(query);
  }

  @Patch('companies/:id/status')
  @ApiOperation({ summary: 'Приостановить или активировать компанию' })
  updateCompanyStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCompanyStatusDto,
  ) {
    return this.adminService.updateCompanyStatus(id, dto);
  }
}
