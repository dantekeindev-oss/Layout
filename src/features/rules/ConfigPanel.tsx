import { useMemo } from 'react';
import { Settings, User as UserIcon, CheckCircle, Shield, Users, Layers, X, RotateCcw, Trash2, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { Card, CardBody, CardHeader, Select, Button } from '../../components/ui';
import type { AppConfig } from '../../types';
import { timeToMinutes } from '../../lib/utils/timeParser';

const SHIFT_WINDOWS = [
  { key: 'morning',   label: 'Mañana',   start: 360, end: 660  },  // 06:00–11:00
  { key: 'midday',    label: 'Mediodía', start: 720, end: 780  },  // 12:00–13:00
  { key: 'afternoon', label: 'Tarde',    start: 840, end: 1440 },  // 14:00–00:00
];

function timeRangesOverlapMinutes(s1: number, e1: number, s2: number, e2: number) {
  return s1 < e2 && e1 > s2;
}

// Available LID positions based on the floor plan
const LID_POSITIONS = [
  { id: 'LID 1', label: 'LID 1 (inferior izquierda)' },
  { id: 'LID 2', label: 'LID 2 (inferior media)' },
  { id: 'LID 3', label: 'LID 3 (media izquierda)' },
  { id: 'LID 4', label: 'LID 4 (superior izquierda)' },
  { id: 'LID 5', label: 'LID 5 (media central)' },
  { id: 'LID 6', label: 'LID 6 (superior derecha)' },
  { id: 'LID 7', label: 'LID 7 (superior derecha)' },
];

export function ConfigPanel() {
  const { config, setConfig, agents, leaders, updateLeader, setUiState, runAssignment } = useStore();
  const excludedLeader = config.excludedLeader ?? '';

  const handleConfigChange = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setConfig({ [key]: value } as Pick<AppConfig, K>);
  };

  // Get unique leader names from agents (based on selected leader field)
  const leaderNames = useMemo(() => {
    const field = config.leaderField;
    const leaderSet = new Set<string>();
    agents.forEach((a) => {
      const leader = field === 'jefe' ? a.jefe : a.superior;
      if (leader) leaderSet.add(leader);
    });
    return Array.from(leaderSet).sort();
  }, [agents, config.leaderField]);

  // Calculate how many agents would be excluded when a leader is selected
  const excludedTeamSize = useMemo(() => {
    if (!excludedLeader) return 0;
    const field = config.leaderField;
    return agents.filter((a) => {
      const leader = field === 'jefe' ? a.jefe : a.superior;
      return leader === excludedLeader;
    }).length;
  }, [excludedLeader, agents, config.leaderField]);

  const { layout } = useStore();

  // Per-shift capacity analysis
  const shiftCapacity = useMemo(() => {
    const activeBoxes = layout.boxes.filter((b) => b.type === 'box' && b.activo);
    const activeAgents = excludedLeader
      ? agents.filter((a) => {
          const l = config.leaderField === 'jefe' ? a.jefe : a.superior;
          return l !== excludedLeader;
        })
      : agents;

    return SHIFT_WINDOWS.map(({ key, label, start, end }) => {
      // Agents whose schedule overlaps this shift window
      const shiftAgents = activeAgents.filter((a) => {
        const s = timeToMinutes(a.entryTime);
        let e = timeToMinutes(a.exitTime);
        if (e === 0 || e < s) e = 1440;
        return timeRangesOverlapMinutes(s, e, start, end);
      });

      // For each box, simulate how many non-overlapping agents from shiftAgents can fit
      // (greedy: sort by entry, assign if no overlap with already-assigned in this box)
      // This gives the true capacity accounting for hot-desking within the shift.
      let totalSlots = 0;
      for (const box of activeBoxes) {
        const occupants: { s: number; e: number }[] = [];
        // Sort shiftAgents by entry time and greedily pack this box
        const sorted = [...shiftAgents].sort((a, b) => timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime));
        for (const agent of sorted) {
          const s = timeToMinutes(agent.entryTime);
          let e = timeToMinutes(agent.exitTime);
          if (e === 0 || e < s) e = 1440;
          if (!occupants.some((o) => timeRangesOverlapMinutes(s, e, o.s, o.e))) {
            occupants.push({ s, e });
          }
        }
        totalSlots += occupants.length;
      }

      const agentCount = shiftAgents.length;
      const shortage = Math.max(0, agentCount - totalSlots);
      return { key, label, agentCount, totalSlots, shortage };
    });
  }, [agents, layout.boxes, config.leaderField, excludedLeader]);

  const handleRecalculate = () => {
    runAssignment();
    setUiState({ currentView: 'layout' });
  };

  const handleExcludeLeader = (leaderName: string) => {
    setConfig({ excludedLeader: leaderName === excludedLeader ? '' : leaderName });
  };

  return (
    <div className="space-y-4">
      {/* Quick Actions Banner */}
      <Card className="border-indigo-500/30 bg-indigo-900/20">
        <CardBody className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                <Settings className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Reasignar Lugares</h3>
                <p className="text-xs text-indigo-300">
                  Recalcula todas las asignaciones con la configuración actual
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white tabular-nums">{agents.length}</div>
              <div className="text-xs text-indigo-300">agentes</div>
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full mt-3"
            onClick={handleRecalculate}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reasignar Todos los Lugares
          </Button>
        </CardBody>
      </Card>

      {/* Shift Capacity Analysis */}
      {agents.length > 0 && (
        <Card className={shiftCapacity.some((s) => s.shortage > 0) ? 'border-amber-600/40 bg-amber-900/10' : 'border-slate-700'}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`w-4 h-4 ${shiftCapacity.some((s) => s.shortage > 0) ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="font-medium text-slate-200">Capacidad por Turno</span>
            </div>
          </CardHeader>
          <CardBody className="space-y-2">
            {shiftCapacity.map(({ key, label, agentCount, totalSlots, shortage }) => {
              const pct = totalSlots > 0 ? Math.min(100, Math.round((agentCount / totalSlots) * 100)) : 0;
              const ok = shortage === 0;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-300">{label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{agentCount} agentes / {totalSlots} lugares</span>
                      {ok ? (
                        <span className="text-xs font-semibold text-emerald-400">OK</span>
                      ) : (
                        <span className="text-xs font-semibold text-amber-400">Faltan {shortage}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
      )}

      {/* Exclude Leader Section */}
      <Card className={excludedLeader ? 'border-red-500/30 bg-red-900/20' : 'border-slate-700'}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {excludedLeader ? (
                <EyeOff className="w-4 h-4 text-red-400" />
              ) : (
                <Eye className="w-4 h-4 text-slate-400" />
              )}
              <span className={`font-medium ${excludedLeader ? 'text-red-200' : 'text-slate-200'}`}>
                {excludedLeader ? 'Excluyendo del Cálculo' : 'Excluir Equipo del Cálculo'}
              </span>
            </div>
            {excludedLeader && (
              <button
                onClick={() => setConfig({ excludedLeader: '' })}
                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/50 rounded-lg transition-colors"
                title="Limpiar exclusión"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-slate-400">
              Selecciona un líder para excluirlo junto con todo su equipo de la asignación
            </p>
            {excludedTeamSize > 0 && (
              <div className="text-right">
                <span className="text-xs text-slate-500">Agentes fuera del cálculo:</span>
                <span className="text-2xl font-bold text-red-400 tabular-nums ml-2">
                  {excludedTeamSize}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <button
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                !excludedLeader
                  ? 'text-slate-300 hover:bg-slate-700'
                  : excludedLeader
                    ? 'bg-red-600 text-white'
                    : 'text-slate-300'
              }`}
              onClick={() => handleExcludeLeader('')}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-slate-600" />
                <span>Incluir todos los equipos</span>
              </div>
              {!excludedLeader && (
                <Trash2 className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {leaderNames.map((leader) => (
              <button
                key={leader}
                onClick={() => handleExcludeLeader(leader)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${
                  excludedLeader === leader
                    ? 'bg-red-600 text-white'
                    : excludedLeader
                      ? 'opacity-40 cursor-not-allowed text-slate-500'
                      : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                <span className="truncate">{leader}</span>
                {excludedLeader === leader && (
                  <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded-full">
                    Excluido
                  </span>
                )}
                {excludedLeader && excludedLeader !== leader && (
                  <span className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded-full">
                    {agents.filter((a) => {
                      const field = config.leaderField;
                      const l = field === 'jefe' ? a.jefe : a.superior;
                      return l === leader;
                    }).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {excludedLeader && (
            <div className="mt-3 p-3 rounded-lg bg-red-900/30 border border-red-700/50">
              <p className="text-xs text-red-300">
                <strong>Nota:</strong> El equipo de "{excludedLeader}" queda fuera del cálculo y sus lugares se liberan para reasignar al resto.
              </p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Divider */}
      <div className="h-px bg-slate-700 w-full" />

      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-slate-400" />
        <h3 className="text-lg font-semibold text-slate-100">Configuración</h3>
      </div>

      {/* Leader Field Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-200">Agrupación por Líder</span>
          </div>
        </CardHeader>
        <CardBody>
          <Select
            label="Campo de Líder"
            value={config.leaderField}
            onChange={(e) => handleConfigChange('leaderField', e.target.value as AppConfig['leaderField'])}
            options={[
              { value: 'superior', label: 'SUPERIOR (Jerarquía superior)' },
              { value: 'jefe', label: 'JEFE (Reporta directo)' },
            ]}
          />
          <p className="text-xs text-slate-500 mt-2">
            Define qué campo usar para agrupar equipos y calcular cercanía al líder.
          </p>
        </CardBody>
      </Card>

      {/* Leader Box Assignments */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-200">Puestos de Líder (LID)</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-sm text-slate-400">
            Asigna qué líder ocupa cada posición LID en el plano físico.
          </p>

          {LID_POSITIONS.map((lid) => {
            const assignedLeader = config.leaderBoxAssignments?.[lid.id];
            return (
              <div key={lid.id} className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-300 w-24">{lid.id}</span>
                <span className="text-xs text-slate-500 w-56 truncate">{lid.label}</span>

                <Select
                  value={assignedLeader || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    const newAssignments = {
                      ...config.leaderBoxAssignments,
                      [lid.id]: value,
                    };
                    // Remove empty entries
                    Object.keys(newAssignments).forEach((k) => {
                      if (!newAssignments[k]) delete newAssignments[k];
                    });
                    setConfig({ leaderBoxAssignments: newAssignments as never });
                  }}
                  options={[
                    { value: '', label: 'Sin asignar' },
                    ...leaderNames.map((l) => ({ value: l, label: l })),
                  ]}
                  className="flex-1"
                />

                {assignedLeader && (
                  <button
                    onClick={() => {
                      const newAssignments = { ...config.leaderBoxAssignments };
                      delete newAssignments[lid.id];
                      setConfig({ leaderBoxAssignments: newAssignments as never });
                    }}
                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Remover asignación"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </CardBody>
      </Card>

      {/* Leaders Schedule */}
      {leaders.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-200">Horarios de Líderes</span>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <p className="px-3 pt-2 pb-1 text-xs text-slate-500">Editá los horarios para ajustar la distribución. Los cambios se aplican al reasignar.</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-900/60">
                  <th className="px-3 py-2 text-left font-semibold text-slate-400 uppercase tracking-wide">Líder</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-400 uppercase tracking-wide">Ingreso</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-400 uppercase tracking-wide">Egreso</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-400 uppercase tracking-wide">Equipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {leaders.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-200 truncate max-w-[120px]">{l.nombre}</td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="time"
                        value={l.entryTime}
                        onChange={(e) => updateLeader(l.id, { entryTime: e.target.value })}
                        className="w-24 bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 text-center"
                      />
                    </td>
                    <td className="px-2 py-1.5 text-center">
                      <input
                        type="time"
                        value={l.exitTime}
                        onChange={(e) => updateLeader(l.id, { exitTime: e.target.value })}
                        className="w-24 bg-slate-800 border border-slate-600 rounded-md px-2 py-1 text-indigo-300 font-mono text-xs focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 text-center"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-700 text-slate-300 font-semibold">
                        {l.teamSize}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Time Calculation */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-200">Cálculo de Horarios</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Respetar hora de salida del CSV</p>
              <p className="text-xs text-slate-500">
                Si está desactivado, calcula según contrato
              </p>
            </div>
            <button
              onClick={() => handleConfigChange('respectCsvExitTime', !config.respectCsvExitTime)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.respectCsvExitTime ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.respectCsvExitTime ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </CardBody>
      </Card>

      {/* CBS Segment */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-slate-400" />
            <span className="font-medium text-slate-200">Segmento CBS</span>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Mantener CBS junto</p>
              <p className="text-xs text-slate-500">
                Agrupa todo el segmento CBS en la misma zona
              </p>
            </div>
            <button
              onClick={() => handleConfigChange('keepCbsTogether', !config.keepCbsTogether)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.keepCbsTogether ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.keepCbsTogether ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          {config.keepCbsTogether && (
            <Select
              label="Zona para CBS (opcional)"
              value={config.cbsZoneId || ''}
              onChange={(e) => handleConfigChange('cbsZoneId', e.target.value || undefined)}
              options={[
                { value: '', label: 'Cualquier zona' },
                { value: 'LID 1', label: 'LID 1' },
                { value: 'LID 2', label: 'LID 2' },
                { value: 'LID 3', label: 'LID 3' },
                { value: 'LID 4', label: 'LID 4' },
                { value: 'LID 5', label: 'LID 5' },
                { value: 'LID 6', label: 'LID 6' },
                { value: 'LID 7', label: 'LID 7' },
              ]}
            />
          )}
        </CardBody>
      </Card>

      {/* Assignment Preferences */}
      <Card>
        <CardHeader>
          <span className="font-medium text-slate-200">Preferencias de Asignación</span>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Priorizar cercanía al líder</p>
              <p className="text-xs text-slate-500">
                Intenta sentar al equipo cerca de su líder
              </p>
            </div>
            <button
              onClick={() => handleConfigChange('prioritizeTeamProximity', !config.prioritizeTeamProximity)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.prioritizeTeamProximity ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.prioritizeTeamProximity ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Permitir equipos mezclados en fila</p>
              <p className="text-xs text-slate-500">
                Permite que diferentes líderes compartan fila
              </p>
            </div>
            <button
              onClick={() => handleConfigChange('allowMixedTeamsInRow', !config.allowMixedTeamsInRow)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.allowMixedTeamsInRow ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.allowMixedTeamsInRow ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>

          <div className="h-px bg-slate-700" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-200">Sistema Viborita</p>
              <p className="text-xs text-slate-500">
                Ignora zonas y proximidad — llena boxes disponibles en orden
              </p>
            </div>
            <button
              onClick={() => handleConfigChange('snakeMode', !config.snakeMode)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                config.snakeMode ? 'bg-indigo-600' : 'bg-slate-700'
              }`}
            >
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                config.snakeMode ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Save Button */}
      <Button
        variant="primary"
        className="w-full"
        onClick={() => {
          handleRecalculate();
        }}
      >
        <CheckCircle className="w-4 h-4 mr-2" />
        Aplicar Configuración y Ver Resultados
      </Button>
    </div>
  );
}
