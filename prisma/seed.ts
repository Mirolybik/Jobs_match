import 'dotenv/config';
import {
  ApplicationStatus,
  Prisma,
  PrismaClient,
  Role,
  UserStatus,
  VacancyStatus,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

interface ScheduleSlot {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
}

const slot = (dayOfWeek: number, start: string, end: string): ScheduleSlot => ({
  dayOfWeek,
  startMinute: Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)),
  endMinute: Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5)),
});

const hoursFromNow = (hours: number): Date => new Date(Date.now() + hours * 60 * 60 * 1000);

async function upsertCandidate(
  email: string,
  passwordHash: string,
  profile: {
    fullName: string;
    city: string;
    phone?: string;
    about?: string;
    minHourlyRateKopecks?: number;
  },
  availability: ScheduleSlot[],
) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.CANDIDATE, status: UserStatus.ACTIVE },
    create: { email, passwordHash, role: Role.CANDIDATE },
  });

  const candidate = await prisma.candidateProfile.upsert({
    where: { userId: user.id },
    update: { ...profile },
    create: { userId: user.id, ...profile },
  });

  await prisma.availabilityInterval.deleteMany({ where: { candidateId: candidate.id } });
  await prisma.availabilityInterval.createMany({
    data: availability.map((item) => ({ candidateId: candidate.id, ...item })),
  });

  return candidate;
}

async function upsertEmployer(
  email: string,
  passwordHash: string,
  company: {
    name: string;
    city: string;
    address: string;
    description?: string;
  },
) {
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.EMPLOYER, status: UserStatus.ACTIVE },
    create: { email, passwordHash, role: Role.EMPLOYER },
  });

  const existing = await prisma.company.findUnique({ where: { ownerId: user.id } });
  return existing
    ? prisma.company.update({ where: { id: existing.id }, data: company })
    : prisma.company.create({ data: { ownerId: user.id, ...company } });
}

async function upsertVacancy(
  companyId: string,
  input: {
    title: string;
    description: string;
    city: string;
    address: string;
    hourlyRateKopecks: number;
    responseDeadlineHours: number;
    status?: VacancyStatus;
    schedule: ScheduleSlot[];
  },
) {
  const existing = await prisma.vacancy.findFirst({
    where: { companyId, title: input.title },
  });

  const status = input.status ?? VacancyStatus.PUBLISHED;
  const data = {
    title: input.title,
    description: input.description,
    city: input.city,
    address: input.address,
    hourlyRateKopecks: input.hourlyRateKopecks,
    responseDeadlineHours: input.responseDeadlineHours,
    status,
    ...(status === VacancyStatus.PUBLISHED ? { publishedAt: new Date() } : {}),
  };

  if (existing) {
    return prisma.vacancy.update({
      where: { id: existing.id },
      data: {
        ...data,
        schedule: {
          deleteMany: {},
          create: input.schedule,
        },
      },
      include: { schedule: true },
    });
  }

  return prisma.vacancy.create({
    data: {
      companyId,
      ...data,
      schedule: { create: input.schedule },
    },
    include: { schedule: true },
  });
}

async function ensureStatusHistory(
  applicationId: string,
  status: ApplicationStatus,
  candidateUserId: string,
  employerUserId: string,
  createdAt: Date,
): Promise<void> {
  const existing = await prisma.applicationStatusEvent.count({ where: { applicationId } });
  if (existing > 0) {
    return;
  }

  const events: Prisma.ApplicationStatusEventCreateManyInput[] = [
    {
      applicationId,
      status: ApplicationStatus.PENDING,
      actorId: candidateUserId,
      actorRole: Role.CANDIDATE,
      createdAt,
    },
  ];

  if (status !== ApplicationStatus.PENDING) {
    events.push({
      applicationId,
      status,
      previousStatus: ApplicationStatus.PENDING,
      actorId: employerUserId,
      actorRole: Role.EMPLOYER,
      createdAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
    });
  }

  await prisma.applicationStatusEvent.createMany({ data: events });
}

async function upsertApplication(
  vacancy: {
    id: string;
    hourlyRateKopecks: number;
    city: string;
    address: string;
    responseDeadlineHours: number;
    schedule: { dayOfWeek: number; startMinute: number; endMinute: number }[];
  },
  candidateId: string,
  candidateUserId: string,
  employerUserId: string,
  status: ApplicationStatus,
) {
  const takenAt = new Date();
  const deadlineAt = hoursFromNow(vacancy.responseDeadlineHours);

  const application = await prisma.application.upsert({
    where: { vacancyId_candidateId: { vacancyId: vacancy.id, candidateId } },
    update: {},
    create: {
      vacancyId: vacancy.id,
      candidateId,
      status,
      snapshotRateKopecks: vacancy.hourlyRateKopecks,
      snapshotCity: vacancy.city,
      snapshotAddress: vacancy.address,
      snapshotSchedule: vacancy.schedule.map((item) => ({
        dayOfWeek: item.dayOfWeek,
        start: `${String(Math.floor(item.startMinute / 60)).padStart(2, '0')}:${String(item.startMinute % 60).padStart(2, '0')}`,
        end: `${String(Math.floor(item.endMinute / 60)).padStart(2, '0')}:${String(item.endMinute % 60).padStart(2, '0')}`,
      })) as unknown as Prisma.InputJsonValue,
      snapshotDeadlineHours: vacancy.responseDeadlineHours,
      snapshotTakenAt: takenAt,
      deadlineAt,
      ...(status !== ApplicationStatus.PENDING ? { decidedAt: new Date() } : {}),
    },
  });

  await ensureStatusHistory(
    application.id,
    status,
    candidateUserId,
    employerUserId,
    application.createdAt,
  );

  return application;
}

