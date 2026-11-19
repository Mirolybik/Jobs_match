import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CandidateProfileWithAvailability } from '../users/user.types';
import { ScheduleRecord } from '../matching/schedule.mapper';

export interface UpdateCandidateProfileInput {
  fullName?: string;
  phone?: string | null;
  city?: string;
  about?: string | null;
  minHourlyRateKopecks?: number | null;
}

@Injectable()
export class CandidateRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByUserId(userId: string): Promise<CandidateProfileWithAvailability | null> {
    return this.prisma.candidateProfile.findUnique({
      where: { userId },
      include: { availability: true },
    });
  }

  update(
    profileId: string,
    input: UpdateCandidateProfileInput,
  ): Promise<CandidateProfileWithAvailability> {
    const data: Prisma.CandidateProfileUpdateInput = {
      fullName: input.fullName,
      phone: input.phone,
      city: input.city,
      about: input.about,
      minHourlyRateKopecks: input.minHourlyRateKopecks,
    };

    return this.prisma.candidateProfile.update({
      where: { id: profileId },
      data,
      include: { availability: true },
    });
  }

  async replaceAvailability(
    profileId: string,
    intervals: readonly ScheduleRecord[],
  ): Promise<CandidateProfileWithAvailability> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.availabilityInterval.deleteMany({ where: { candidateId: profileId } });

      if (intervals.length > 0) {
        await transaction.availabilityInterval.createMany({
          data: intervals.map((interval) => ({
            candidateId: profileId,
            dayOfWeek: interval.dayOfWeek,
            startMinute: interval.startMinute,
            endMinute: interval.endMinute,
          })),
        });
      }

      return transaction.candidateProfile.findUniqueOrThrow({
        where: { id: profileId },
        include: { availability: true },
      });
    });
  }
}
