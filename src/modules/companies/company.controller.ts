import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CompanyService } from './company.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@ApiTags('Работодатель: компания')
@ApiBearerAuth()
@Roles(Role.EMPLOYER)
@Controller('companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('me')
  @ApiOperation({ summary: 'Профиль своей компании' })
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.companyService.getMine(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Создание компании (если её ещё нет)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCompanyDto) {
    return this.companyService.create(user.id, dto);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновление профиля компании' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCompanyDto) {
    return this.companyService.update(user.id, dto);
  }
}
