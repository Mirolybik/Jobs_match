import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UserWithProfileAndCompany } from '../users/user.types';

export interface CreateCandidateUserInput {
  email: string;
  passwordHash: string;
  fullName: string;
  city: string;
  phone?: string;
}

export interface CreateEmployerUserInput {
  email: string;
  passwordHash: string;
  companyName: string;
  city: string;
  address: string;
  description?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findByIdWithProfile(id: string): Promise<UserWithProfileAndCompany | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        candidateProfile: { include: { availability: true } },
        company: true,
      },
    });
  }

  createCandidate(input: CreateCandidateUserInput): Promise<UserWithProfileAndCompany> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: 'CANDIDATE',
        candidateProfile: {
          create: {
            fullName: input.fullName,
            city: input.city,
            phone: input.phone ?? null,
          },
        },
      },
      include: {
        candidateProfile: { include: { availability: true } },
        company: true,
      },
    });
  }

  createEmployer(input: CreateEmployerUserInput): Promise<UserWithProfileAndCompany> {
    return this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        role: 'EMPLOYER',
        company: {
          create: {
            name: input.companyName,
            city: input.city,
            address: input.address,
            description: input.description ?? null,
          },
        },
      },
      include: {
        candidateProfile: { include: { availability: true } },
        company: true,
      },
    });
  }
}
