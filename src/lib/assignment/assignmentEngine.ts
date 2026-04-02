import type {
  Agent,
  AppConfig,
  AssignmentConflict,
  AssignmentResult,
  AssignmentStats,
  Box,
  Leader,
  Rule,
  ZoneRestrictionRule,
} from '../../types';
import { calculateAssignmentScore } from './ruleEngine';
import { leaderNamesMatch, buildLeaderBoxMap, type LeaderBoxMap } from './leaderUtils';
import { timeRangesOverlap, timeToMinutes } from '../utils/timeParser';

// ─────────────────────────────────────────────
// LEADER ASSIGNMENT
// ─────────────────────────────────────────────

/**
 * Assign leaders to LID cells (type === 'lid').
 *
 * Priority:
 *   1. Manual override from config.leaderBoxAssignments (lidLabel → leaderName)
 *   2. Morning-first order, then largest team
 *
 * Two leaders can share a LID only if their time slots do NOT overlap.
 *
 * Returns: Map<leaderId, boxId>
 */
export function assignLeaders(
  leaders: Leader[],
  allBoxes: Box[],
  config: AppConfig
): Map<string, string> {
  const result = new Map<string, string>(); // leaderId → boxId

  const lidBoxes = allBoxes
    .filter((b) => b.type === 'lid' && b.activo)
    .map((b) => ({ ...b, occupations: [...b.occupations] }));

  // Build reverse map: leaderName → lidLabel (from manual config)
  const manualByLeader = new Map<string, string>(); // leaderName → lidLabel
  Object.entries(config.leaderBoxAssignments || {}).forEach(([lid, leaderName]) => {
    if (leaderName) manualByLeader.set(leaderName.toLowerCase().trim(), lid);
  });

  // Leaders already sorted morning-first / largest team (from csvParser)
  for (const leader of leaders) {
    // Check manual override
    const manualLid = manualByLeader.get(leader.nombre.toLowerCase().trim());

    if (manualLid) {
      const lidBox = lidBoxes.find((b) => b.label === manualLid);
      if (lidBox && canLeaderUseBox(leader, lidBox)) {
        result.set(leader.id, lidBox.id);
        addLeaderOccupation(lidBox, leader);
        continue;
      }
    }

    // Auto-assign: find first available LID with no time conflict
    for (const lidBox of lidBoxes) {
      if (canLeaderUseBox(leader, lidBox)) {
        result.set(leader.id, lidBox.id);
        addLeaderOccupation(lidBox, leader);
        break;
      }
    }
  }

  return result;
}

function canLeaderUseBox(leader: Leader, box: Box): boolean {
  for (const occ of box.occupations) {
    if (timeRangesOverlap(leader.entryTime, leader.exitTime, occ.entryTime, occ.exitTime)) {
      return false;
    }
  }
  return true;
}

function addLeaderOccupation(box: Box, leader: Leader): void {
  box.occupations.push({
    agentId: leader.id,
    agentName: leader.nombre,
    entryTime: leader.entryTime,
    exitTime: leader.exitTime,
    leader: '',
    segment: '',
  });
}

// ─────────────────────────────────────────────
// AGENT ASSIGNMENT
// ─────────────────────────────────────────────

/**
 * Main assignment engine — assigns regular agents to regular boxes (type === 'box').
 * LID cells are reserved for leaders and are never considered here.
 */
