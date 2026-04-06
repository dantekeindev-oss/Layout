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

  const shiftStats      = useMemo(() => calculateShiftStats(visibleAgents, layout.boxes), [visibleAgents, layout.boxes]);
  const teamStats       = useMemo(() => calculateTeamStats(visibleAgents, config.leaderField), [visibleAgents, config.leaderField]);
  const segmentStats    = useMemo(() => calculateSegmentStats(visibleAgents), [visibleAgents]);
  const hourlyOccupation = useMemo(() => calculateHourlyOccupation(layout.boxes), [layout.boxes]);
  const suggestions     = useMemo(() => generateCapacitySuggestions(visibleAgents, layout.boxes, stats), [visibleAgents, layout.boxes, stats]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1c1917', margin: 0, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Estadísticas
      </h3>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ borderRadius: 10, border: '1px solid #fde68a', background: '#fffbeb', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #fde68a' }}>
            <Lightbulb style={{ width: 14, height: 14, color: '#b06018' }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#b06018', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Sugerencias de capacidad
            </span>
          </div>
          <div>
            {suggestions.map((s, i) => <SuggestionItem key={i} suggestion={s} />)}
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatCard icon={<Users style={{ width: 18, height: 18 }} />} label="Agentes" value={`${stats.assignedAgents}/${stats.totalAgents}`} subtitle={`${stats.unassignedAgents} sin asignar`} accent="#1c1917" />
        <StatCard icon={<Grid3x3 style={{ width: 18, height: 18 }} />} label="Ocupación" value={`${stats.occupationRate}%`} subtitle={`${stats.usedBoxes} de ${stats.totalBoxes}`} accent="#1a7a56" />
        <StatCard icon={<Clock style={{ width: 18, height: 18 }} />} label="Reutilizados" value={stats.reusedBoxes} subtitle="Múltiples turnos" accent="#b06018" />
        <StatCard icon={<AlertTriangle style={{ width: 18, height: 18 }} />} label="Conflictos" value={conflicts.length} subtitle="Requieren atención" accent={conflicts.length > 0 ? '#dc2626' : '#1a7a56'} />
      </div>

      {/* Shift Distribution */}
      <Section title="Distribución por Turno">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {shiftStats.map((shift) => {
            const pct = shift.total > 0 ? (shift.assigned / shift.total) * 100 : 0;
            return (
              <div key={shift.shift} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: '#44403c', textTransform: 'capitalize' }}>{shift.shift}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 80, height: 6, background: '#e0dbd0', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#1c1917', borderRadius: 999, width: `${pct}%`, transition: 'width 0.3s ease' }} />
                  </div>
                  <span style={{ fontSize: 11, color: '#a8a29e', fontVariantNumeric: 'tabular-nums' }}>
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
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, gap: 2 }}>
          {Array.from(hourlyOccupation.entries()).map(([hour, occupied]) => {
            const h = stats.totalBoxes > 0 ? (occupied / stats.totalBoxes) * 100 : 0;
            return (
              <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '100%', background: '#1c1917', borderRadius: '3px 3px 0 0',
                    height: `${h}%`, minHeight: occupied > 0 ? 3 : 0,
                    transition: 'height 0.3s ease',
                  }}
                  title={`${hour}:00 — ${occupied} boxes`}
                />
                <span style={{ fontSize: 9, color: '#a8a29e', marginTop: 3 }}>{hour}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Top Teams */}
      {teamStats.length > 0 && (
        <Section title="Principales Equipos">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {teamStats.slice(0, 5).map((team) => (
              <div key={team.leader} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1c1917' }} title={team.leader}>
                  {team.leader.length > 22 ? team.leader.slice(0, 22) + '…' : team.leader}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: '#a8a29e', fontVariantNumeric: 'tabular-nums' }}>{team.assigned}/{team.total}</span>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
            {segmentStats.map((segment) => (
              <div key={segment.segment} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: '#1c1917' }}>{segment.segment}</span>
                <span style={{ color: '#a8a29e', fontVariantNumeric: 'tabular-nums' }}>{segment.assigned}/{segment.total}</span>
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
    <div style={{ borderRadius: 10, border: '1px solid #e0dbd0', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid #e0dbd0', background: '#faf7f2' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{title}</span>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );
}

function SuggestionItem({ suggestion }: { suggestion: CapacitySuggestion }) {
  const config = {
    error:   { bg: '#fff5f5', color: '#dc2626', icon: <XCircle style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0, marginTop: 2 }} /> },
    warning: { bg: '#fffbeb', color: '#b06018', icon: <AlertTriangle style={{ width: 14, height: 14, color: '#b06018', flexShrink: 0, marginTop: 2 }} /> },
    info:    { bg: '#eff6ff', color: '#2563eb', icon: <Info style={{ width: 14, height: 14, color: '#2563eb', flexShrink: 0, marginTop: 2 }} /> },
  };
  const s = config[suggestion.type];
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 12px', background: s.bg }}>
      {s.icon}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: s.color, margin: 0 }}>{suggestion.title}</p>
        <p style={{ fontSize: 11, color: s.color, opacity: 0.8, margin: '2px 0 0', lineHeight: 1.5 }}>{suggestion.detail}</p>
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
      borderRadius: 10, background: '#fff',
      border: '1px solid #e0dbd0', borderTop: `2px solid ${accent}`,
      padding: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: accent }}>
        {icon}
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a8a29e' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
      {subtitle && (
        <div style={{ fontSize: 10, color: '#a8a29e', marginTop: 4 }}>{subtitle}</div>
      )}
    </div>
  );
}
