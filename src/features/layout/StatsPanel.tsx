import { useMemo } from 'react';
import { Users, Grid3x3, Clock, AlertTriangle, Lightbulb, XCircle, Info } from 'lucide-react';
import { useStore } from '../../store';
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

  const shiftStats       = useMemo(() => calculateShiftStats(visibleAgents, layout.boxes), [visibleAgents, layout.boxes]);
  const teamStats        = useMemo(() => calculateTeamStats(visibleAgents, config.leaderField), [visibleAgents, config.leaderField]);
  const segmentStats     = useMemo(() => calculateSegmentStats(visibleAgents), [visibleAgents]);
  const hourlyOccupation = useMemo(() => calculateHourlyOccupation(layout.boxes), [layout.boxes]);
  const suggestions      = useMemo(() => generateCapacitySuggestions(visibleAgents, layout.boxes, stats), [visibleAgents, layout.boxes, stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h3 style={{ fontSize: 11, fontWeight: 700, color: '#bbbbbb', margin: 0, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Estadísticas
      </h3>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderBottom: '1px solid #fde68a' }}>
            <Lightbulb style={{ width: 13, height: 13, color: '#d97706' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sugerencias
            </span>
          </div>
          <div>
            {suggestions.map((s, i) => <SuggestionItem key={i} suggestion={s} />)}
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <StatCard icon={<Users style={{ width: 16, height: 16 }} />} label="Agentes" value={`${stats.assignedAgents}/${stats.totalAgents}`} subtitle={`${stats.unassignedAgents} sin asignar`} accent="#111111" />
        <StatCard icon={<Grid3x3 style={{ width: 16, height: 16 }} />} label="Ocupación" value={`${stats.occupationRate}%`} subtitle={`${stats.usedBoxes} de ${stats.totalBoxes}`} accent="#059669" />
        <StatCard icon={<Clock style={{ width: 16, height: 16 }} />} label="Reutilizados" value={stats.reusedBoxes} subtitle="Múltiples turnos" accent="#d97706" />
        <StatCard icon={<AlertTriangle style={{ width: 16, height: 16 }} />} label="Conflictos" value={conflicts.length} subtitle="Requieren atención" accent={conflicts.length > 0 ? '#dc2626' : '#059669'} />
      </div>

      {/* Shift Distribution */}
      <Section title="Distribución por Turno">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shiftStats.map((shift) => {
            const pct = shift.total > 0 ? (shift.assigned / shift.total) * 100 : 0;
            return (
              <div key={shift.shift} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#555555', textTransform: 'capitalize' }}>{shift.shift}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 72, height: 5, background: '#eeeeee', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#111111', borderRadius: 999, width: `${pct}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#bbbbbb', fontVariantNumeric: 'tabular-nums' }}>
                    {shift.assigned}/{shift.total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Hourly Occupation */}
      <Section title="Ocupación por Hora">
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 72, gap: 2 }}>
          {Array.from(hourlyOccupation.entries()).map(([hour, occupied]) => {
            const h = stats.totalBoxes > 0 ? (occupied / stats.totalBoxes) * 100 : 0;
            return (
              <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%', background: '#111111', borderRadius: '2px 2px 0 0',
                    height: `${h}%`, minHeight: occupied > 0 ? 3 : 0,
                    transition: 'height 0.3s ease',
                  }}
                  title={`${hour}:00 — ${occupied} boxes`}
                />
                <span style={{ fontSize: 8, color: '#cccccc', marginTop: 3 }}>{hour}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Top Teams */}
      {teamStats.length > 0 && (
        <Section title="Principales Equipos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {teamStats.slice(0, 5).map((team) => (
              <div key={team.leader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#333333' }} title={team.leader}>
                  {team.leader.length > 22 ? team.leader.slice(0, 22) + '…' : team.leader}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#bbbbbb', fontVariantNumeric: 'tabular-nums' }}>{team.assigned}/{team.total}</span>
                  {team.fragmented && (
                    <span title="Equipo fragmentado" style={{ fontSize: 10 }}>⚠️</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Segments */}
      {segmentStats.length > 0 && (
        <Section title="Segmentos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {segmentStats.map((segment) => (
              <div key={segment.segment} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#333333' }}>{segment.segment}</span>
                <span style={{ color: '#bbbbbb', fontVariantNumeric: 'tabular-nums' }}>{segment.assigned}/{segment.total}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 10, border: '1px solid #e8e8e8', background: '#ffffff', overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#bbbbbb', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      </div>
      <div style={{ padding: 10 }}>{children}</div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: CapacitySuggestion }) {
  const cfg = {
    error:   { bg: '#fef2f2', color: '#dc2626', icon: <XCircle style={{ width: 13, height: 13, color: '#dc2626', flexShrink: 0, marginTop: 2 }} /> },
    warning: { bg: '#fffbeb', color: '#d97706', icon: <AlertTriangle style={{ width: 13, height: 13, color: '#d97706', flexShrink: 0, marginTop: 2 }} /> },
    info:    { bg: '#eff6ff', color: '#2563eb', icon: <Info style={{ width: 13, height: 13, color: '#2563eb', flexShrink: 0, marginTop: 2 }} /> },
  };
  const s = cfg[suggestion.type];
  return (
    <div style={{ display: 'flex', gap: 7, padding: '7px 10px', background: s.bg }}>
      {s.icon}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: s.color, margin: 0 }}>{suggestion.title}</p>
        <p style={{ fontSize: 11, color: s.color, opacity: 0.75, margin: '2px 0 0', lineHeight: 1.5 }}>{suggestion.detail}</p>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtitle?: string;
  accent: string;
}

function StatCard({ icon, label, value, subtitle, accent }: StatCardProps) {
  return (
    <div style={{
      borderRadius: 10, background: '#ffffff',
      border: '1px solid #e8e8e8',
      borderTop: `2px solid ${accent}`,
      padding: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, color: accent }}>
        {icon}
        <span style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#bbbbbb' }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 10, color: '#cccccc', marginTop: 3 }}>{subtitle}</div>
      )}
    </div>
  );
}
