import { Company, CompanyStatus, Role, UserStatus } from '@prisma/client';
import { kopecksToRubles } from '../../common/utils/money';
import { TimeOfDay } from '../matching/domain/time-of-day';
import { dayLabel } from '../matching/domain/day-of-week';
import {
  CandidateProfileWithAvailability,
  CandidateProfileWithUser,
  UserWithProfileAndCompany,
} from './user.types';

export interface AvailabilityResponse {
  dayOfWeek: number;
  day: string;
  start: string;
  end: string;
}

export interface CandidateProfileResponse {
  id: string;
  fullName: string;
  phone: string | null;
  city: string;
  about: string | null;
  minHourlyRate: number | null;
  availability: AvailabilityResponse[];
}

export interface CompanyResponse {
  id: string;
  name: string;
  city: string;
  address: string;
  description: string | null;
  status: CompanyStatus;
}

export interface UserResponse {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  candidateProfile: CandidateProfileResponse | null;
  company: CompanyResponse | null;
}

interface AvailabilityRecord {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

const byDayAndTime = (left: AvailabilityRecord, right: AvailabilityRecord): number =>
  left.dayOfWeek - right.dayOfWeek || left.startMinute - right.startMinute;

export class CandidatePresenter {
  static toResponse(profile: CandidateProfileWithAvailability): CandidateProfileResponse {
    return {
      id: profile.id,
      fullName: profile.fullName,
      phone: profile.phone,
      city: profile.city,
      about: profile.about,
      minHourlyRate:
        profile.minHourlyRateKopecks === null
          ? null
          : kopecksToRubles(profile.minHourlyRateKopecks),
      availability: [...profile.availability].sort(byDayAndTime).map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        day: dayLabel(slot.dayOfWeek),
        start: TimeOfDay.fromMinutes(slot.startMinute).format(),
        end: TimeOfDay.fromMinutes(slot.endMinute).format(),
      })),
    };
  }

  /** Контактные данные соискателя для работодателя, который получил отклик. */
  static toEmployerResponse(profile: CandidateProfileWithUser): CandidateProfileResponse & {
    email: string;
  } {
    return {
      ...CandidatePresenter.toResponse(profile),
      email: profile.user.email,
    };
  }
}

export class CompanyPresenter {
  static toResponse(company: Company): CompanyResponse {
    return {
      id: company.id,
      name: company.name,
      city: company.city,
      address: company.address,
      description: company.description,
      status: company.status,
    };
  }
}

export class UserPresenter {
  static toResponse(user: UserWithProfileAndCompany): UserResponse {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      candidateProfile: user.candidateProfile
        ? CandidatePresenter.toResponse(user.candidateProfile)
        : null,
      company: user.company ? CompanyPresenter.toResponse(user.company) : null,
    };
  }
}
