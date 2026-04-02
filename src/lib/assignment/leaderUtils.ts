import type { Box, Leader } from '../../types';

// leaderName → boxId (the LID cell assigned to that leader)
export type LeaderBoxMap = Map<string, string>;

// Legacy type kept for backwards-compat during transition
export type LeaderAssignments = Record<string, string>;

export function normalizeName(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function leaderNamesMatch(a: string | undefined, b: string | undefined): boolean {
  const normalizedA = normalizeName(a);
  const normalizedB = normalizeName(b);
  return normalizedA.length > 0 && normalizedA === normalizedB;
}

/**
 * Given a leader's name, return the Box they are assigned to.
 * Uses the LeaderBoxMap (leaderName → boxId) produced by assignLeaders().
 */
export function findLeaderReferenceBox(
  leaderName: string,
  boxes: Box[],
  leaderBoxMap: LeaderBoxMap
): Box | undefined {
  if (!leaderName) return undefined;

  // Exact match first
  const boxId = leaderBoxMap.get(leaderName);
  if (boxId) return boxes.find((b) => b.id === boxId);

  // Case-insensitive fallback
  for (const [name, id] of leaderBoxMap) {
    if (leaderNamesMatch(name, leaderName)) {
      return boxes.find((b) => b.id === id);
    }
  }

  return undefined;
}

/**
 * Build a LeaderBoxMap from the leaders array after assignment.
 * leaders[i].boxId is set by assignLeaders().
 */
export function buildLeaderBoxMap(leaders: Leader[]): LeaderBoxMap {
  const map: LeaderBoxMap = new Map();
  leaders.forEach((l) => {
    if (l.boxId) map.set(l.nombre, l.boxId);
  });
  return map;
}
