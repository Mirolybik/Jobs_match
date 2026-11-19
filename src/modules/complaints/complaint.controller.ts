import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuthenticatedUser } from '../../common/types/authenticated-user';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ComplaintService } from './complaint.service';
import { ComplaintQueryDto, CreateComplaintDto } from './dto/complaint.dto';

@ApiTags('Жалобы')
@ApiBearerAuth()
@Roles(Role.CANDIDATE, Role.EMPLOYER)
@Controller('complaints')
export class ComplaintController {
  constructor(private readonly complaintService: ComplaintService) {}

  @Post()
  @ApiOperation({ summary: 'Пожаловаться на вакансию или отклик' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateComplaintDto) {
    return this.complaintService.create(user.id, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Мои жалобы и их статусы' })
  listMine(@CurrentUser() user: AuthenticatedUser, @Query() query: ComplaintQueryDto) {
    return this.complaintService.listMine(user.id, query);
  }
}