export function assignBoxes(
  agents: Agent[],
  layout: { boxes: Box[] },
  rules: Rule[],
  config: AppConfig,
  existingAssignments: Map<string, string>,
  leaderBoxMap: LeaderBoxMap
): AssignmentResult {
  void existingAssignments;

  // Only regular boxes for agents
  const boxes = layout.boxes
    .filter((b) => b.type === 'box')
    .map((b) => ({ ...b, occupations: [] as Box['occupations'], status: 'available' as const }));

  const conflicts: AssignmentConflict[] = [];

  // Locked agents keep their assignment
  const lockedAgents = agents.filter((a) => a.isLocked && a.boxId);
  const assignments = new Map<string, string>();

  lockedAgents.forEach((agent) => {
    if (agent.boxId) assignments.set(agent.id, agent.boxId);
  });

  const agentsToAssign = agents.filter((a) => !a.isLocked || !a.boxId);
  const sortedAgents = sortAgentsByPriority(agentsToAssign);

  for (const agent of sortedAgents) {
    if (agent.isLocked && agent.boxId) continue;

    const leaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
    const leaderBox = leaderBoxMap.get(leaderName) != null
      ? boxes.find((b) => b.id === leaderBoxMap.get(leaderName)) ??
        layout.boxes.find((b) => b.id === leaderBoxMap.get(leaderName))
      : undefined;

    const result = findBestBox(agent, boxes, rules, config, assignments, agents, leaderBoxMap, leaderBox);

    if (result.box) {
      assignments.set(agent.id, result.box.id);
      addOccupation(result.box, agent);
    } else {
      conflicts.push({
        type: 'no-space',
        agentIds: [agent.id],
        message: `No hay boxes disponibles para ${agent.nombre}`,
        severity: 'error',
      });
    }
  }

  const timeConflicts = checkTimeConflicts(assignments, agents, boxes);
  conflicts.push(...timeConflicts);

  const stats = calculateAssignmentStats(assignments, agents, boxes);

  return { assignments, conflicts, stats, satisfiedRules: [], violatedRules: [] };
}

// ─────────────────────────────────────────────
// INTERNAL HELPERS
// ─────────────────────────────────────────────

function sortAgentsByPriority(agents: Agent[]): Agent[] {
  return [...agents].sort((a, b) => {
    const aTime = timeToMinutes(a.entryTime);
    const bTime = timeToMinutes(b.entryTime);
    return aTime - bTime;
  });
}

function findBestBox(
  agent: Agent,
  allBoxes: Box[],
  rules: Rule[],
  config: AppConfig,
  assignments: Map<string, string>,
  allAgents: Agent[],
  leaderBoxMap: LeaderBoxMap,
  leaderBox?: Box
): { box?: Box; score: number } {
  let bestBox: Box | undefined;
  let bestScore = -Infinity;

  for (const box of allBoxes) {
    if (!canAssignToBox(agent, box, rules, config)) continue;

    const score = calculateAssignmentScore(
      agent, box, rules, config, assignments, allAgents, leaderBoxMap, leaderBox, allBoxes
    );

    if (score > bestScore) {
      bestScore = score;
      bestBox = box;
    }
  }

  return { box: bestBox, score: bestScore };
}

function canAssignToBox(
  agent: Agent,
  box: Box,
  rules: Rule[],
  config: AppConfig
): boolean {
  // Only regular boxes for agents
  if (box.type !== 'box' || !box.activo) return false;

  // No time overlap with current occupants
  for (const occupation of box.occupations) {
    if (timeRangesOverlap(agent.entryTime, agent.exitTime, occupation.entryTime, occupation.exitTime)) {
      return false;
    }
  }

  const leaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;

  // Zone restriction rules (hard constraints)
  for (const rule of rules) {
    if (!rule.enabled || rule.type !== 'zone-restriction') continue;
    const r: ZoneRestrictionRule = rule;
    let targetValue = '';
    if (r.targetType === 'segment') targetValue = agent.segmento;
    else if (r.targetType === 'team' || r.targetType === 'leader') targetValue = leaderName;

    if (targetValue && targetValue === r.targetValue) {
      if (r.forbiddenZoneIds?.includes(box.zona)) return false;
      if (r.allowedZoneIds?.length > 0 && !r.allowedZoneIds.includes(box.zona)) return false;
    }
  }

  return true;
}

function addOccupation(box: Box, agent: Agent): void {
  box.occupations.push({
    agentId: agent.id,
    agentName: agent.nombre,
    entryTime: agent.entryTime,
    exitTime: agent.exitTime,
    leader: agent.jefe,
    segment: agent.segmento,
  });
  box.occupations.sort((a, b) => timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime));
  updateBoxStatus(box);
}

function updateBoxStatus(box: Box): void {
  if (box.occupations.length === 0) { box.status = 'available'; return; }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentOcc = box.occupations.find((occ) => {
    const s = timeToMinutes(occ.entryTime);
    const e = timeToMinutes(occ.exitTime);
    return currentMinutes >= s && currentMinutes < e;
  });
  if (currentOcc) {
    box.currentOccupant = currentOcc;
    box.status = 'occupied';
  } else {
    box.currentOccupant = undefined;
    const next = box.occupations.find((occ) => timeToMinutes(occ.entryTime) > currentMinutes);
    if (next) { box.nextOccupant = next; box.status = 'available-from'; box.availableFrom = next.entryTime; }
    else { box.nextOccupant = undefined; box.status = 'available'; }
  }
}

