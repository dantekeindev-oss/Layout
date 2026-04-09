import { useMemo } from 'react';
import { Settings, User as UserIcon, CheckCircle, Shield, Users, Layers, X, RotateCcw, Eye, EyeOff, Clock, AlertTriangle } from 'lucide-react';
import { useStore } from '../../store';
import { Select, Button } from '../../components/ui';
import type { AppConfig } from '../../types';
import { timeToMinutes } from '../../lib/utils/timeParser';

const SHIFT_WINDOWS = [
  { key: 'morning',   label: 'Mañana',   start: 360, end: 660  },
  { key: 'midday',    label: 'Mediodía', start: 720, end: 780  },
  { key: 'afternoon', label: 'Tarde',    start: 840, end: 1440 },
];

function timeRangesOverlapMinutes(s1: number, e1: number, s2: number, e2: number) {
  return s1 < e2 && e1 > s2;
}

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

  const leaderNames = useMemo(() => {
    const field = config.leaderField;
    const leaderSet = new Set<string>();
    agents.forEach((a) => {
      const leader = field === 'jefe' ? a.jefe : a.superior;
      if (leader) leaderSet.add(leader);
    });
    return Array.from(leaderSet).sort();
  }, [agents, config.leaderField]);

  const excludedTeamSize = useMemo(() => {
    if (!excludedLeader) return 0;
    const field = config.leaderField;
    return agents.filter((a) => {
      const leader = field === 'jefe' ? a.jefe : a.superior;
      return leader === excludedLeader;
    }).length;
  }, [excludedLeader, agents, config.leaderField]);

  const { layout } = useStore();

  const shiftCapacity = useMemo(() => {
    const activeBoxes = layout.boxes.filter((b) => b.type === 'box' && b.activo);
    const activeAgents = excludedLeader
      ? agents.filter((a) => {
          const l = config.leaderField === 'jefe' ? a.jefe : a.superior;
          return l !== excludedLeader;
        })
      : agents;

    return SHIFT_WINDOWS.map(({ key, label, start, end }) => {
      const shiftAgents = activeAgents.filter((a) => {
        const s = timeToMinutes(a.entryTime);
        let e = timeToMinutes(a.exitTime);
        if (e === 0 || e < s) e = 1440;
        return timeRangesOverlapMinutes(s, e, start, end);
      });

      let totalSlots = 0;
      for (const box of activeBoxes) {
        const occupants: { s: number; e: number }[] = [];
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

  const hasShortage = shiftCapacity.some((s) => s.shortage > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Quick Actions */}
      <div style={{ background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Settings style={{ width: 18, height: 18, color: '#888888' }} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111111', margin: 0 }}>Reasignar Lugares</p>
              <p style={{ fontSize: 11, color: '#aaaaaa', margin: 0 }}>Recalcula con la configuración actual</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>{agents.length}</div>
            <div style={{ fontSize: 10, color: '#bbbbbb' }}>agentes</div>
          </div>
        </div>
        <div style={{ padding: '10px 16px' }}>
          <Button variant="primary" className="w-full" onClick={handleRecalculate}>
            <RotateCcw className="w-3.5 h-3.5 mr-2" />
            Reasignar Todos los Lugares
          </Button>
        </div>
      </div>

      {/* Shift Capacity */}
      {agents.length > 0 && (
        <div style={{
          background: '#ffffff', borderRadius: 12, overflow: 'hidden',
          border: hasShortage ? '1px solid #fde68a' : '1px solid #e8e8e8',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 7 }}>
            <AlertTriangle style={{ width: 14, height: 14, color: hasShortage ? '#d97706' : '#cccccc' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#444444' }}>Capacidad por Turno</span>
          </div>
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {shiftCapacity.map(({ key, label, agentCount, totalSlots, shortage }) => {
              const pct = totalSlots > 0 ? Math.min(100, Math.round((agentCount / totalSlots) * 100)) : 0;
              const ok = shortage === 0;
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: '#444444' }}>{label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: '#bbbbbb' }}>{agentCount} / {totalSlots}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ok ? '#059669' : '#d97706' }}>
                        {ok ? 'OK' : `−${shortage}`}
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 5, borderRadius: 999, background: '#f0f0f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 999,
                      background: ok ? '#059669' : '#d97706',
                      width: `${Math.min(pct, 100)}%`,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exclude Leader */}
      <div style={{
        background: '#ffffff', borderRadius: 12, overflow: 'hidden',
        border: excludedLeader ? '1px solid #fecaca' : '1px solid #e8e8e8',
      }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {excludedLeader
              ? <EyeOff style={{ width: 14, height: 14, color: '#dc2626' }} />
              : <Eye style={{ width: 14, height: 14, color: '#aaaaaa' }} />
            }
            <span style={{ fontSize: 12, fontWeight: 600, color: excludedLeader ? '#dc2626' : '#444444' }}>
              {excludedLeader ? 'Excluyendo del Cálculo' : 'Excluir Equipo del Cálculo'}
            </span>
          </div>
          {excludedLeader && (
            <button
              onClick={() => setConfig({ excludedLeader: '' })}
              style={{ padding: 4, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 12, color: '#aaaaaa', margin: 0 }}>
              Excluye un líder y su equipo del cálculo
            </p>
            {excludedTeamSize > 0 && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 10, color: '#bbbbbb' }}>Excluidos:</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>
                  {excludedTeamSize}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button
              style={{
                width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 8,
                fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
                background: !excludedLeader ? '#111111' : 'transparent',
                color: !excludedLeader ? '#ffffff' : '#888888',
                border: '1px solid transparent',
              }}
              onClick={() => handleExcludeLeader('')}
            >
              Incluir todos los equipos
            </button>

            {leaderNames.map((leader) => (
              <button
                key={leader}
                onClick={() => handleExcludeLeader(leader)}
                style={{
                  width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: 8,
                  fontSize: 12, fontWeight: 500, cursor: excludedLeader && excludedLeader !== leader ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'all 0.15s',
                  background: excludedLeader === leader ? '#dc2626' : 'transparent',
                  color: excludedLeader === leader ? '#ffffff' : excludedLeader ? '#cccccc' : '#555555',
                  opacity: excludedLeader && excludedLeader !== leader ? 0.45 : 1,
                  border: '1px solid transparent',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leader}</span>
                {excludedLeader === leader && (
                  <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 4 }}>
                    Excluido
                  </span>
                )}
              </button>
            ))}
          </div>

          {excludedLeader && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca' }}>
              <p style={{ fontSize: 11, color: '#dc2626', margin: 0 }}>
                El equipo de <strong>"{excludedLeader}"</strong> queda fuera del cálculo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f0f0f0' }} />

      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Settings style={{ width: 14, height: 14, color: '#aaaaaa' }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#444444' }}>Configuración</span>
      </div>

      {/* Leader Field */}
      <ConfigCard icon={<Users style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Agrupación por Líder">
        <Select
          label="Campo de Líder"
          value={config.leaderField}
          onChange={(e) => handleConfigChange('leaderField', e.target.value as AppConfig['leaderField'])}
          options={[
            { value: 'superior', label: 'SUPERIOR (Jerarquía superior)' },
            { value: 'jefe', label: 'JEFE (Reporta directo)' },
          ]}
        />
        <p style={{ fontSize: 11, color: '#bbbbbb', marginTop: 6, marginBottom: 0 }}>
          Define qué campo usar para agrupar equipos.
        </p>
      </ConfigCard>

      {/* LID Assignments */}
      <ConfigCard icon={<Shield style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Puestos de Líder (LID)">
        <p style={{ fontSize: 12, color: '#aaaaaa', marginTop: 0, marginBottom: 10 }}>
          Asigna qué líder ocupa cada posición LID.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {LID_POSITIONS.map((lid) => {
            const assignedLeader = config.leaderBoxAssignments?.[lid.id];
            return (
              <div key={lid.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#444444', width: 52, flexShrink: 0 }}>{lid.id}</span>
                <Select
                  value={assignedLeader || ''}
                  onChange={(e) => {
                    const value = e.target.value || undefined;
                    const newAssignments = { ...config.leaderBoxAssignments, [lid.id]: value };
                    Object.keys(newAssignments).forEach((k) => { if (!newAssignments[k]) delete newAssignments[k]; });
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
                    style={{ padding: 4, color: '#cccccc', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    <X style={{ width: 13, height: 13 }} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </ConfigCard>

      {/* Leader Schedules */}
      {leaders.length > 0 && (
        <ConfigCard icon={<Clock style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Horarios de Líderes">
          <p style={{ fontSize: 11, color: '#aaaaaa', marginTop: 0, marginBottom: 8 }}>
            Los cambios se aplican al reasignar.
          </p>
          <div style={{ border: '1px solid #e8e8e8', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: '#aaaaaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Líder</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: '#aaaaaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ingreso</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: '#aaaaaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Egreso</th>
                  <th style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 600, color: '#aaaaaa', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Equipo</th>
                </tr>
              </thead>
              <tbody>
                {leaders.map((l, idx) => (
                  <tr key={l.id} style={{ borderBottom: idx < leaders.length - 1 ? '1px solid #f5f5f5' : 'none' }}>
                    <td style={{ padding: '6px 10px', fontWeight: 500, color: '#333333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>
                      {l.nombre}
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <input
                        type="time"
                        value={l.entryTime}
                        onChange={(e) => updateLeader(l.id, { entryTime: e.target.value })}
                        style={{
                          width: 90, background: '#f8f8f8', border: '1px solid #e8e8e8',
                          borderRadius: 6, padding: '4px 6px', color: '#333333',
                          fontFamily: 'monospace', fontSize: 12, textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                    </td>
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <input
                        type="time"
                        value={l.exitTime}
                        onChange={(e) => updateLeader(l.id, { exitTime: e.target.value })}
                        style={{
                          width: 90, background: '#f8f8f8', border: '1px solid #e8e8e8',
                          borderRadius: 6, padding: '4px 6px', color: '#333333',
                          fontFamily: 'monospace', fontSize: 12, textAlign: 'center',
                          outline: 'none',
                        }}
                      />
                    </td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, borderRadius: '50%',
                        background: '#f0f0f0', color: '#555555',
                        fontSize: 11, fontWeight: 600,
                      }}>
                        {l.teamSize}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ConfigCard>
      )}

      {/* Time Calculation */}
      <ConfigCard icon={<Layers style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Cálculo de Horarios">
        <ToggleRow
          label="Respetar hora de salida del CSV"
          description="Si desactivado, calcula según contrato"
          value={config.respectCsvExitTime}
          onChange={() => handleConfigChange('respectCsvExitTime', !config.respectCsvExitTime)}
        />
      </ConfigCard>

      {/* CBS Segment */}
      <ConfigCard icon={<UserIcon style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Segmento CBS">
        <ToggleRow
          label="Mantener CBS junto"
          description="Agrupa el segmento CBS en la misma zona"
          value={config.keepCbsTogether}
          onChange={() => handleConfigChange('keepCbsTogether', !config.keepCbsTogether)}
        />
        {config.keepCbsTogether && (
          <div style={{ marginTop: 10 }}>
            <Select
              label="Zona para CBS (opcional)"
              value={config.cbsZoneId || ''}
              onChange={(e) => handleConfigChange('cbsZoneId', e.target.value || undefined)}
              options={[
                { value: '', label: 'Cualquier zona' },
                { value: 'LID 1', label: 'LID 1' }, { value: 'LID 2', label: 'LID 2' },
                { value: 'LID 3', label: 'LID 3' }, { value: 'LID 4', label: 'LID 4' },
                { value: 'LID 5', label: 'LID 5' }, { value: 'LID 6', label: 'LID 6' },
                { value: 'LID 7', label: 'LID 7' },
              ]}
            />
          </div>
        )}
      </ConfigCard>

      {/* Assignment Preferences */}
      <ConfigCard icon={<Settings style={{ width: 14, height: 14, color: '#aaaaaa' }} />} title="Preferencias de Asignación">
        <ToggleRow
          label="Priorizar cercanía al líder"
          description="Sienta al equipo cerca de su líder"
          value={config.prioritizeTeamProximity}
          onChange={() => handleConfigChange('prioritizeTeamProximity', !config.prioritizeTeamProximity)}
        />
        <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
        <ToggleRow
          label="Permitir equipos mezclados en fila"
          description="Diferentes líderes pueden compartir fila"
          value={config.allowMixedTeamsInRow}
          onChange={() => handleConfigChange('allowMixedTeamsInRow', !config.allowMixedTeamsInRow)}
        />
        <div style={{ height: 1, background: '#f0f0f0', margin: '10px 0' }} />
        <ToggleRow
          label="Sistema Viborita"
          description="Ignora zonas — llena boxes en orden"
          value={config.snakeMode}
          onChange={() => handleConfigChange('snakeMode', !config.snakeMode)}
        />
      </ConfigCard>

      {/* Apply */}
      <Button variant="primary" className="w-full" onClick={handleRecalculate}>
        <CheckCircle className="w-3.5 h-3.5 mr-2" />
        Aplicar y Ver Resultados
      </Button>
    </div>
  );
}

function ConfigCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 7 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 600, color: '#444444' }}>{title}</span>
      </div>
      <div style={{ padding: '12px 14px' }}>{children}</div>
    </div>
  );
}

function ToggleRow({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#333333', margin: 0 }}>{label}</p>
        <p style={{ fontSize: 11, color: '#aaaaaa', margin: '2px 0 0' }}>{description}</p>
      </div>
      <button
        onClick={onChange}
        style={{
          position: 'relative', width: 40, height: 22, borderRadius: 999,
          background: value ? '#111111' : '#e0e0e0',
          border: 'none', cursor: 'pointer', flexShrink: 0,
          transition: 'background 0.2s ease',
        }}
      >
        <span style={{
          position: 'absolute', top: 2, width: 18, height: 18, background: '#ffffff',
          borderRadius: '50%', transition: 'transform 0.2s ease',
          transform: value ? 'translateX(20px)' : 'translateX(2px)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }} />
      </button>
    </div>
  );
}
