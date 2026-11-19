import { Module } from '@nestjs/common';
import { ComplaintsModule } from '../complaints/complaint.module';
import { VacanciesModule } from '../vacancies/vacancy.module';
import { AdminController } from './admin.controller';
import { AdminRepository } from './admin.repository';
import { AdminService } from './admin.service';

@Module({
  imports: [VacanciesModule, ComplaintsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository],
})
export class AdminModule {}
