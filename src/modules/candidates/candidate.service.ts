import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { NotFoundError } from '../../common/errors/domain.error';
import { rublesToKopecks } from '../../common/utils/money';
import { AuditService } from '../audit/audit.service';
import { DayOfWeek } from '../matching/domain/day-of-week';
import { TimeOfDay } from '../matching/domain/time-of-day';
import { WeeklyInterval } from '../matching/domain/weekly-interval';
import { WeeklySchedule } from '../matching/domain/weekly-schedule';
import { ScheduleMapper } from '../matching/schedule.mapper';
import { CandidateProfileWithAvailability } from '../users/user.types';
import { CandidatePresenter, CandidateProfileResponse } from '../users/users.presenter';
import { CandidateRepository } from './candidate.repository';
import { ReplaceAvailabilityDto, UpdateCandidateProfileDto } from './dto/candidate.dto';

@Injectable()
export class CandidateService {
  constructor(
    private readonly candidates: CandidateRepository,
    private readonly audit: AuditService,
  ) {}

  async getMe(userId: string): Promise<CandidateProfileResponse> {
    return CandidatePresenter.toResponse(await this.requireProfile(userId));
  }

  async updateMe(
    userId: string,
    dto: UpdateCandidateProfileDto,
  ): Promise<CandidateProfileResponse> {
    const profile = await this.requireProfile(userId);
    const updated = await this.candidates.update(profile.id, {
      fullName: dto.fullName?.trim(),
      phone: dto.phone === undefined ? undefined : dto.phone?.trim() || null,
      city: dto.city?.trim(),
      about: dto.about === undefined ? undefined : dto.about?.trim() || null,
      minHourlyRateKopecks:
        dto.minHourlyRate === undefined
          ? undefined
          : dto.minHourlyRate === null
            ? null
            : rublesToKopecks(dto.minHourlyRate),
    });

    await this.audit.record({
      action: 'CANDIDATE_PROFILE_UPDATED',
      entityType: 'CandidateProfile',
      entityId: profile.id,
      actorId: userId,
      actorRole: Role.CANDIDATE,
      metadata: { fields: Object.keys(dto) },
    });

    return CandidatePresenter.toResponse(updated);
  }

  async replaceAvailability(
    userId: string,
    dto: ReplaceAvailabilityDto,
  ): Promise<CandidateProfileResponse> {
    const profile = await this.requireProfile(userId);
    const schedule = WeeklySchedule.fromIntervals(
      dto.intervals.map((slot) =>
        WeeklyInterval.fromTimes(
          slot.dayOfWeek as DayOfWeek,
          TimeOfDay.parse(slot.start),
          TimeOfDay.parse(slot.end),
        ),
      ),
    );

    const updated = await this.candidates.replaceAvailability(
      profile.id,
      ScheduleMapper.toPersistence(schedule),
    );

    await this.audit.record({
      action: 'AVAILABILITY_REPLACED',
      entityType: 'CandidateProfile',
      entityId: profile.id,
      actorId: userId,
      actorRole: Role.CANDIDATE,
      metadata: { intervals: dto.intervals.length, weeklyMinutes: schedule.totalMinutes },
    });

    return CandidatePresenter.toResponse(updated);
  }

  async requireProfile(userId: string): Promise<CandidateProfileWithAvailability> {
    const profile = await this.candidates.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Профиль соискателя не найден');
    }
    return profile;
  }
}
