import type { ParsedTimeRange, ShiftType } from '../../types';

/**
 * Parse contract string to extract daily hours
 * Supports formats like:
 * - "30", "30HS", "30 hs", "30 horas" -> 6 hours
 * - "36", "36HS", "36 hs", "36 horas" -> 6 hours
 * - "35", "35HS", "35 hs", "35 horas" -> 7 hours
 */
export function parseContractHours(contract: string | number): {
  hours?: number;
  error?: string;
} {
  if (contract == null || contract === '') {
    return { error: 'Contrato vacío o inválido' };
  }
  const contract_str = String(contract);

  // Extract number from string
  const match = contract_str.match(/(\d+)/);
  if (!match) {
    return { error: 'No se pudo extraer número de horas del contrato' };
  }

  const weeklyHours = parseInt(match[1], 10);

  // Map weekly hours to daily hours
  if (weeklyHours === 30 || weeklyHours === 36) {
    return { hours: 6 };
  }
  if (weeklyHours === 35) {
    return { hours: 7 };
  }

  // Default assumptions for other values
  if (weeklyHours < 35) {
    return { hours: 6 };
  }
  return { hours: 7 };
}

/**
 * Parse time range string
 * Supports formats like:
 * - "06:00" -> entry at 06:00, exit calculated by contract
 * - "6:00" -> entry at 06:00
 * - "06 a 12" -> entry 06:00, exit 12:00
 * - "06:00 a 12:00" -> entry 06:00, exit 12:00
 * - "11 a 18" -> entry 11:00, exit 18:00
 * - "14:00" -> entry at 14:00
 */
export function parseTimeRange(
  timeString: string | number,
  dailyHours: number
): ParsedTimeRange & { error?: string } {
  // Handle Excel time serial (fraction 0–1)
  if (typeof timeString === 'number') {
    if (timeString > 0 && timeString < 1) {
      const totalMinutes = Math.round(timeString * 24 * 60);
      const h = Math.floor(totalMinutes / 60) % 24;
      const m = totalMinutes % 60;
      timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    } else {
      timeString = String(timeString);
    }
  }

  if (!timeString || typeof timeString !== 'string') {
    return {
      entryTime: '09:00',
      exitTime: '15:00',
      duration: dailyHours || 6,
      shift: 'midday',
      error: 'Horario vacío, usando valores por defecto',
    };
  }

  const cleaned = timeString.toLowerCase().trim();

  // Try to extract both times (format: "XX a YY" or "XX:00 a YY:00")
  const rangeMatch = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(?:a|al|-|–|to)\s*(\d{1,2})(?::(\d{2}))?/);

  let entryTime: string;
  let exitTime: string;
  let duration: number;

  if (rangeMatch) {
    // Has explicit entry and exit times
    const entryHour = parseInt(rangeMatch[1], 10);
    const entryMin = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : 0;
    const exitHour = parseInt(rangeMatch[3], 10);
    const exitMin = rangeMatch[4] ? parseInt(rangeMatch[4], 10) : 0;

    entryTime = formatTime(entryHour, entryMin);
    exitTime = formatTime(exitHour, exitMin);

    // Calculate duration
    duration = calculateDuration(entryHour, entryMin, exitHour, exitMin);
  } else {
    // Only entry time provided
    const singleMatch = cleaned.match(/(\d{1,2})(?::(\d{2}))?/);
    if (!singleMatch) {
      return {
        entryTime: '09:00',
        exitTime: '15:00',
        duration: dailyHours || 6,
        shift: 'midday',
        error: 'No se pudo parsear horario, usando valores por defecto',
      };
    }

    const entryHour = parseInt(singleMatch[1], 10);
    const entryMin = singleMatch[2] ? parseInt(singleMatch[2], 10) : 0;

    entryTime = formatTime(entryHour, entryMin);

    // Calculate exit time based on daily hours from contract
    const totalMinutes = entryHour * 60 + entryMin + dailyHours * 60;
    const exitHour24 = Math.floor(totalMinutes / 60) % 24;
    const exitMin24 = totalMinutes % 60;

    exitTime = formatTime(exitHour24, exitMin24);
    duration = dailyHours;
  }

  const shift: ShiftType = determineShift(parseInt(entryTime.split(':')[0], 10));

  return {
    entryTime,
    exitTime,
    duration,
    shift,
  };
}

/**
 * Format time as HH:mm
 */
function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

/**
 * Calculate duration between two times in hours
 */
function calculateDuration(
  entryHour: number,
  entryMin: number,
  exitHour: number,
  exitMin: number
): number {
  const entryTotal = entryHour * 60 + entryMin;
  let exitTotal = exitHour * 60 + exitMin;

  // Handle overnight (exit is next day)
  if (exitTotal < entryTotal) {
    exitTotal += 24 * 60;
  }

  return Math.round((exitTotal - entryTotal) / 60);
}

/**
 * Determine shift type based on entry hour
 */
export function determineShift(hour: number): ShiftType {
  if (hour >= 6 && hour < 10) {
    return 'morning';
  }
  if (hour >= 10 && hour < 14) {
    return 'midday';
  }
  if (hour >= 14 && hour < 18) {
    return 'afternoon';
  }
  if (hour >= 6 && hour < 18) {
    return 'full';
  }
  return 'full';
}

/**
 * Parse time string to minutes since midnight
 */
export function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * Format minutes since midnight to HH:mm
 */
export function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 24;
  const min = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

/**
 * Check if two time ranges overlap
 */
export function timeRangesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  const s1 = timeToMinutes(start1);
  const s2 = timeToMinutes(start2);

  // Normalize exit times: "00:00" means end of day (1440 min = midnight).
  // Also treat any exit that is <= its own start as end-of-day rather than
  // a genuine overnight shift — the app's shifts run 06:00–00:00 at most.
  let e1 = timeToMinutes(end1);
  let e2 = timeToMinutes(end2);
  if (e1 === 0 || e1 <= s1) e1 = 1440;
  if (e2 === 0 || e2 <= s2) e2 = 1440;

  return s1 < e2 && s2 < e1;
}

/**
 * Get shift display name
 */
export function getShiftDisplayName(shift: ShiftType): string {
  const names: Record<ShiftType, string> = {
    morning: 'Mañana',
    midday: 'Medio día',
    afternoon: 'Tarde',
    full: 'Completo',
  };
  return names[shift];
}

/**
 * Get shift time range
 */
export function getShiftTimeRange(shift: ShiftType): { start: string; end: string } {
  const ranges: Record<ShiftType, { start: string; end: string }> = {
    morning: { start: '06:00', end: '10:00' },
    midday: { start: '10:00', end: '14:00' },
    afternoon: { start: '14:00', end: '18:00' },
    full: { start: '06:00', end: '18:00' },
  };
  return ranges[shift];
}
