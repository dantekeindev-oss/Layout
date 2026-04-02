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

  // Agents that can be placed in this box (unassigned + no time conflict)
  const availableAgents = useMemo(() => {
    return agents.filter((agent) => {
      if (agent.assignmentStatus !== 'unassigned') return false;
      for (const occ of box.occupations) {
        if (timeRangesOverlap(agent.entryTime, agent.exitTime, occ.entryTime, occ.exitTime)) {
          return false;
        }
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

  // Get full agent details for occupations
  const occupationDetails = useMemo(() => {
    return box.occupations.map((occ) => {
      const agent = agents.find((a) => a.id === occ.agentId);
      return {
        ...occ,
        agent,
        isLocked: agent?.isLocked || false,
      };
    });
  }, [box.occupations, agents]);

  // Calculate timeline
  const timeline = useMemo(() => {
    const events: Array<{ time: string; type: 'start' | 'end'; label: string; agentId: string }> = [];

    occupationDetails.forEach((occ) => {
      events.push({
        time: occ.entryTime,
        type: 'start',
        label: occ.agentName,
        agentId: occ.agentId,
      });
      events.push({
        time: occ.exitTime,
        type: 'end',
        label: occ.agentName,
        agentId: occ.agentId,
      });
    });

    return events.sort((a, b) => {
      const aTime = parseInt(a.time.replace(':', ''));
      const bTime = parseInt(b.time.replace(':', ''));
      return aTime - bTime;
    });
  }, [occupationDetails]);


  return (
    <Modal isOpen={true} onClose={onClose} size="lg" title={`Box ${box.numero}`}>
      <div className="space-y-4">

        {/* Out of service banner */}
        {!box.activo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-900/30 border border-red-700/50 rounded-lg">
            <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-semibold text-red-300">Box fuera de servicio — excluido de la asignación</span>
          </div>
        )}

        {/* Box Info */}
        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/50 rounded-lg">
          <div>
            <span className="text-xs text-slate-500">Zona</span>
            <p className="font-medium">{box.zona}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Fila/Columna</span>
            <p className="font-medium">{box.fila} / {box.columna}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Estado</span>
            <p className="font-medium capitalize">{box.status}</p>
          </div>
          <div>
            <span className="text-xs text-slate-500">Ocupaciones</span>
            <p className="font-medium">{box.occupations.length} hoy</p>
          </div>
        </div>

        {/* Timeline */}
        {timeline.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Línea de Tiempo
            </h4>
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-slate-700" />
              <div className="space-y-3 ml-8">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div
                      className={`
                        absolute -left-8 w-6 h-6 rounded-full flex items-center justify-center
                        ${event.type === 'start' ? 'bg-success-500' : 'bg-slate-500'}
                      `}
                    >
                      {event.type === 'start' ? (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <X className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-slate-100">{event.time}</span>
                      <span className="text-slate-500 ml-2">
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
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Ocupantes</h4>
            <div className="space-y-2">
              {occupationDetails.map((occ, idx) => (
                <div
                  key={idx}
                  className={`
                    p-3 rounded-lg border-l-4
                    ${occ.isLocked ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-800 border-slate-600'}
                  `}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <UserIcon className="w-4 h-4 text-slate-400" />
                        <span className="font-medium">{occ.agent?.nombre}</span>
                        {occ.isLocked && (
                          <Badge variant="primary" size="sm">Fijado</Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-sm text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {occ.entryTime} - {occ.exitTime}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {occ.leader}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className="text-xs px-2 py-1 rounded-full text-white"
                          style={{ backgroundColor: getTeamColor(occ.leader) }}
                        >
                          {occ.leader.split(' ')[0]}
                        </span>
                        <Badge variant="gray" size="sm">{occ.segment}</Badge>
                      </div>
                    </div>

                    {/* Duration bar */}
                    <div className="ml-4">
                      <div
                        className="h-16 w-2 rounded-full"
                        style={{ backgroundColor: getShiftColor(occ.entryTime) }}
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
          <div className="text-center py-8 bg-slate-800/50 rounded-lg">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-slate-500">Este box está libre todo el día</p>
          </div>
        )}

        {/* Constraints */}
        {(box.allowedSegments?.length || box.allowedTeams?.length || box.forbiddenSegments?.length || box.forbiddenTeams?.length) && (
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-2">Restricciones</h4>
            <div className="space-y-1 text-sm">
              {box.allowedSegments?.length && (
                <p className="text-success-600">
                  ✓ Segmentos permitidos: {box.allowedSegments.join(', ')}
                </p>
              )}
              {box.allowedTeams?.length && (
                <p className="text-success-600">
                  ✓ Líderes permitidos: {box.allowedTeams.join(', ')}
                </p>
              )}
              {box.forbiddenSegments?.length && (
                <p className="text-danger-600">
                  ✗ Segmentos prohibidos: {box.forbiddenSegments.join(', ')}
                </p>
              )}
              {box.forbiddenTeams?.length && (
                <p className="text-danger-600">
                  ✗ Líderes prohibidos: {box.forbiddenTeams.join(', ')}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Agent selector */}
      {isAssigning && (
        <div className="mt-4 border rounded-lg overflow-hidden">
          <div className="p-3 bg-slate-800/50 border-b">
            <p className="text-sm font-medium text-slate-200 mb-2">
              Seleccionar agente ({availableAgents.length} disponibles sin conflicto horario)
            </p>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Buscar por nombre o usuario..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          {filteredAgents.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              {availableAgents.length === 0
                ? 'No hay agentes sin asignar disponibles para este horario'
                : 'Ningún agente coincide con la búsqueda'}
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto divide-y">
              {filteredAgents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => handleSelectAgent(agent)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-indigo-900/30 transition-colors text-left"
                >
                  <div>
                    <span className="font-medium">{agent.nombre}</span>
                    <span className="text-slate-400 ml-2">@{agent.usuario}</span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {agent.entryTime} – {agent.exitTime}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between mt-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {onToggleActive && (
            <button
              onClick={() => onToggleActive(box.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${
                box.activo
                  ? 'border-red-700/50 text-red-400 hover:bg-red-900/30'
                  : 'border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/30'
              }`}
            >
              <WifiOff className="w-3.5 h-3.5" />
              {box.activo ? 'Marcar fuera de servicio' : 'Volver a habilitar'}
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
