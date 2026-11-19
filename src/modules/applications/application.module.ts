import { Module } from '@nestjs/common';
import { CandidatesModule } from '../candidates/candidate.module';
import { MatchingModule } from '../matching/matching.module';
import { VacanciesModule } from '../vacancies/vacancy.module';
import { ApplicationController } from './application.controller';
import { ApplicationRepository } from './application.repository';
import { ApplicationService } from './application.service';
import { VacancyApplicationController } from './vacancy-application.controller';

@Module({
  imports: [VacanciesModule, CandidatesModule, MatchingModule],
  controllers: [ApplicationController, VacancyApplicationController],
  providers: [ApplicationService, ApplicationRepository],
  exports: [ApplicationService, ApplicationRepository],
})
export class ApplicationsModule {}
