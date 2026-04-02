import type {
  Agent,
  AppConfig,
  Box,
  FixLeaderRule,
  KeepSegmentTogetherRule,
  ManualAssignmentRule,
  NearLeaderRule,
  Rule,
  TeamSeparationRule,
  ZoneRestrictionRule,
} from '../../types';
import { findLeaderReferenceBox, leaderNamesMatch, type LeaderBoxMap } from './leaderUtils';
import { timeRangesOverlap } from '../utils/timeParser';

export interface RuleEvaluation {
  ruleId: string;
  satisfied: boolean;
  score: number;
  reason?: string;
}

export interface ConstraintCheck {
  allowed: boolean;
  reason?: string;
  severity: 'error' | 'warning';
}

export function evaluateRules(
  agent: Agent,
  box: Box,
  rules: Rule[],
  config: AppConfig,
  currentAssignments: Map<string, string>,
  allAgents: Agent[],
  leaderBoxMap: LeaderBoxMap,
  allBoxes: Box[]
): RuleEvaluation[] {
  return rules
    .filter((r) => r.enabled)
    .map((rule) =>
      evaluateSingleRule(agent, box, rule, config, currentAssignments, allAgents, leaderBoxMap, allBoxes)
    );
}

function evaluateSingleRule(
  agent: Agent,
  box: Box,
  rule: Rule,
  config: AppConfig,
  currentAssignments: Map<string, string>,
  allAgents: Agent[],
  leaderBoxMap: LeaderBoxMap,
  allBoxes: Box[]
): RuleEvaluation {
  const leaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;

  switch (rule.type) {
    case 'fix-leader':
      return evaluateFixLeaderRule(agent, box, rule, leaderName);

    case 'near-leader':
      return evaluateNearLeaderRule(agent, box, rule, config, leaderBoxMap, allBoxes);

    case 'keep-segment-together':
      return evaluateKeepSegmentRule(agent, box, rule);

    case 'zone-restriction':
      return evaluateZoneRestrictionRule(agent, box, rule, leaderName);

    case 'team-separation':
      return evaluateTeamSeparationRule(
        agent, box, rule, leaderName, currentAssignments, allAgents, config, allBoxes
      );

    case 'manual-assignment':
      return evaluateManualAssignmentRule(agent, box, rule);
  }

  return { ruleId: 'unknown', satisfied: true, score: 0 };
}

function evaluateFixLeaderRule(
  agent: Agent,
  box: Box,
  rule: FixLeaderRule,
  leaderName: string
): RuleEvaluation {
  const isLeader =
    leaderNamesMatch(agent.nombre, rule.leaderName) ||
    leaderNamesMatch(leaderName, rule.leaderName);

  if (!isLeader) return { ruleId: rule.id, satisfied: true, score: 0 };

  const satisfied = box.id === rule.boxId;
  return {
    ruleId: rule.id,
    satisfied,
    score: satisfied ? 100 : -100,
    reason: satisfied ? undefined : `Líder debe estar en ${rule.boxId}`,
  };
}

function evaluateNearLeaderRule(
  agent: Agent,
  box: Box,
  rule: NearLeaderRule,
  config: AppConfig,
  leaderBoxMap: LeaderBoxMap,
  allBoxes: Box[]
): RuleEvaluation {
  void agent;
  void config;
  const leaderBox = findLeaderReferenceBox(rule.leaderName, allBoxes, leaderBoxMap);
  if (!leaderBox) return { ruleId: rule.id, satisfied: true, score: 0 };

  const distance = calculateBoxDistance(box, leaderBox);
  const satisfied = distance <= rule.maxDistance;

  return {
    ruleId: rule.id,
    satisfied,
    score: satisfied ? 50 - distance : -distance,
    reason: satisfied ? undefined : `Distancia al líder: ${distance}`,
  };
}

function evaluateKeepSegmentRule(
  agent: Agent,
  box: Box,
  rule: KeepSegmentTogetherRule
): RuleEvaluation {
  if (agent.segmento !== rule.segment) return { ruleId: rule.id, satisfied: true, score: 0 };

  if (rule.zoneId) {
    const satisfied = box.zona === rule.zoneId;
    return {
      ruleId: rule.id,
      satisfied,
      score: satisfied ? 80 : -50,
      reason: satisfied ? undefined : `Segmento debe estar en zona ${rule.zoneId}`,
    };
  }

  return { ruleId: rule.id, satisfied: true, score: 30 };
}

