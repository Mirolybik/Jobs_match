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
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';
import { ApplicationService } from './application.service';

/** Маршруты откликов, вложенные в вакансию: /vacancies/:id/applications. */
@ApiTags('Отклики')
@ApiBearerAuth()
@Controller('vacancies')
export class VacancyApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post(':id/applications')
  @Roles(Role.CANDIDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Откликнуться на вакансию',
    description:
      'Сервер сохраняет снимок ставки, адреса и графика и рассчитывает срок ответа. При REQUIRE_SCHEDULE_MATCH=true отклик возможен только при полном совпадении графика.',
  })
  apply(@Param('id', new ParseUUIDPipe()) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationService.apply(user.id, id);
  }

  @Get(':id/applications')
  @Roles(Role.EMPLOYER)
  @ApiOperation({ summary: 'Отклики на вакансию с графиком кандидатов' })
  listForVacancy(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PaginationQueryDto,
  ) {
    return this.applicationService.listForVacancy(user.id, id, query);
  }
}
