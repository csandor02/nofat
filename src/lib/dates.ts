const zone = 'Europe/Bucharest';

export function formatDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', ...options, timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatInstant(value: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zone }).format(new Date(value));
}

export function formatWeek(start: string) {
  const date = new Date(`${start}T00:00:00Z`);
  const end = new Date(date);
  end.setUTCDate(end.getUTCDate() + 6);
  return `${formatDate(start, { month: 'short' })} - ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(end)}`;
}

export function bucharestDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: zone }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
