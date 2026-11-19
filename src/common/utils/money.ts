const KOPECKS_PER_RUBLE = 100;
const MINUTES_PER_HOUR = 60;

/** Рубли (число из API) -> копейки (хранение и расчёты). */
export function rublesToKopecks(rubles: number): number {
  return Math.round(rubles * KOPECKS_PER_RUBLE);
}

/** Копейки -> рубли для ответа API. */
export function kopecksToRubles(kopecks: number): number {
  return Math.round(kopecks) / KOPECKS_PER_RUBLE;
}

/** Стоимость работы за N минут при заданной ставке. */
export function calculatePayKopecks(hourlyRateKopecks: number, minutes: number): number {
  return Math.round((hourlyRateKopecks * minutes) / MINUTES_PER_HOUR);
}

/** Человекочитаемая сумма для сообщений об ошибках и предупреждений. */
export function formatRubles(kopecks: number): string {
  return `${kopecksToRubles(kopecks).toLocaleString('ru-RU')} ₽`;
}
