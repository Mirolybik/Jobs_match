import { Prisma } from '@prisma/client';

export type UserWithProfileAndCompany = Prisma.UserGetPayload<{
  include: {
    candidateProfile: { include: { availability: true } };
    company: true;
  };
}>;

export type CandidateProfileWithAvailability = Prisma.CandidateProfileGetPayload<{
  include: { availability: true };
}>;

export type CandidateProfileWithUser = Prisma.CandidateProfileGetPayload<{
  include: { availability: true; user: true };
}>;

export type CompanyWithOwner = Prisma.CompanyGetPayload<{ include: { owner: true } }>;
