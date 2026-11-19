import { Injectable } from '@nestjs/common';
import { MatchOptions, VacancyMatch } from './domain/vacancy-match';
import { WeeklySchedule } from './domain/weekly-schedule';

@Injectable()
export class ScheduleMatcher {
  match(
    vacancySchedule: WeeklySchedule,
    candidateSchedule: WeeklySchedule,
    options: MatchOptions,
  ): VacancyMatch {
    return VacancyMatch.evaluate(vacancySchedule, candidateSchedule, options);
  }
}
