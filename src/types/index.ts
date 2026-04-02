// ============================================
// CORE TYPES
// ============================================

export type ShiftType = 'morning' | 'midday' | 'afternoon' | 'full';

export type BoxType = 'box' | 'aisle' | 'label' | 'lid' | 'zone' | 'empty';

export type BoxStatus = 'occupied' | 'available' | 'available-from' | 'conflict' | 'locked';

export type RuleType =
  | 'fix-leader'
  | 'near-leader'
  | 'keep-segment-together'
  | 'zone-restriction'
  | 'team-separation'
  | 'manual-assignment';

export type RulePriority = 'high' | 'medium' | 'low';

export type AssignmentStatus = 'assigned' | 'unassigned' | 'conflict' | 'manual-locked';

// ============================================
// AGENT TYPES
// ============================================

export interface Agent {
  id: string;
  dni: string;
  usuario: string;
  nombre: string;
  superior: string;
  segmento: string;
  horarios: string;
  estado: string;
  contrato: string;
  sitio: string;
  modalidad: string;
  jefe: string;

  // Parsed fields
  dailyHours: number;
  entryTime: string; // HH:mm format
  exitTime: string; // HH:mm format
  shift: ShiftType;

  // Assignment
  boxId?: string;
  assignmentStatus: AssignmentStatus;
  isLocked: boolean;

  // Metadata
  parseErrors: string[];
}

export interface ParsedTimeRange {
  entryTime: string; // HH:mm
  exitTime: string; // HH:mm
  duration: number; // in hours
  shift: ShiftType;
}

// ============================================
// LEADER TYPES
// ============================================

export interface Leader {
  id: string;
  nombre: string;
  entryTime: string; // calculated: earliest team member entry
  exitTime: string;  // entryTime + 7h
  teamSize: number;
  boxId?: string;    // assigned LID cell id
}

// ============================================
// BOX TYPES
// ============================================

export interface BoxOccupation {
  agentId: string;
  agentName: string;
  entryTime: string;
  exitTime: string;
  leader: string;
  segment: string;
  color?: string;
  leaderField?: 'jefe' | 'superior';
  rawLeaderJefe?: string;
  rawLeaderSuperior?: string;
}

export interface Box {
  id: string;
  label: string;
  numero: number;
  zona: string;
  fila: number;
  columna: number;
  bloque?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: BoxType;
  activo: boolean;

  // Occupancy
  occupations: BoxOccupation[];
  currentOccupant?: BoxOccupation;
  nextOccupant?: BoxOccupation;
  status: BoxStatus;
  availableFrom?: string;

  // Constraints
  allowedSegments?: string[];
  allowedTeams?: string[];
  forbiddenSegments?: string[];
  forbiddenTeams?: string[];

  // Metadata
  metadata?: Record<string, unknown>;
}

// ============================================
// LAYOUT TYPES
// ============================================

export interface LayoutZone {
  id: string;
  name: string;
  label: string;
  color?: string;
  boxIds: string[];
}

export interface LayoutConfig {
  id: string;
  name: string;
  boxes: Box[];
  zones: LayoutZone[];
  rows: number;
  columns: number;
  cellWidth: number;
  cellHeight: number;
  aisleWidth: number;
}

// ============================================
// RULE TYPES
// ============================================

export interface BaseRule {
  id: string;
  type: RuleType;
  priority: RulePriority;
  enabled: boolean;
  description: string;
}

export interface FixLeaderRule extends BaseRule {
  type: 'fix-leader';
  leaderName: string;
  boxId: string;
}

export interface NearLeaderRule extends BaseRule {
  type: 'near-leader';
  leaderName: string;
  maxDistance: number; // boxes away
}

export interface KeepSegmentTogetherRule extends BaseRule {
  type: 'keep-segment-together';
  segment: string;
  zoneId?: string; // optional specific zone
}

export interface ZoneRestrictionRule extends BaseRule {
  type: 'zone-restriction';
  targetType: 'team' | 'segment' | 'leader';
  targetValue: string;
  allowedZoneIds: string[];
  forbiddenZoneIds?: string[];
}

export interface TeamSeparationRule extends BaseRule {
  type: 'team-separation';
  team1: string; // leader name or segment
  team2: string; // leader name or segment
  minDistance: number;
}

export interface ManualAssignmentRule extends BaseRule {
  type: 'manual-assignment';
  agentId: string;
  boxId: string;
}

export type Rule = FixLeaderRule | NearLeaderRule | KeepSegmentTogetherRule | ZoneRestrictionRule | TeamSeparationRule | ManualAssignmentRule;

// ============================================
// ASSIGNMENT RESULT TYPES
// ============================================

export interface AssignmentConflict {
  type: 'overlap' | 'no-space' | 'rule-violation' | 'constraint-failure';
  agentIds: string[];
  boxIds?: string[];
  ruleIds?: string[];
  message: string;
  severity: 'error' | 'warning';
}

export interface AssignmentResult {
  assignments: Map<string, string>; // agentId -> boxId
  conflicts: AssignmentConflict[];
  stats: AssignmentStats;
  satisfiedRules: string[];
  violatedRules: string[];
}

