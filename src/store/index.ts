import { create } from 'zustand';
import type {
  StoreState,
  Leader,
  Rule,
  AppConfig,
  AssignmentStatus,
  BoxOccupation,
  BoxStatus,
  UiState,
  ExportRow,
} from '../types';
import { defaultLayout } from '../data/defaultLayout';
import { assignBoxes, assignLeaders } from '../lib/assignment/assignmentEngine';
import { buildLeaderBoxMap } from '../lib/assignment/leaderUtils';
import { timeToMinutes, timeRangesOverlap } from '../lib/utils/timeParser';

const initialConfig: AppConfig = {
  leaderField: 'superior',
  respectCsvExitTime: false,
  keepCbsTogether: true,
  prioritizeTeamProximity: true,
  allowMixedTeamsInRow: false,
  selectedShift: 'all',
  leaderBoxAssignments: {} as Record<string, string>,
  excludedLeader: '',
  snakeMode: false,
};

const initialUi: UiState = {
  currentView: 'upload',
  selectedShift: 'morning',
  zoom: 1,
  showRulesPanel: false,
  showStatsPanel: true,
  showConfigPanel: false,
  showBoxDetail: false,
  isDragging: false,
  isSimulationMode: false,
  simulationHistory: [],
};

export const useStore = create<StoreState>()(
  (set, get) => ({
    // Data
    agents: [],
    leaders: [],
    layout: defaultLayout,
    rules: [],
    config: initialConfig,

    // Assignment
    assignments: new Map(),
    leaderAssignments: new Map(),
    conflicts: [],
    stats: {
      totalAgents: 0,
      assignedAgents: 0,
      unassignedAgents: 0,
      totalBoxes: 0,
      usedBoxes: 0,
      occupationRate: 0,
      reusedBoxes: 0,
      fragmentationScore: 0,
    },

    // UI
    ui: initialUi,

    // Actions
    setAgents: (agents, leaders) => {
      set({ agents, leaders });
      get().runAssignment();
    },

    updateLeader: (leaderId, updates) => {
      set((state) => ({
        leaders: state.leaders.map((l) => l.id === leaderId ? { ...l, ...updates } : l),
      }));
      get().runAssignment();
    },

    toggleBoxActive: (boxId) => {
      set((state) => ({
        layout: {
          ...state.layout,
          boxes: state.layout.boxes.map((b) =>
            b.id === boxId ? { ...b, activo: !b.activo } : b
          ),
        },
      }));
      get().runAssignment();
    },

    setLayout: (layout) => set({ layout }),

    setRules: (rules) => {
      set({ rules });
      get().runAssignment();
    },

    setConfig: (configUpdates) => {
      set((state) => ({ config: { ...state.config, ...configUpdates } }));
      get().runAssignment();
    },

    runAssignment: () => {
      const state = get();
      if (state.agents.length === 0) return;

      const excludedLeader = state.config.excludedLeader?.trim();
      const activeAgents = excludedLeader
        ? state.agents.filter((agent) => {
            const leaderName = state.config.leaderField === 'jefe' ? agent.jefe : agent.superior;
            return leaderName !== excludedLeader;
          })
        : state.agents;

      const activeLeaders = excludedLeader
        ? state.leaders.filter((l) => l.nombre.toLowerCase().trim() !== excludedLeader.toLowerCase().trim())
        : state.leaders;

      // ── 1. Assign leaders to LID cells ───────────────────────────
      // Reset LID occupations before each run so manual overrides aren't
      // blocked by leftover occupations from the previous assignment.
      const boxesForLeaders = state.layout.boxes.map((b) =>
        b.type === 'lid' ? { ...b, occupations: [] as typeof b.occupations } : b
      );
      const newLeaderAssignments = assignLeaders(
        activeLeaders,
        boxesForLeaders,
        state.config
      );

      // Update leaders with their assigned boxId
      const updatedLeaders: Leader[] = state.leaders.map((l) => ({
        ...l,
        boxId: newLeaderAssignments.get(l.id),
      }));

      // Build leaderName → boxId map for proximity scoring
      const leaderBoxMap = buildLeaderBoxMap(updatedLeaders);

      // ── 2. Assign agents to regular boxes ─────────────────────────
      const result = assignBoxes(
        activeAgents,
        state.layout,
        state.rules,
        state.config,
        state.assignments,
        leaderBoxMap
      );

      // ── 3. Update agent statuses ──────────────────────────────────
      const conflictAgentIds = new Set<string>();
      result.conflicts.forEach((c) => {
        if (c.type === 'no-space') c.agentIds.forEach((id) => conflictAgentIds.add(id));
      });

      const updatedAgents = state.agents.map((agent) => {
        const leaderName = state.config.leaderField === 'jefe' ? agent.jefe : agent.superior;
        const isExcluded = !!excludedLeader && leaderName === excludedLeader;
        const boxId = result.assignments.get(agent.id);
        let assignmentStatus: AssignmentStatus;
        if (isExcluded) assignmentStatus = 'unassigned';
        else if (agent.isLocked && boxId) assignmentStatus = 'manual-locked';
        else if (conflictAgentIds.has(agent.id)) assignmentStatus = 'conflict';
        else if (boxId) assignmentStatus = 'assigned';
        else assignmentStatus = 'unassigned';
        return { ...agent, boxId: isExcluded ? undefined : boxId, assignmentStatus };
      });

      // ── 4. Rebuild box occupations ────────────────────────────────
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const updatedBoxes = state.layout.boxes.map((box) => ({
        ...box,
        occupations: [] as BoxOccupation[],
        currentOccupant: undefined,
        nextOccupant: undefined,
        availableFrom: undefined,
        status: 'available' as BoxStatus,
      }));

      // Agent occupations on regular boxes
      result.assignments.forEach((boxId, agentId) => {
        const agent = updatedAgents.find((a) => a.id === agentId);
        const box = updatedBoxes.find((b) => b.id === boxId);
        if (agent && box) {
          box.occupations.push({
            agentId: agent.id,
            agentName: agent.nombre,
            entryTime: agent.entryTime,
            exitTime: agent.exitTime,
            leader: state.config.leaderField === 'jefe' ? agent.jefe : agent.superior,
            segment: agent.segmento,
          });
        }
      });

      // Leader occupations on LID cells
      newLeaderAssignments.forEach((boxId, leaderId) => {
        const leader = updatedLeaders.find((l) => l.id === leaderId);
        const box = updatedBoxes.find((b) => b.id === boxId);
        if (leader && box) {
          box.occupations.push({
            agentId: leader.id,
            agentName: leader.nombre,
            entryTime: leader.entryTime,
            exitTime: leader.exitTime,
            leader: '',
            segment: '',
          });
        }
      });

      // Sort occupations + compute box status
      updatedBoxes.forEach((box) => {
        if (box.occupations.length === 0) return;
        box.occupations.sort(
          (a, b) => timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime)
        );
        const currentOcc = box.occupations.find((occ) => {
          const start = timeToMinutes(occ.entryTime);
          const end = timeToMinutes(occ.exitTime);
          return currentMinutes >= start && currentMinutes < end;
        });
        if (currentOcc) {
          box.currentOccupant = currentOcc;
          box.status = 'occupied';
        } else {
          const nextOcc = box.occupations.find(
            (occ) => timeToMinutes(occ.entryTime) > currentMinutes
          );
          if (nextOcc) {
            box.nextOccupant = nextOcc;
            box.status = 'available-from';
            box.availableFrom = nextOcc.entryTime;
          }
        }
      });

      set({
        assignments: result.assignments,
        leaderAssignments: newLeaderAssignments,
        leaders: updatedLeaders,
        conflicts: result.conflicts,
        stats: result.stats,
        agents: updatedAgents,
        layout: { ...state.layout, boxes: updatedBoxes },
      });

      get().saveToStorage();
    },

    assignAgentToBox: (agentId, boxId) => {
      const state = get();
      const agent = state.agents.find((a) => a.id === agentId);
      const box = state.layout.boxes.find((b) => b.id === boxId);
      if (agent && box) {
        const hasOverlap = box.occupations.some((occ) =>
          timeRangesOverlap(agent.entryTime, agent.exitTime, occ.entryTime, occ.exitTime)
        );
        if (hasOverlap) return;
      }
      set((s) => {
        const newAssignments = new Map(s.assignments);
        newAssignments.set(agentId, boxId);
        return {
          assignments: newAssignments,
          agents: s.agents.map((a) =>
            a.id === agentId
              ? { ...a, boxId, assignmentStatus: a.isLocked ? 'manual-locked' : 'assigned' }
              : a
          ),
        };
      });
    },

    unassignAgent: (agentId) => {
      set((state) => {
        const newAssignments = new Map(state.assignments);
        newAssignments.delete(agentId);
        return {
          assignments: newAssignments,
          agents: state.agents.map((a) =>
            a.id === agentId ? { ...a, boxId: undefined, assignmentStatus: 'unassigned' } : a
          ),
        };
      });
    },

    lockAgent: (agentId) => {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId ? { ...a, isLocked: true, assignmentStatus: 'manual-locked' } : a
        ),
      }));
    },

    unlockAgent: (agentId) => {
      set((state) => ({
        agents: state.agents.map((a) =>
          a.id === agentId
            ? { ...a, isLocked: false, assignmentStatus: a.boxId ? 'assigned' : 'unassigned' }
            : a
        ),
      }));
    },

    setUiState: (uiUpdates) => {
      set((state) => ({ ui: { ...state.ui, ...uiUpdates } }));
    },

    selectBox: (boxId) => {
      set((state) => ({ ui: { ...state.ui, selectedBoxId: boxId } }));
    },

    selectAgent: (agentId) => {
      set((state) => ({ ui: { ...state.ui, selectedAgentId: agentId } }));
    },

    setShift: (shift) => {
      set((state) => ({
        ui: { ...state.ui, selectedShift: shift },
        config: { ...state.config, selectedShift: shift },
      }));
    },

    setHour: (hour) => {
      set((state) => ({ ui: { ...state.ui, selectedHour: hour } }));
    },

    setZoom: (zoom) => {
      set((state) => ({ ui: { ...state.ui, zoom: Math.max(0.5, Math.min(2, zoom)) } }));
    },

    addRule: (rule) => {
      set((state) => ({ rules: [...state.rules, rule] }));
      get().runAssignment();
    },

    updateRule: (ruleId, updates) => {
      set((state) => ({
        rules: state.rules.map((r) => (r.id === ruleId ? ({ ...r, ...updates } as Rule) : r)),
      }));
      get().runAssignment();
    },

    removeRule: (ruleId) => {
      set((state) => ({ rules: state.rules.filter((r) => r.id !== ruleId) }));
      get().runAssignment();
    },

    toggleRule: (ruleId) => {
      set((state) => ({
        rules: state.rules.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r)),
      }));
      get().runAssignment();
    },

    saveToStorage: () => {
      try {
        const { agents, leaders, rules, config } = get();
        localStorage.setItem(
          'box-assignment-data',
          JSON.stringify({ agents, leaders, rules, config, savedAt: Date.now() })
        );
        set({ lastSaved: Date.now() });
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
    },

    loadFromStorage: () => {
      try {
        const raw = localStorage.getItem('box-assignment-data');
        if (!raw) return false;
        const { agents, leaders, rules, config } = JSON.parse(raw);
        if (agents?.length) {
          set({
            agents,
            leaders: leaders || [],
            rules: rules || [],
            config: { ...initialConfig, ...(config || {}) },
            ui: { ...initialUi, currentView: 'layout' },
          });
          get().runAssignment();
          return true;
        }
        return false;
      } catch (e) {
        console.error('Error loading from localStorage:', e);
        return false;
      }
    },

    exportData: (): ExportRow[] => {
      const state = get();
      const rows: ExportRow[] = [];
      const excludedLeader = state.config.excludedLeader?.trim();

      for (const agent of state.agents) {
        const leaderName = state.config.leaderField === 'jefe' ? agent.jefe : agent.superior;
        if (excludedLeader && leaderName === excludedLeader) continue;
        const boxId = state.assignments.get(agent.id);
        const box = boxId ? state.layout.boxes.find((b) => b.id === boxId) : undefined;

        const appliedRules = state.rules.filter((r) => {
          if (r.type === 'manual-assignment') return r.agentId === agent.id;
          if (r.type === 'fix-leader') return r.leaderName === leaderName;
          return false;
        });

        rows.push({
          box: box?.numero || 0,
          boxLabel: box?.label || 'Sin asignar',
          nombre: agent.nombre,
          usuario: agent.usuario,
          lider: leaderName,
          segmento: agent.segmento,
          horarioIngreso: agent.entryTime,
          horarioEgreso: agent.exitTime,
          contrato: agent.contrato,
          duracionDiaria: agent.dailyHours,
          turnoPrincipal: agent.shift,
          estado: agent.assignmentStatus,
          reglasAplicadas: appliedRules.map((r) => r.description),
        });
      }

      return rows.sort((a, b) => a.box - b.box);
    },

    importConfig: (config) => {
      if (!config || typeof config !== 'object') return;
      const imported = config as {
        layout?: StoreState['layout'];
        rules?: StoreState['rules'];
        config?: Partial<AppConfig>;
      };
      if (imported.layout) set({ layout: imported.layout });
      if (imported.rules) set({ rules: imported.rules });
      if (imported.config) set({ config: { ...get().config, ...imported.config } });
      get().runAssignment();
    },

    startSimulation: () => {},
    saveSimulation: (name) => { void name; },
    loadSimulation: (simulationId) => { void simulationId; },
    discardSimulation: () => {},
  })
);

