import { useMemo, useState } from 'react';
import { X, Clock, User as UserIcon, Users, Search, WifiOff } from 'lucide-react';
import { Modal, Badge, Button } from '../../components/ui';
import { Input } from '../../components/ui/Input';
import { getTeamColor, getShiftColor } from '../../lib/utils/colors';
import { timeRangesOverlap } from '../../lib/utils/timeParser';
import type { Box, Agent } from '../../types';

interface BoxDetailModalProps {
  box: Box;
  agents: Agent[];
  onClose: () => void;
  onAssignAgent?: (agentId: string, boxId: string) => void;
  onToggleActive?: (boxId: string) => void;
}

export function BoxDetailModal({ box, agents, onClose, onAssignAgent, onToggleActive }: BoxDetailModalProps) {
  const [isAssigning, setIsAssigning] = useState(false);
  const [search, setSearch] = useState('');

  const availableAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (agent.assignmentStatus !== 'unassigned') return false;
      for (const occ of box.occupations) {
        if (timeRangesOverlap(agent.entryTime, agent.exitTime, occ.entryTime, occ.exitTime)) return false;
      }
      return true;
    });
  }, [agents, box.occupations]);

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return availableAgents;
    const q = search.toLowerCase();
    return availableAgents.filter(
      (a) => a.nombre.toLowerCase().includes(q) || a.usuario.toLowerCase().includes(q)
    );
  }, [availableAgents, search]);

  const handleSelectAgent = (agent: Agent) => {
    onAssignAgent?.(agent.id, box.id);
    setIsAssigning(false);
  };

  const occupationDetails = useMemo(() => {
    return box.occupations.map((occ) => {
      const agent = agents.find((a) => a.id === occ.agentId);
      return { ...occ, agent, isLocked: agent?.isLocked || false };
    });
  }, [box.occupations, agents]);

  const timeline = useMemo(() => {
    const events: Array<{ time: string; type: 'start' | 'end'; label: string; agentId: string }> = [];
    occupationDetails.forEach((occ) => {
      events.push({ time: occ.entryTime, type: 'start', label: occ.agentName, agentId: occ.agentId });
      events.push({ time: occ.exitTime, type: 'end', label: occ.agentName, agentId: occ.agentId });
    });
    return events.sort((a, b) => parseInt(a.time.replace(':', '')) - parseInt(b.time.replace(':', '')));
  }, [occupationDetails]);

  return (
    <Modal isOpen={true} onClose={onClose} size="lg" title={`Box ${box.numero}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Out of service */}
        {!box.activo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
            <WifiOff style={{ width: 14, height: 14, color: '#dc2626', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Box fuera de servicio — excluido del cálculo</span>
          </div>
        )}

        {/* Box Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 14, background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
          {[
            { label: 'Zona', value: box.zona },
            { label: 'Fila / Columna', value: `${box.fila} / ${box.columna}` },
            { label: 'Estado', value: box.status },
            { label: 'Ocupaciones', value: `${box.occupations.length} hoy` },
          ].map(({ label, value }) => (
            <div key={label}>
              <span style={{ fontSize: 10, color: '#bbbbbb', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</span>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#333333', margin: '3px 0 0', textTransform: 'capitalize' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#555555', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              <Clock style={{ width: 13, height: 13 }} />
              Línea de Tiempo
            </h4>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: 11, top: 0, bottom: 0, width: 1, background: '#f0f0f0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginLeft: 28 }}>
                {timeline.map((event, idx) => (
                  <div key={idx} style={{ position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: -28, width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: event.type === 'start' ? '#111111' : '#e8e8e8',
                    }}>
                      {event.type === 'start' ? (
                        <svg style={{ width: 10, height: 10 }} fill="white" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <X style={{ width: 10, height: 10, color: '#aaaaaa' }} />
                      )}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <span style={{ fontWeight: 600, color: '#222222', fontVariantNumeric: 'tabular-nums' }}>{event.time}</span>
                      <span style={{ color: '#aaaaaa', marginLeft: 8 }}>
                        {event.type === 'start' ? 'Ingresa' : 'Sale'} {event.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Occupants */}
        {occupationDetails.length > 0 && (
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#555555', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ocupantes</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {occupationDetails.map((occ, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '10px 12px', borderRadius: 10,
                    background: occ.isLocked ? '#eff6ff' : '#fafafa',
                    borderLeft: `3px solid ${occ.isLocked ? '#2563eb' : '#e8e8e8'}`,
                    border: `1px solid ${occ.isLocked ? '#bfdbfe' : '#f0f0f0'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                        <UserIcon style={{ width: 13, height: 13, color: '#aaaaaa' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{occ.agent?.nombre}</span>
                        {occ.isLocked && <Badge variant="primary" size="sm">Fijado</Badge>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#888888' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Clock style={{ width: 11, height: 11 }} />
                          {occ.entryTime} – {occ.exitTime}
                        </span>
                        <span>·</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Users style={{ width: 11, height: 11 }} />
                          {occ.leader}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99,
                          color: '#ffffff', fontWeight: 500,
                          background: getTeamColor(occ.leader),
                        }}>
                          {occ.leader.split(' ')[0]}
                        </span>
                        <Badge variant="gray" size="sm">{occ.segment}</Badge>
                      </div>
                    </div>
                    <div style={{ marginLeft: 12 }}>
                      <div
                        style={{ height: 56, width: 6, borderRadius: 999, background: getShiftColor(occ.entryTime) }}
                        title={`${occ.agent?.dailyHours || 6}h`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {occupationDetails.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', background: '#fafafa', borderRadius: 10, border: '1px solid #f0f0f0' }}>
            <Users style={{ width: 36, height: 36, color: '#dddddd', margin: '0 auto 8px' }} />
            <p style={{ color: '#bbbbbb', fontSize: 13, margin: 0 }}>Este box está libre todo el día</p>
          </div>
        )}

        {/* Constraints */}
        {(box.allowedSegments?.length || box.allowedTeams?.length || box.forbiddenSegments?.length || box.forbiddenTeams?.length) && (
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 600, color: '#555555', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Restricciones</h4>
            <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {box.allowedSegments?.length && (
                <p style={{ color: '#059669', margin: 0 }}>✓ Segmentos permitidos: {box.allowedSegments.join(', ')}</p>
              )}
              {box.allowedTeams?.length && (
                <p style={{ color: '#059669', margin: 0 }}>✓ Líderes permitidos: {box.allowedTeams.join(', ')}</p>
              )}
              {box.forbiddenSegments?.length && (
                <p style={{ color: '#dc2626', margin: 0 }}>✗ Segmentos prohibidos: {box.forbiddenSegments.join(', ')}</p>
              )}
              {box.forbiddenTeams?.length && (
                <p style={{ color: '#dc2626', margin: 0 }}>✗ Líderes prohibidos: {box.forbiddenTeams.join(', ')}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent selector */}
      {isAssigning && (
        <div style={{ marginTop: 16, border: '1px solid #e8e8e8', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: 12, background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#333333', margin: '0 0 8px' }}>
              Seleccionar agente ({availableAgents.length} disponibles sin conflicto)
            </p>
            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: '#bbbbbb' }} />
              <Input
                style={{ paddingLeft: 32 }}
                placeholder="Buscar por nombre o usuario…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {filteredAgents.length === 0 ? (
            <p style={{ fontSize: 12, color: '#aaaaaa', textAlign: 'center', padding: '16px 0', margin: 0 }}>
              {availableAgents.length === 0 ? 'No hay agentes disponibles para este horario' : 'Ningún agente coincide'}
            </p>
          ) : (
            <div style={{ maxHeight: 180, overflowY: 'auto' }}>
              {filteredAgents.map((agent, idx) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', fontSize: 13, textAlign: 'left', cursor: 'pointer',
                    background: 'none', border: 'none',
                    borderBottom: idx < filteredAgents.length - 1 ? '1px solid #f5f5f5' : 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div>
                    <span style={{ fontWeight: 600, color: '#222222' }}>{agent.nombre}</span>
                    <span style={{ color: '#aaaaaa', marginLeft: 8 }}>@{agent.usuario}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#cccccc', fontVariantNumeric: 'tabular-nums' }}>
                    {agent.entryTime} – {agent.exitTime}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(box.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.15s',
                background: 'transparent',
                border: box.activo ? '1px solid #fecaca' : '1px solid #bbf7d0',
                color: box.activo ? '#dc2626' : '#059669',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = box.activo ? '#fef2f2' : '#f0fdf4'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <WifiOff style={{ width: 13, height: 13 }} />
              {box.activo ? 'Marcar fuera de servicio' : 'Habilitar box'}
            </button>
          )}
        </div>
        {onAssignAgent && box.activo && (
          <Button
            variant={isAssigning ? 'secondary' : 'primary'}
            onClick={() => { setIsAssigning(!isAssigning); setSearch(''); }}
          >
            {isAssigning ? 'Cancelar' : 'Asignar Agente'}
          </Button>
        )}
      </div>
    </Modal>
  );
}
