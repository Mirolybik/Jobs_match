import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidate.module';
import { CompaniesModule } from '../companies/company.module';
import { MatchingModule } from '../matching/matching.module';
import { VacancyController } from './vacancy.controller';
import { VacancyRepository } from './vacancy.repository';
import { VacancyService } from './vacancy.service';

@Module({
  imports: [CandidatesModule, CompaniesModule, MatchingModule],
  controllers: [VacancyController],
  providers: [VacancyService, VacancyRepository],
  exports: [VacancyService, VacancyRepository],
})
export class VacanciesModule {}
