import { Module } from '@nestjs/common';
import { ScheduleMatcher } from './schedule-matcher.service';

@Module({
  providers: [ScheduleMatcher],
  exports: [ScheduleMatcher],
})
export class MatchingModule {}
