import type { Agent, AssignmentConflict, AssignmentStats, Box, BoxOccupation } from '../../types';
import { timeToMinutes } from '../utils/timeParser';

/**
 * Calculate statistics from current assignments
 */
export function calculateStats(
  agents: Agent[],
  boxes: Box[],
  assignments: Map<string, string>
): AssignmentStats {
  const totalAgents = agents.length;
  const assignedAgents = assignments.size;
  const unassignedAgents = totalAgents - assignedAgents;

  const activeBoxes = boxes.filter((b) => b.type === 'box' && b.activo);
  const totalBoxes = activeBoxes.length;
  const usedBoxes = new Set(assignments.values()).size;

  const occupationRate = totalBoxes > 0 ? (usedBoxes / totalBoxes) * 100 : 0;

  // Calculate reused boxes
  const boxOccupants = new Map<string, Agent[]>();
  assignments.forEach((boxId, agentId) => {
    if (!boxOccupants.has(boxId)) {
      boxOccupants.set(boxId, []);
    }
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      boxOccupants.get(boxId)!.push(agent);
    }
  });

  let reusedBoxes = 0;
  boxOccupants.forEach((occupants) => {
    if (occupants.length > 1) {
      reusedBoxes++;
    }
  });

  // Calculate fragmentation
  const fragmentationScore = calculateFragmentation(assignments, agents);

  return {
    totalAgents,
    assignedAgents,
    unassignedAgents,
    totalBoxes,
    usedBoxes,
    occupationRate: Math.round(occupationRate),
    reusedBoxes,
    fragmentationScore,
  };
}

/**
 * Calculate team fragmentation score
 */
function calculateFragmentation(assignments: Map<string, string>, agents: Agent[]): number {
  const teams = new Map<string, Set<string>>();
  const teamBoxes = new Map<string, Set<string>>();

  assignments.forEach((boxId, agentId) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      const leader = agent.jefe;
      if (!teams.has(leader)) {
        teams.set(leader, new Set());
        teamBoxes.set(leader, new Set());
      }
      teams.get(leader)!.add(agentId);
      teamBoxes.get(leader)!.add(boxId);
    }
  });

  let totalSpread = 0;
  let teamCount = 0;

  teamBoxes.forEach((boxIds) => {
    if (boxIds.size > 1) {
      const rows = new Set<string>();

      boxIds.forEach((id) => {
        const [, boxNum] = id.split('-');
        const row = Math.ceil(parseInt(boxNum) / 12);
        rows.add(row.toString());
      });

      totalSpread += rows.size;
      teamCount++;
    }
  });

  return teamCount > 0 ? Math.round((totalSpread / teamCount) * 10) : 0;
}

/**
 * Calculate occupancy by hour
 */
export function calculateHourlyOccupation(
  boxes: Box[],
  startHour: number = 6,
  endHour: number = 18
): Map<number, number> {
  const hourlyOccupation = new Map<number, number>();

  for (let hour = startHour; hour <= endHour; hour++) {
    let occupied = 0;

    boxes.forEach((box) => {
      if (box.occupations && box.occupations.length > 0) {
        const hourMinutes = hour * 60;

        const isOccupied = box.occupations.some((occ: BoxOccupation) => {
          const start = timeToMinutes(occ.entryTime);
          const end = timeToMinutes(occ.exitTime);
          return hourMinutes >= start && hourMinutes < end;
        });

        if (isOccupied) {
          occupied++;
        }
      }
    });

    hourlyOccupation.set(hour, occupied);
  }

  return hourlyOccupation;
}

/**
 * Calculate shift statistics
 */
export function calculateShiftStats(agents: Agent[], boxes: Box[]) {
  void boxes;
  const shifts = ['morning', 'midday', 'afternoon'] as const;

  return shifts.map((shift) => {
    const shiftAgents = agents.filter((a) => a.shift === shift);
    const assignedCount = shiftAgents.filter((a) => a.boxId).length;

    return {
      shift,
      total: shiftAgents.length,
      assigned: assignedCount,
      unassigned: shiftAgents.length - assignedCount,
    };
  });
}

/**
 * Calculate team statistics
 */