export interface AssignmentStats {
  totalAgents: number;
  assignedAgents: number;
  unassignedAgents: number;
  totalBoxes: number;
  usedBoxes: number;
  occupationRate: number;
  reusedBoxes: number;
  fragmentationScore: number; // 0-100, lower is better
}

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface AppConfig {
  // Leader selection
  leaderField: 'jefe' | 'superior';

  // Time calculation
  respectCsvExitTime: boolean;

  // CBS segment
  keepCbsTogether: boolean;
  cbsZoneId?: string;

  // Assignment preferences
  prioritizeTeamProximity: boolean;
  allowMixedTeamsInRow: boolean;

  // Display
  selectedShift: ShiftType | 'all';
  selectedHour?: number; // 0-23 for hour view

  // Leader box assignments: manual override - which leader occupies which LID position
  leaderBoxAssignments: Record<string, string>; // lidName -> leaderName
  excludedLeader?: string;
  snakeMode?: boolean; // "Sistema viborita": ignore zone/proximity, fill any available box
}

// ============================================
// SIMULATION TYPES
// ============================================

export interface SimulationState {
  id: string;
  name: string;
  timestamp: number;
  assignments: Map<string, string>;
  lockedAgents: Set<string>;
  config: AppConfig;
  rules: Rule[];
}

// ============================================
// EXPORT TYPES
// ============================================

export interface ExportRow {
  box: number;
  boxLabel: string;
  nombre: string;
  usuario: string;
  lider: string;
  segmento: string;
  horarioIngreso: string;
  horarioEgreso: string;
  contrato: string;
  duracionDiaria: number;
  turnoPrincipal: string;
  estado: string;
  reglasAplicadas: string[];
}

// ============================================
// CSV TYPES
// ============================================

export interface CsvRow {
  DNI: string;
  USUARIO: string;
  NOMBRE: string;
  SUPERIOR: string;
  SEGMENTO: string;
  HORARIOS: string;
  ESTADO: string;
  CONTRATO: string;
  SITIO: string;
  MODALIDAD: string;
  JEFE: string;
}

export interface CsvParseResult {
  agents: Agent[];
  leaders: Leader[];
  errors: Array<{
    row: number;
    field: string;
    value: unknown;
    message: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  stats: {
    totalRows: number;
    validAgents: number;
    errorCount: number;
    warningCount: number;
    leadersDetected: number;
    segmentsDetected: number;
  };
}

// ============================================
// UI STATE TYPES
// ============================================

export interface UiState {
  // View
  currentView: 'upload' | 'layout' | 'table' | 'rules' | 'config';
  selectedShift: ShiftType | 'all';
  selectedHour?: number;
  zoom: number;

  // Selection
  selectedBoxId?: string;
  selectedAgentId?: string;
  highlightedLeader?: string;
  highlightedSegment?: string;

  // Filters
  filterLeader?: string;
  filterSegment?: string;
  filterContract?: string;
  filterSearch?: string;

  // Panels
  showRulesPanel: boolean;
  showStatsPanel: boolean;
  showConfigPanel: boolean;
  showBoxDetail: boolean;

  // Editing
  isDragging: boolean;
  dragAgentId?: string;
  dragSourceBoxId?: string;

  // Simulation
  isSimulationMode: boolean;
  simulationHistory: SimulationState[];
}

// ============================================
// STORE STATE TYPE
// ============================================

export interface StoreState {
  // Data
  agents: Agent[];
  leaders: Leader[];
  layout: LayoutConfig;
  rules: Rule[];
  config: AppConfig;

  // Assignment
  assignments: Map<string, string>;        // agentId → boxId
  leaderAssignments: Map<string, string>;  // leaderId → boxId (LID cell)
  conflicts: AssignmentConflict[];
  stats: AssignmentStats;

  // UI
  ui: UiState;

  // Persistence
  lastSaved?: number;

  // Actions
  setAgents: (agents: Agent[], leaders: Leader[]) => void;
  updateLeader: (leaderId: string, updates: Partial<Pick<Leader, 'entryTime' | 'exitTime'>>) => void;
  toggleBoxActive: (boxId: string) => void;
  setLayout: (layout: LayoutConfig) => void;
  setRules: (rules: Rule[]) => void;
  setConfig: (config: Partial<AppConfig>) => void;

  // Assignment actions
  runAssignment: () => void;
  assignAgentToBox: (agentId: string, boxId: string) => void;
  unassignAgent: (agentId: string) => void;
  lockAgent: (agentId: string) => void;
  unlockAgent: (agentId: string) => void;

  // UI actions
  setUiState: (state: Partial<UiState>) => void;
  selectBox: (boxId?: string) => void;
  selectAgent: (agentId?: string) => void;
  setShift: (shift: ShiftType | 'all') => void;
  setHour: (hour?: number) => void;
  setZoom: (zoom: number) => void;

  // Rules actions
  addRule: (rule: Rule) => void;
  updateRule: (ruleId: string, updates: Partial<Rule>) => void;
  removeRule: (ruleId: string) => void;
  toggleRule: (ruleId: string) => void;

  // Persistence
  saveToStorage: () => void;
  loadFromStorage: () => boolean;
  exportData: () => ExportRow[];
  importConfig: (config: unknown) => void;

  // Simulation
  startSimulation: () => void;
  saveSimulation: (name: string) => void;
  loadSimulation: (simulationId: string) => void;
  discardSimulation: () => void;
}
