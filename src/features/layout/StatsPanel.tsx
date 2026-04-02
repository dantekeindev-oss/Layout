import { useMemo } from 'react';
import { Users, Grid3x3, Clock, AlertTriangle, Lightbulb, XCircle, Info } from 'lucide-react';
import { useStore } from '../../store';
import { Card, CardBody, CardHeader } from '../../components/ui';
import {
  calculateShiftStats, calculateTeamStats, calculateSegmentStats,
  calculateHourlyOccupation, generateCapacitySuggestions,
} from '../../lib/assignment/statsCalculator';
import type { CapacitySuggestion } from '../../lib/assignment/statsCalculator';

export function StatsPanel() {
  const { agents, layout, config, stats, conflicts } = useStore();
  const visibleAgents = useMemo(() => {
    const excludedLeader = config.excludedLeader?.trim();
    if (!excludedLeader) return agents;
    return agents.filter((agent) => {
      const leaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
      return leaderName !== excludedLeader;
    });
  }, [agents, config.excludedLeader, config.leaderField]);

  // Calculate additional stats
  const shiftStats = useMemo(() => calculateShiftStats(visibleAgents, layout.boxes), [visibleAgents, layout.boxes]);
  const teamStats = useMemo(() => calculateTeamStats(visibleAgents, config.leaderField), [visibleAgents, config.leaderField]);
  const segmentStats = useMemo(() => calculateSegmentStats(visibleAgents), [visibleAgents]);
  const hourlyOccupation = useMemo(() => calculateHourlyOccupation(layout.boxes), [layout.boxes]);
  const suggestions = useMemo(
    () => generateCapacitySuggestions(visibleAgents, layout.boxes, stats),
    [visibleAgents, layout.boxes, stats]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Estadísticas</h3>

      {/* Suggestions panel — only when there are unassigned agents */}
      {suggestions.length > 0 && (
        <Card className="border-amber-700">
          <CardHeader className="bg-amber-900/30 border-amber-700/50 py-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-semibold text-amber-200">
                Sugerencias de capacidad
              </h4>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            <div className="divide-y divide-slate-700">
              {suggestions.map((s, i) => (
                <SuggestionItem key={i} suggestion={s} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5" />}
          label="Agentes"
          value={`${stats.assignedAgents}/${stats.totalAgents}`}
          subtitle={`${stats.unassignedAgents} sin asignar`}
          color="primary"
        />
        <StatCard
          icon={<Grid3x3 className="w-5 h-5" />}
          label="Ocupación"
          value={`${stats.occupationRate}%`}
          subtitle={`${stats.usedBoxes} de ${stats.totalBoxes} boxes`}
          color="success"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Reutilizados"
          value={stats.reusedBoxes}
          subtitle="Boxes con múltiples turnos"
          color="warning"
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5" />}
          label="Conflictos"
          value={conflicts.length}
          subtitle="Requieren atención"
          color={conflicts.length > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Shift Distribution */}
      <Card>
        <CardHeader>
          <h4 className="text-sm font-semibold">Distribución por Turno</h4>
        </CardHeader>
        <CardBody>
          <div className="space-y-2">
            {shiftStats.map((shift) => (
              <div key={shift.shift} className="flex items-center justify-between">
                <span className="text-sm capitalize text-slate-300">{shift.shift}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500"
                      style={{ width: `${shift.total > 0 ? (shift.assigned / shift.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500">
                    {shift.assigned}/{shift.total}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Hourly Occupation */}
      <Card>
        <CardHeader>
          <h4 className="text-sm font-semibold">Ocupación por Hora</h4>
        </CardHeader>
        <CardBody>
          <div className="flex items-end justify-between h-24 gap-1">
            {Array.from(hourlyOccupation.entries()).map(([hour, occupied]) => (
              <div key={hour} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-indigo-500 rounded-t transition-all hover:bg-indigo-400"
                  style={{ height: `${(occupied / stats.totalBoxes) * 100}%`, minHeight: occupied > 0 ? '4px' : '0' }}
                  title={`${hour}:00 - ${occupied} boxes`}
                />
                <span className="text-xs text-slate-500 mt-1">{hour}</span>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Top Teams */}
      {teamStats.length > 0 && (
        <Card>
          <CardHeader>
            <h4 className="text-sm font-semibold">Principales Equipos</h4>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {teamStats.slice(0, 5).map((team) => (
                <div key={team.leader} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1" title={team.leader}>
                    {team.leader.length > 20 ? team.leader.slice(0, 20) + '...' : team.leader}
                  </span>
                  <span className="text-slate-500 ml-2">
                    {team.assigned}/{team.total}
                  </span>
                  {team.fragmented && (
                    <span className="text-xs text-warning-600 ml-1" title="Equipo fragmentado">
                      ⚠️
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Segments */}
      {segmentStats.length > 0 && (
        <Card>
          <CardHeader>
            <h4 className="text-sm font-semibold">Segmentos</h4>
          </CardHeader>
          <CardBody>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {segmentStats.map((segment) => (
                <div key={segment.segment} className="flex items-center justify-between text-sm">
                  <span className="text-slate-200">{segment.segment}</span>
                  <span className="text-slate-500">
                    {segment.assigned}/{segment.total}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: CapacitySuggestion }) {
  const styles = {
    error: {
      bg: 'bg-red-900/30',
      icon: <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />,
      title: 'text-red-200',
      detail: 'text-red-300',
    },
    warning: {
      bg: 'bg-amber-900/30',
      icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
      title: 'text-amber-200',
      detail: 'text-amber-300',
    },
    info: {
      bg: 'bg-blue-900/30',
      icon: <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />,
      title: 'text-blue-200',
      detail: 'text-blue-300',
    },
  };

  const s = styles[suggestion.type];

  return (
    <div className={`flex gap-2 px-3 py-2.5 ${s.bg}`}>
      {s.icon}
      <div className="min-w-0">
        <p className={`text-xs font-semibold ${s.title}`}>{suggestion.title}</p>
        <p className={`text-xs mt-0.5 leading-relaxed ${s.detail}`}>{suggestion.detail}</p>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'gray';
}

function StatCard({ icon, label, value, subtitle, color }: StatCardProps) {
  const colorClasses = {
    primary: 'bg-indigo-900/30 text-indigo-300 border-indigo-700/50',
    success: 'bg-emerald-900/30 text-emerald-300 border-emerald-700/50',
    warning: 'bg-amber-900/30 text-amber-300 border-amber-700/50',
    danger: 'bg-red-900/30 text-red-300 border-red-700/50',
    gray: 'bg-slate-800 text-slate-300 border-slate-600',
  };

  return (
    <Card className={colorClasses[color]}>
      <CardBody className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="opacity-70">{icon}</div>
          <span className="text-xs font-medium uppercase opacity-75">{label}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <div className="text-xs opacity-75 mt-1">{subtitle}</div>
        )}
      </CardBody>
    </Card>
  );
}