// Selectors
export const selectAgentsByLeader = (leaderName: string) => (state: StoreState) => {
  const field = state.config.leaderField;
  return state.agents.filter((a) => (field === 'jefe' ? a.jefe : a.superior) === leaderName);
};

export const selectAgentsBySegment = (segment: string) => (state: StoreState) =>
  state.agents.filter((a) => a.segmento === segment);

export const selectBoxById = (boxId: string) => (state: StoreState) =>
  state.layout.boxes.find((b) => b.id === boxId);

export const selectAgentById = (agentId: string) => (state: StoreState) =>
  state.agents.find((a) => a.id === agentId);

export const selectLeaders = (state: StoreState) => {
  const field = state.config.leaderField;
  const leaders = new Set<string>();
  state.agents.forEach((a) => leaders.add(field === 'jefe' ? a.jefe : a.superior));
  return Array.from(leaders).sort();
};

export const selectSegments = (state: StoreState) => {
  const segments = new Set<string>();
  state.agents.forEach((a) => segments.add(a.segmento));
  return Array.from(segments).sort();
};

export const selectBoxesByZone = (zoneName: string) => (state: StoreState) =>
  state.layout.boxes.filter((b) => b.zona === zoneName && b.type === 'box');

export const selectOccupiedBoxes = (state: StoreState) =>
  state.layout.boxes.filter((b) => b.occupations && b.occupations.length > 0);

export const selectFilteredAgents = (state: StoreState) => {
  let agents = [...state.agents];

  if (state.ui.selectedShift !== 'all') {
    agents = agents.filter((a) => a.shift === state.ui.selectedShift);
  }
  if (state.ui.filterLeader) {
    agents = agents.filter((a) => {
      const field = state.config.leaderField;
      return (field === 'jefe' ? a.jefe : a.superior) === state.ui.filterLeader;
    });
  }
  if (state.ui.filterSegment) {
    agents = agents.filter((a) => a.segmento === state.ui.filterSegment);
  }
  if (state.ui.filterContract) {
    agents = agents.filter((a) => a.contrato.includes(state.ui.filterContract!));
  }
  if (state.ui.filterSearch) {
    const search = state.ui.filterSearch.toLowerCase();
    agents = agents.filter(
      (a) =>
        a.nombre.toLowerCase().includes(search) || a.usuario.toLowerCase().includes(search)
    );
  }

  return agents;
};
