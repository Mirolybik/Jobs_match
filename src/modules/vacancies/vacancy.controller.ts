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
import { OptionalAuth } from '../../common/decorators/optional-auth.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CreateVacancyDto, UpdateVacancyDto, VacancyQueryDto } from './dto/vacancy.dto';
import { VacancyService } from './vacancy.service';

@ApiTags('Вакансии')
@Controller('vacancies')
export class VacancyController {
  constructor(private readonly vacancyService: VacancyService) {}

  @Get()
  @OptionalAuth()
  @ApiOperation({
    summary: 'Каталог опубликованных вакансий',
    description:
      'Для авторизованного соискателя в каждой вакансии возвращается блок match с причиной совпадения или расхождения.',
  })
  list(@Query() query: VacancyQueryDto, @CurrentUser() user: AuthenticatedUser | undefined) {
    return this.vacancyService.list(query, user);
  }

  @Get('mine')
  @Roles(Role.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Все вакансии своей компании' })
  getMine(@CurrentUser() user: AuthenticatedUser, @Query() query: VacancyQueryDto) {
    return this.vacancyService.getMine(user.id, query);
  }

  @Get(':id/match')
  @Roles(Role.CANDIDATE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Сверка вакансии с доступными часами соискателя' })
  match(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vacancyService.matchForCandidate(id, user.id);
  }

  @Get(':id')
  @OptionalAuth()
  @ApiOperation({
    summary: 'Карточка вакансии',
    description: 'Черновики и снятые вакансии видны только владельцу и администратору.',
  })
  getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
  ) {
    return this.vacancyService.getById(id, user);
  }

  @Post()
  @Roles(Role.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Создание вакансии (черновика)' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateVacancyDto) {
    return this.vacancyService.create(user.id, dto);
  }

  @Patch(':id')
  @Roles(Role.EMPLOYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Редактирование вакансии' })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateVacancyDto,
  ) {
    return this.vacancyService.update(user.id, id, dto);
  }

  @Post(':id/publish')
  @Roles(Role.EMPLOYER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Публикация вакансии' })
  publish(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vacancyService.publish(user.id, id);
  }

  @Post(':id/close')
  @Roles(Role.EMPLOYER)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Закрытие вакансии' })
  close(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.vacancyService.close(user.id, id);
  }
}
