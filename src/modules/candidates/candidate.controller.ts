import { Body, Controller, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CandidateService } from './candidate.service';
import { ReplaceAvailabilityDto, UpdateCandidateProfileDto } from './dto/candidate.dto';

@ApiTags('Соискатель')
@ApiBearerAuth()
@Roles(Role.CANDIDATE)
@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get('me')
  @ApiOperation({ summary: 'Анкета и доступные часы соискателя' })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.candidateService.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Обновление анкеты' })
  updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateCandidateProfileDto) {
    return this.candidateService.updateMe(user.id, dto);
  }

  @Put('me/availability')
  @ApiOperation({
    summary: 'Полная замена недельного графика доступности',
    description: 'Пересекающиеся и смежные интервалы объединяются. Пустой массив очищает график.',
  })
  replaceAvailability(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReplaceAvailabilityDto) {
    return this.candidateService.replaceAvailability(user.id, dto);
  }
}
