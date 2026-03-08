export interface CourseScheduleSlot {
  id?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  module_count: number;
  order_index?: number;
}

const dayLabels = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

export function getWeekdayLabel(dayOfWeek: number) {
  return dayLabels[dayOfWeek] || `Día ${dayOfWeek}`;
}

export function formatTimeRange(startTime: string, endTime: string) {
  const format = (value: string) => value.slice(0, 5);
  if (!startTime || !endTime) return "";
  return `${format(startTime)} a ${format(endTime)}`;
}

export function formatScheduleSlot(slot: CourseScheduleSlot) {
  const modulesLabel = slot.module_count === 1 ? "1 módulo" : `${slot.module_count} módulos`;
  return `${getWeekdayLabel(slot.day_of_week)} · ${formatTimeRange(slot.start_time, slot.end_time)} · ${modulesLabel}`;
}

function buildScheduledDate(academicYear: number, dayOfWeek: number, month: number, weekOffset: number) {
  const baseDate = new Date(Date.UTC(academicYear, month - 1, 1));
  const baseIsoDay = baseDate.getUTCDay() === 0 ? 7 : baseDate.getUTCDay();
  const dayOffset = (dayOfWeek - baseIsoDay + 7) % 7;
  baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset + weekOffset * 7);
  return baseDate.toISOString().slice(0, 10);
}

export function getSchedulePreviewForLesson(
  academicYear: number,
  slots: CourseScheduleSlot[],
  lessonNumber: number,
  term: number
) {
  const orderedSlots = [...slots].sort((left, right) => {
    const orderDiff = (left.order_index ?? 0) - (right.order_index ?? 0);
    if (orderDiff !== 0) return orderDiff;
    const dayDiff = left.day_of_week - right.day_of_week;
    if (dayDiff !== 0) return dayDiff;
    return left.start_time.localeCompare(right.start_time);
  });

  if (orderedSlots.length === 0) {
    return { slot: null as CourseScheduleSlot | null, scheduledDate: null as string | null };
  }

  const termIndex = term === 1 ? lessonNumber - 1 : Math.max(lessonNumber - 15, 0);
  const slot = orderedSlots[termIndex % orderedSlots.length];
  const weekOffset = Math.floor(termIndex / orderedSlots.length);
  const scheduledDate = buildScheduledDate(academicYear, slot.day_of_week, term === 1 ? 3 : 8, weekOffset);

  return { slot, scheduledDate };
}

export function formatScheduledDate(date: string | null) {
  if (!date) return "Sin fecha asignada";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