export function calculateTeamStats(agents: Agent[], leaderField: 'jefe' | 'superior') {
  const teamStats = new Map<string, { total: number; assigned: number; boxes: Set<string> }>();

  agents.forEach((agent) => {
    const leader = leaderField === 'jefe' ? agent.jefe : agent.superior;

    if (!teamStats.has(leader)) {
      teamStats.set(leader, { total: 0, assigned: 0, boxes: new Set() });
    }

    const stats = teamStats.get(leader)!;
    stats.total++;

    if (agent.boxId) {
      stats.assigned++;
      stats.boxes.add(agent.boxId);
    }
  });

  return Array.from(teamStats.entries())
    .map(([leader, stats]) => ({
      leader,
      total: stats.total,
      assigned: stats.assigned,
      unassigned: stats.total - stats.assigned,
      boxCount: stats.boxes.size,
      fragmented: stats.boxes.size > 1,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Calculate segment statistics
 */
export function calculateSegmentStats(agents: Agent[]) {
  const segmentStats = new Map<string, { total: number; assigned: number; boxes: Set<string> }>();

  agents.forEach((agent) => {
    const segment = agent.segmento || 'Sin segmento';

    if (!segmentStats.has(segment)) {
      segmentStats.set(segment, { total: 0, assigned: 0, boxes: new Set() });
    }

    const stats = segmentStats.get(segment)!;
    stats.total++;

    if (agent.boxId) {
      stats.assigned++;
      stats.boxes.add(agent.boxId);
    }
  });

  return Array.from(segmentStats.entries())
    .map(([segment, stats]) => ({
      segment,
      total: stats.total,
      assigned: stats.assigned,
      unassigned: stats.total - stats.assigned,
      boxCount: stats.boxes.size,
      fragmented: stats.boxes.size > 1,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Get boxes with available time slots
 */
export function getAvailableBoxesByTime(
  boxes: Box[],
  targetTime: string,
  durationHours: number
): Array<{ box: Box; availableSlots: Array<{ start: string; end: string }> }> {
  void targetTime;
  const durationMinutes = durationHours * 60;

  return boxes
    .filter((b) => b.type === 'box' && b.activo)
    .map((box) => {
      const availableSlots: Array<{ start: string; end: string }> = [];

      if (!box.occupations || box.occupations.length === 0) {
        // Box is free all day
        availableSlots.push({
          start: '06:00',
          end: '18:00',
        });
      } else {
        // Find gaps between occupations
        const sortedOccupations = [...box.occupations].sort(
          (a: BoxOccupation, b: BoxOccupation) =>
            timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime)
        );

        let previousEnd = 6 * 60; // Start at 06:00

        for (const occ of sortedOccupations) {
          const start = timeToMinutes(occ.entryTime);
          const end = timeToMinutes(occ.exitTime);

          // Check gap before this occupation
          if (start - previousEnd >= durationMinutes) {
            availableSlots.push({
              start: minutesToTime(previousEnd),
              end: minutesToTime(start),
            });
          }

          previousEnd = Math.max(previousEnd, end);
        }

        // Check gap after last occupation
        const dayEnd = 18 * 60;
        if (dayEnd - previousEnd >= durationMinutes) {
          availableSlots.push({
            start: minutesToTime(previousEnd),
            end: minutesToTime(dayEnd),
          });
        }
      }

      return {
        box,
        availableSlots,
      };
    })
    .filter((result) => result.availableSlots.length > 0);
}

/**
 * Convert minutes since midnight to HH:mm format
 */
function minutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ============================================================
// CAPACITY SUGGESTIONS
// ============================================================

export interface CapacitySuggestion {
  type: 'error' | 'warning' | 'info';
  title: string;
  detail: string;
}

/**
 * Generate actionable suggestions when there are unassigned agents
 */
export function generateCapacitySuggestions(
  agents: Agent[],
  boxes: Box[],
  stats: AssignmentStats
): CapacitySuggestion[] {
  if (stats.unassignedAgents === 0) return [];

  const suggestions: CapacitySuggestion[] = [];
  const activeBoxes = boxes.filter((b) => b.type === 'box' && b.activo).length;
  const unassigned = agents.filter(
    (a) => a.assignmentStatus === 'unassigned' || a.assignmentStatus === 'conflict'
  );

  // 1. Resumen general
  suggestions.push({
    type: 'error',
    title: `${stats.unassignedAgents} agente${stats.unassignedAgents > 1 ? 's' : ''} sin lugar`,
    detail: `${stats.totalAgents} agentes para ${activeBoxes} boxes físicos. Faltan ${Math.max(0, stats.totalAgents - activeBoxes)} lugares si todos entran al mismo tiempo.`,
  });

  // 2. Detectar hora pico de demanda real (cuántos agentes hay activos por hora)
  const concurrentByHour = new Map<number, number>();
  for (let h = 6; h <= 22; h++) {
    const count = agents.filter((a) => {
      const start = timeToMinutes(a.entryTime);
      const end = timeToMinutes(a.exitTime);
      return h * 60 >= start && h * 60 < end;
    }).length;
    if (count > 0) concurrentByHour.set(h, count);
  }

  let peakHour = 6;
  let peakDemand = 0;
  concurrentByHour.forEach((count, hour) => {
    if (count > peakDemand) { peakDemand = count; peakHour = hour; }
  });

  if (peakDemand > activeBoxes) {
    suggestions.push({
      type: 'error',
      title: `Sobrecapacidad a las ${peakHour}:00`,
      detail: `${peakDemand} agentes simultáneos vs ${activeBoxes} boxes disponibles. Sobran ${peakDemand - activeBoxes} personas en ese horario.`,
    });
    suggestions.push({
      type: 'info',
      title: 'Escalonar horarios de ingreso',
      detail: `Si los ingresos se distribuyen para que nunca haya más de ${activeBoxes} agentes a la vez, todos tendrían lugar. Revisá cuántos entran juntos a las ${peakHour}:00.`,
    });
  }

  // 3. Desglose por turno
  const shiftNames: Record<string, string> = {
    morning: 'mañana', midday: 'mediodía', afternoon: 'tarde', full: 'completo',
  };
  const byShift = new Map<string, number>();
  unassigned.forEach((a) => {
    byShift.set(a.shift, (byShift.get(a.shift) || 0) + 1);
  });
  byShift.forEach((count, shift) => {
    suggestions.push({
      type: 'warning',
      title: `Turno ${shiftNames[shift] || shift}: ${count} sin asignar`,
      detail: `No hay boxes libres para todos los que ingresan en el turno ${shiftNames[shift] || shift}.`,
    });
  });

  // 4. Boxes reutilizables disponibles
  const reusableOpportunities = countReusableOpportunities(boxes, unassigned);
  if (reusableOpportunities > 0) {
    suggestions.push({
      type: 'info',
      title: `${reusableOpportunities} boxes podrían compartirse`,
      detail: `Hay boxes que están libres en los horarios de los agentes sin asignar. El sistema debería haber intentado asignarlos — revisá si hay reglas de zona que los restringen.`,
    });
  }

  // 5. Lista de afectados (si son pocos)
  if (unassigned.length <= 8) {
    suggestions.push({
      type: 'info',
      title: 'Agentes sin lugar',
      detail: unassigned.map((a) => `${a.nombre} (${a.entryTime}–${a.exitTime})`).join(' · '),
    });
  } else {
    const sample = unassigned.slice(0, 5).map((a) => a.nombre).join(', ');
    suggestions.push({
      type: 'info',
      title: 'Agentes sin lugar',
      detail: `${sample} y ${unassigned.length - 5} más.`,
    });
  }

  return suggestions;
}

function countReusableOpportunities(boxes: Box[], unassigned: Agent[]): number {
  let count = 0;
  for (const agent of unassigned) {
    const hasBox = boxes.some((box) => {
      if (box.type !== 'box' || !box.activo) return false;
      return !box.occupations?.some((occ) => {
        const s1 = timeToMinutes(agent.entryTime);
        const e1 = timeToMinutes(agent.exitTime);
        const s2 = timeToMinutes(occ.entryTime);
        const e2 = timeToMinutes(occ.exitTime);
        return s1 < e2 && s2 < e1;
      });
    });
    if (hasBox) count++;
  }
  return count;
}

/**
 * Calculate conflict summary
 */
export function calculateConflictSummary(conflicts: AssignmentConflict[]) {
  const byType = new Map<string, number>();
  const byAgent = new Map<string, number>();
  const byBox = new Map<string, number>();

  conflicts.forEach((conflict) => {
    // Count by type
    byType.set(conflict.type, (byType.get(conflict.type) || 0) + 1);

    // Count by agent
    conflict.agentIds?.forEach((agentId: string) => {
      byAgent.set(agentId, (byAgent.get(agentId) || 0) + 1);
    });

    // Count by box
    conflict.boxIds?.forEach((boxId: string) => {
      byBox.set(boxId, (byBox.get(boxId) || 0) + 1);
    });
  });

  return {
    total: conflicts.length,
    byType: Object.fromEntries(byType),
    affectedAgents: byAgent.size,
    affectedBoxes: byBox.size,
    topConflictingAgents: Array.from(byAgent.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
    topConflictingBoxes: Array.from(byBox.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5),
  };
}