async function main(): Promise<void> {
  const [adminHash, candidateHash, employerHash] = await Promise.all([
    bcrypt.hash('Admin12345', BCRYPT_ROUNDS),
    bcrypt.hash('Candidate123', BCRYPT_ROUNDS),
    bcrypt.hash('Employer123', BCRYPT_ROUNDS),
  ]);

  await prisma.user.upsert({
    where: { email: 'admin@jobsmatch.ru' },
    update: { passwordHash: adminHash, role: Role.ADMIN, status: UserStatus.ACTIVE },
    create: { email: 'admin@jobsmatch.ru', passwordHash: adminHash, role: Role.ADMIN },
  });

  const anna = await upsertCandidate(
    'anna@jobsmatch.ru',
    candidateHash,
    {
      fullName: 'Анна Смирнова',
      city: 'Москва',
      phone: '+7 999 123-45-67',
      about: 'Студентка, ищу подработку по вечерам и выходным',
      minHourlyRateKopecks: 35_000,
    },
    [slot(2, '18:00', '22:00'), slot(4, '18:00', '22:00'), slot(6, '10:00', '18:00')],
  );

  const oleg = await upsertCandidate(
    'oleg@jobsmatch.ru',
    candidateHash,
    {
      fullName: 'Олег Петров',
      city: 'Москва',
      minHourlyRateKopecks: 30_000,
    },
    [slot(2, '18:00', '22:00'), slot(4, '18:00', '22:00'), slot(6, '10:00', '14:00')],
  );

  const company = await upsertEmployer('hr@ritm.ru', employerHash, {
    name: 'Кофейня «Ритм»',
    city: 'Москва',
    address: 'ул. Тверская, 12',
    description: 'Кофейня в центре города',
  });

  const barista = await upsertVacancy(company.id, {
    title: 'Бариста',
    description: 'Обслуживание гостей, приготовление напитков. Обучение за счёт компании.',
    city: 'Москва',
    address: 'ул. Тверская, 12',
    hourlyRateKopecks: 40_000,
    responseDeadlineHours: 48,
    schedule: [slot(2, '18:00', '22:00'), slot(4, '18:00', '22:00')],
  });

  const seller = await upsertVacancy(company.id, {
    title: 'Продавец-консультант',
    description: 'Работа в торговом зале, консультации покупателей.',
    city: 'Москва',
    address: 'ул. Арбат, 5',
    hourlyRateKopecks: 35_000,
    responseDeadlineHours: 72,
    schedule: [slot(3, '12:00', '17:00')],
  });

  const courier = await upsertVacancy(company.id, {
    title: 'Курьер',
    description: 'Доставка заказов по центру города.',
    city: 'Москва',
    address: 'ул. Тверская, 12',
    hourlyRateKopecks: 30_000,
    responseDeadlineHours: 24,
    schedule: [slot(6, '10:00', '14:00')],
  });

  await upsertVacancy(company.id, {
    title: 'Помощник на выходные',
    description: 'Черновик вакансии для демонстрации кабинета работодателя.',
    city: 'Москва',
    address: 'ул. Тверская, 12',
    hourlyRateKopecks: 45_000,
    responseDeadlineHours: 48,
    status: VacancyStatus.DRAFT,
    schedule: [slot(6, '10:00', '18:00')],
  });

  await upsertApplication(
    barista,
    anna.id,
    anna.userId,
    company.ownerId,
    ApplicationStatus.PENDING,
  );
  await upsertApplication(
    courier,
    oleg.id,
    oleg.userId,
    company.ownerId,
    ApplicationStatus.INVITED,
  );

  const existingComplaint = await prisma.complaint.findFirst({
    where: { authorId: anna.userId, vacancyId: seller.id, reason: 'Несовпадение условий' },
  });

  if (!existingComplaint) {
    await prisma.complaint.create({
      data: {
        authorId: anna.userId,
        vacancyId: seller.id,
        reason: 'Несовпадение условий',
        comment: 'В вакансии указано рабочее время, которого нет в моём графике.',
      },
    });
  }

  console.log('Демо-данные загружены:');
  console.log('  admin@jobsmatch.ru / Admin12345');
  console.log('  anna@jobsmatch.ru / Candidate123');
  console.log('  oleg@jobsmatch.ru / Candidate123');
  console.log('  hr@ritm.ru / Employer123');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