function evaluateZoneRestrictionRule(
  agent: Agent,
  box: Box,
  rule: ZoneRestrictionRule,
  leaderName: string
): RuleEvaluation {
  let targetValue: string;

  switch (rule.targetType) {
    case 'team':
    case 'leader':
      targetValue = leaderName;
      break;
    case 'segment':
      targetValue = agent.segmento;
      break;
    default:
      return { ruleId: rule.id, satisfied: true, score: 0 };
  }

  if (targetValue !== rule.targetValue) return { ruleId: rule.id, satisfied: true, score: 0 };

  const forbidden = rule.forbiddenZoneIds?.includes(box.zona);
  if (forbidden) {
    return { ruleId: rule.id, satisfied: false, score: -100, reason: `Zona ${box.zona} prohibida` };
  }

  const allowed = rule.allowedZoneIds.includes(box.zona);
  if (!allowed) {
    return {
      ruleId: rule.id, satisfied: false, score: -100,
      reason: `Solo permitido en: ${rule.allowedZoneIds.join(', ')}`,
    };
  }

  return { ruleId: rule.id, satisfied: true, score: 60 };
}

function evaluateTeamSeparationRule(
  agent: Agent,
  box: Box,
  rule: TeamSeparationRule,
  leaderName: string,
  currentAssignments: Map<string, string>,
  allAgents: Agent[],
  config: AppConfig,
  allBoxes: Box[]
): RuleEvaluation {
  const belongsToTeam1 = leaderName === rule.team1 || agent.segmento === rule.team1;
  const belongsToTeam2 = leaderName === rule.team2 || agent.segmento === rule.team2;

  if (!belongsToTeam1 && !belongsToTeam2) return { ruleId: rule.id, satisfied: true, score: 0 };

  const otherTeam = belongsToTeam1 ? rule.team2 : rule.team1;

  const otherTeamBoxes: Box[] = [];
  allAgents.forEach((other) => {
    if (other.id === agent.id) return;
    const otherLeader = config.leaderField === 'jefe' ? other.jefe : other.superior;
    if (otherLeader !== otherTeam && other.segmento !== otherTeam) return;
    const assignedBoxId = currentAssignments.get(other.id);
    if (!assignedBoxId) return;
    const assignedBox = allBoxes.find((b) => b.id === assignedBoxId);
    if (assignedBox) otherTeamBoxes.push(assignedBox);
  });

  if (otherTeamBoxes.length === 0) return { ruleId: rule.id, satisfied: true, score: 10 };

  const minDist = Math.min(...otherTeamBoxes.map((b) => calculateBoxDistance(box, b)));
  const satisfied = minDist >= rule.minDistance;

  return {
    ruleId: rule.id,
    satisfied,
    score: satisfied ? 20 + (minDist - rule.minDistance) * 2 : -(rule.minDistance - minDist) * 10,
    reason: satisfied
      ? undefined
      : `Distancia mínima requerida: ${rule.minDistance}, actual: ${minDist}`,
  };
}

function evaluateManualAssignmentRule(
  agent: Agent,
  box: Box,
  rule: ManualAssignmentRule
): RuleEvaluation {
  if (rule.agentId !== agent.id) return { ruleId: rule.id, satisfied: true, score: 0 };
  const satisfied = box.id === rule.boxId;
  return {
    ruleId: rule.id,
    satisfied,
    score: satisfied ? 100 : -100,
    reason: satisfied ? undefined : `Asignación manual a ${rule.boxId}`,
  };
}

export function checkConstraints(
  agent: Agent,
  box: Box,
  currentOccupants: Agent[],
  rules: Rule[]
): ConstraintCheck {
  for (const occupant of currentOccupants) {
    if (timeRangesOverlap(agent.entryTime, agent.exitTime, occupant.entryTime, occupant.exitTime)) {
      return { allowed: false, reason: `Solapamiento horario con ${occupant.nombre}`, severity: 'error' };
    }
  }

  for (const rule of rules) {
    if (rule.type === 'zone-restriction' && rule.enabled) {
      if (rule.targetType === 'segment' && rule.targetValue === agent.segmento) {
        if (rule.forbiddenZoneIds?.includes(box.zona)) {
          return { allowed: false, reason: `Zona prohibida por restricción`, severity: 'error' };
        }
      }
    }
  }

  return { allowed: true, severity: 'error' };
}

export function calculateBoxDistance(box1: Box, box2: Box): number {
  return Math.abs(box1.fila - box2.fila) + Math.abs(box1.columna - box2.columna);
}

// Rows occupied by horizontal aisles in the default floor plan
const AISLE_ROWS = new Set([2, 4, 7, 10]);

