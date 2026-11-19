import { Module } from '@nestjs/common';
import { ApplicationsModule } from '../applications/application.module';
import { VacanciesModule } from '../vacancies/vacancy.module';
import { ComplaintController } from './complaint.controller';
import { ComplaintRepository } from './complaint.repository';
import { ComplaintService } from './complaint.service';

@Module({
  imports: [VacanciesModule, ApplicationsModule],
  controllers: [ComplaintController],
  providers: [ComplaintService, ComplaintRepository],
  exports: [ComplaintService],
})
export class ComplaintsModule {}
