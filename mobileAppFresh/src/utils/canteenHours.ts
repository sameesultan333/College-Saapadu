/**
 * Opening-hours display helpers for CanteenSelectScreen. Pure, client-side
 * time-of-day math against `opens_at`/`closes_at` ("HH:MM:SS" strings from
 * the backend) -- no fabricated data, nothing shown when the field is null.
 */

const CLOSING_SOON_WINDOW_MINUTES = 10;

function parseTimeOfDayToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours * 60 + minutes;
}

export function formatTimeOfDay(value: string): string {
  const totalMinutes = parseTimeOfDayToMinutes(value);
  if (totalMinutes == null) return value;
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Minutes until `closesAt`, only when the canteen is open and that moment
 * is within the next CLOSING_SOON_WINDOW_MINUTES. Returns null otherwise
 * (already closed, closing time unknown, or not close enough yet) so the
 * caller never has to guess when to show the warning.
 */
export function minutesUntilClosing(isActive: boolean, closesAt?: string | null): number | null {
  if (!isActive || !closesAt) return null;
  const closeMinutes = parseTimeOfDayToMinutes(closesAt);
  if (closeMinutes == null) return null;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const diff = closeMinutes - nowMinutes;

  return diff > 0 && diff <= CLOSING_SOON_WINDOW_MINUTES ? diff : null;
}