/**
 * Returns true if there is at least one aisle row between row1 and row2.
 * If true, the two boxes are in different "blocks" separated by a pasillo.
 */
function hasPasilloBetwwenRows(row1: number, row2: number): boolean {
  const lo = Math.min(row1, row2);
  const hi = Math.max(row1, row2);
  for (let r = lo + 1; r < hi; r++) {
    if (AISLE_ROWS.has(r)) return true;
  }
  return false;
}

function countPasillosBetween(row1: number, row2: number): number {
  const lo = Math.min(row1, row2);
  const hi = Math.max(row1, row2);
  let count = 0;
  for (let r = lo + 1; r < hi; r++) {
    if (AISLE_ROWS.has(r)) count++;
  }
  return count;
}

export function findAgentsInZone(
  zoneName: string,
  assignments: Map<string, string>,
  boxes: Box[],
  agents: Agent[]
): Agent[] {
  const zoneBoxIds = new Set(
    boxes.filter((b) => b.zona === zoneName && b.type === 'box').map((b) => b.id)
  );
  const result: Agent[] = [];
  assignments.forEach((boxId, agentId) => {
    if (zoneBoxIds.has(boxId)) {
      const agent = agents.find((a) => a.id === agentId);
      if (agent) result.push(agent);
    }
  });
  return result;
}

export function calculateAssignmentScore(
  agent: Agent,
  box: Box,
  rules: Rule[],
  config: AppConfig,
  currentAssignments: Map<string, string>,
  allAgents: Agent[],
  leaderBoxMap: LeaderBoxMap,
  leaderBox?: Box,
  allBoxes: Box[] = []
): number {
  // In snake mode, skip all proximity scoring — just base score
  if (config.snakeMode) {
    const evaluations = evaluateRules(
      agent, box, rules, config, currentAssignments, allAgents, leaderBoxMap, allBoxes
    );
    let score = 10;
    for (const ev of evaluations) score += ev.score;
    return score;
  }

  let score = 10;
  const teamLeaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;

  if (config.prioritizeTeamProximity && leaderBox) {
    const rowDiff   = Math.abs(box.fila - leaderBox.fila);
    const colDiff   = Math.abs(box.columna - leaderBox.columna);
    const sameBlock = !hasPasilloBetwwenRows(box.fila, leaderBox.fila);

    // ── Column proximity (same-column = "directly behind") ──────────
    // This is the primary axis: being in the same column or close
    // lets an agent sit "behind" a teammate across the aisle.
    if (colDiff === 0) score += 40;
    else if (colDiff <= 2) score += 28;
    else if (colDiff <= 4) score += 18;
    else if (colDiff <= 7) score += 8;
    else score -= colDiff * 2;

    if (sameBlock) {
      // Same block (no pasillo between) — extra bonus
      score += 30;
      // Same row or adjacent row within block
      if (rowDiff === 0) score += 15;
      else if (rowDiff === 1) score += 12;
    } else {
      // Cross-pasillo: soft penalty, only 1 block away is still viable
      // if column is close (the "directly behind" case the user described)
      const pasilloCount = countPasillosBetween(box.fila, leaderBox.fila);
      score -= pasilloCount * 15;  // each pasillo crossed costs 15, not 50
    }
  }

  if (config.prioritizeTeamProximity) {
    const teammateBoxes = allAgents
      .filter((other) =>
        other.id !== agent.id &&
        (config.leaderField === 'jefe' ? other.jefe : other.superior) === teamLeaderName
      )
      .map((other) => currentAssignments.get(other.id))
      .filter((id): id is string => Boolean(id))
      .map((id) => allBoxes.find((b) => b.id === id))
      .filter((b): b is Box => Boolean(b));

    if (teammateBoxes.length > 0) {
      // Avoid overcrowding a single row — gentle penalty encourages using adjacent rows
      const sameRow = teammateBoxes.filter((b) => b.fila === box.fila).length;
      if (sameRow > 4) score -= (sameRow - 4) * 8;

      // Column proximity to nearest teammate (same column = "directly behind")
      const nearestColDiff = Math.min(...teammateBoxes.map((b) => Math.abs(box.columna - b.columna)));
      if (nearestColDiff === 0) score += 20;
      else if (nearestColDiff <= 2) score += 12;
      else if (nearestColDiff <= 4) score += 6;
    }
  }

  const evaluations = evaluateRules(
    agent, box, rules, config, currentAssignments, allAgents, leaderBoxMap, allBoxes
  );
  for (const ev of evaluations) score += ev.score;

  return score;
}