function checkTimeConflicts(
  assignments: Map<string, string>,
  agents: Agent[],
  boxes: Box[]
): AssignmentConflict[] {
  void boxes;
  const conflicts: AssignmentConflict[] = [];
  const boxAgents = new Map<string, Agent[]>();

  assignments.forEach((boxId, agentId) => {
    if (!boxAgents.has(boxId)) boxAgents.set(boxId, []);
    const agent = agents.find((a) => a.id === agentId);
    if (agent) boxAgents.get(boxId)!.push(agent);
  });

  boxAgents.forEach((list, boxId) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a1 = list[i], a2 = list[j];
        if (timeRangesOverlap(a1.entryTime, a1.exitTime, a2.entryTime, a2.exitTime)) {
          conflicts.push({
            type: 'overlap',
            agentIds: [a1.id, a2.id],
            boxIds: [boxId],
            message: `Solapamiento horario entre ${a1.nombre} y ${a2.nombre}`,
            severity: 'error',
          });
        }
      }
    }
  });

  return conflicts;
}

function calculateAssignmentStats(
  assignments: Map<string, string>,
  agents: Agent[],
  boxes: Box[]
): AssignmentStats {
  const totalAgents = agents.length;
  const assignedAgents = assignments.size;
  const unassignedAgents = totalAgents - assignedAgents;
  const activeBoxes = boxes.filter((b) => b.type === 'box' && b.activo);
  const totalBoxes = activeBoxes.length;
  const usedBoxes = new Set(assignments.values()).size;
  const occupationRate = totalBoxes > 0 ? (usedBoxes / totalBoxes) * 100 : 0;

  let reusedBoxes = 0;
  const boxOccupants = new Map<string, Agent[]>();
  assignments.forEach((boxId, agentId) => {
    if (!boxOccupants.has(boxId)) boxOccupants.set(boxId, []);
    const agent = agents.find((a) => a.id === agentId);
    if (agent) boxOccupants.get(boxId)!.push(agent);
  });
  boxOccupants.forEach((occupants) => { if (occupants.length > 1) reusedBoxes++; });

  const fragmentationScore = calculateFragmentation(assignments, agents, boxes);

  return {
    totalAgents, assignedAgents, unassignedAgents,
    totalBoxes, usedBoxes,
    occupationRate: Math.round(occupationRate),
    reusedBoxes, fragmentationScore,
  };
}

function calculateFragmentation(
  assignments: Map<string, string>,
  agents: Agent[],
  boxes: Box[]
): number {
  const teams = new Map<string, string[]>();
  assignments.forEach((boxId, agentId) => {
    const agent = agents.find((a) => a.id === agentId);
    if (agent) {
      const leader = agent.jefe;
      if (!teams.has(leader)) teams.set(leader, []);
      teams.get(leader)!.push(boxId);
    }
  });

  let totalSpread = 0, teamCount = 0;
  teams.forEach((boxIds) => {
    if (boxIds.length > 1) {
      const uniqueRows = new Set(boxIds.map((id) => boxes.find((b) => b.id === id)?.fila ?? 0));
      totalSpread += uniqueRows.size;
      teamCount++;
    }
  });

  return teamCount > 0 ? Math.round((totalSpread / teamCount) * 10) : 0;
}

export function findLeaderBoxes(
  agents: Agent[],
  existingAssignments: Map<string, string>,
  layoutBoxes: Box[],
  config: AppConfig
): Map<string, Box> {
  const leaderBoxes = new Map<string, Box>();
  const leaders = new Set<string>();
  agents.forEach((a) => {
    const leaderName = config.leaderField === 'jefe' ? a.jefe : a.superior;
    leaders.add(leaderName);
  });
  for (const leaderName of leaders) {
    const leaderAgent = agents.find((a) => leaderNamesMatch(a.nombre, leaderName));
    if (leaderAgent) {
      const boxId = existingAssignments.get(leaderAgent.id);
      if (boxId) {
        const box = layoutBoxes.find((b) => b.id === boxId);
        if (box) leaderBoxes.set(leaderName, box);
      }
    }
  }
  return leaderBoxes;
}
