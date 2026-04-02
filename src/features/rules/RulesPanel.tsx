import { useState, useMemo } from 'react';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store';
import { Card, CardBody, Button, Badge } from '../../components/ui';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import type { Rule } from '../../types';

export function RulesPanel() {
  const { rules, addRule, updateRule, removeRule, toggleRule, agents, config } = useStore();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const leaders = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => {
      const leader = config.leaderField === 'jefe' ? a.jefe : a.superior;
      if (leader) set.add(leader);
    });
    return Array.from(set).sort();
  }, [agents, config.leaderField]);

  const segments = useMemo(() => {
    const set = new Set<string>();
    agents.forEach((a) => { if (a.segmento) set.add(a.segmento); });
    return Array.from(set).sort();
  }, [agents]);

  const handleCreateRule = (ruleData: Partial<Rule>) => {
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      type: ruleData.type!,
      priority: ruleData.priority || 'medium',
      enabled: true,
      description: ruleData.description || '',
      ...ruleData,
    } as Rule;
    addRule(newRule);
    setIsAddModalOpen(false);
  };

  const getPriorityColor = (priority: Rule['priority']) => {
    const colors = {
      high: 'bg-red-900/60 text-red-300',
      medium: 'bg-amber-900/60 text-amber-300',
      low: 'bg-slate-700 text-slate-300',
    };
    return colors[priority];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Reglas de Asignación</h3>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-4 h-4 mr-1" />
          Agregar Regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-slate-500">No hay reglas configuradas</p>
            <p className="text-sm text-slate-400 mt-1">
              Agrega reglas para personalizar la asignación
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => toggleRule(rule.id)}
              onEdit={(updates) => updateRule(rule.id, updates)}
              onDelete={() => removeRule(rule.id)}
              priorityColor={getPriorityColor(rule.priority)}
            />
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <AddRuleModal
          leaders={leaders}
          segments={segments}
          onClose={() => setIsAddModalOpen(false)}
          onCreate={handleCreateRule}
        />
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: Rule;
  onToggle: () => void;
  onEdit: (updates: Partial<Rule>) => void;
  onDelete: () => void;
  priorityColor: string;
}

function RuleCard({ rule, onToggle, onDelete, priorityColor }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className={`transition-all ${!rule.enabled ? 'opacity-60' : ''}`}>
      <CardBody>
        <div className="flex items-start gap-3">
          <button className="mt-1 text-slate-400 hover:text-slate-200 cursor-grab" draggable>
            <GripVertical className="w-4 h-4" />
          </button>

          <button
            onClick={onToggle}
            className={`
              mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors
              ${rule.enabled ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}
            `}
          >
            {rule.enabled && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-white">{rule.description}</span>
              <Badge className={priorityColor} size="sm">
                {rule.priority === 'high' ? 'Alta' : rule.priority === 'medium' ? 'Media' : 'Baja'}
              </Badge>
              <Badge variant="gray" size="sm">
                {getRuleTypeLabel(rule.type)}
              </Badge>
            </div>

            {isExpanded && (
              <div className="mt-2 text-sm text-slate-400 space-y-1">
                <RuleDetails rule={rule} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 text-slate-400 hover:text-slate-200"
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button onClick={onDelete} className="p-1 text-slate-400 hover:text-red-400">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function RuleDetails({ rule }: { rule: Rule }) {
  switch (rule.type) {
    case 'fix-leader':
      return <><p>Líder: <strong>{rule.leaderName}</strong></p><p>Box: <strong>{rule.boxId}</strong></p></>;
    case 'near-leader':
      return <><p>Líder: <strong>{rule.leaderName}</strong></p><p>Distancia máx: <strong>{rule.maxDistance}</strong></p></>;
    case 'keep-segment-together':
      return <><p>Segmento: <strong>{rule.segment}</strong></p>{rule.zoneId && <p>Zona: <strong>{rule.zoneId}</strong></p>}</>;
    case 'zone-restriction':
      return (
        <>
          <p>Objetivo: <strong>{rule.targetType}</strong> — <strong>{rule.targetValue}</strong></p>
          {rule.allowedZoneIds.length > 0 && <p>Zonas permitidas: <strong>{rule.allowedZoneIds.join(', ')}</strong></p>}
          {rule.forbiddenZoneIds && rule.forbiddenZoneIds.length > 0 && <p>Zonas prohibidas: <strong>{rule.forbiddenZoneIds.join(', ')}</strong></p>}
        </>
      );
    case 'team-separation':
      return <><p>Equipos: <strong>{rule.team1}</strong> y <strong>{rule.team2}</strong></p><p>Distancia mín: <strong>{rule.minDistance}</strong></p></>;
    case 'manual-assignment':
      return <><p>Agente ID: <strong>{rule.agentId}</strong></p><p>Box: <strong>{rule.boxId}</strong></p></>;
    default:
      return null;
  }
}

function getRuleTypeLabel(type: Rule['type']): string {
  const labels: Record<Rule['type'], string> = {
    'fix-leader': 'Fijar Líder',
    'near-leader': 'Cerca del Líder',
    'keep-segment-together': 'Mantener Segmento Unido',
    'zone-restriction': 'Restricción de Zona',
    'team-separation': 'Separar Equipos',
    'manual-assignment': 'Asignación Manual',
  };
  return labels[type];
}

interface AddRuleModalProps {
  leaders: string[];
  segments: string[];
  onClose: () => void;
  onCreate: (rule: Partial<Rule>) => void;
}

function AddRuleModal({ leaders, segments, onClose, onCreate }: AddRuleModalProps) {
  const { layout, agents } = useStore();
  const zones = layout.zones;

  const [type, setType] = useState<Rule['type']>('fix-leader');
  const [priority, setPriority] = useState<Rule['priority']>('medium');
  const [description, setDescription] = useState('');

  // fix-leader / near-leader / manual-assignment shared fields
  const [leaderName, setLeaderName] = useState(leaders[0] || '');
  const [boxNumber, setBoxNumber] = useState('1');
  const [maxDistance, setMaxDistance] = useState('3');

  // keep-segment-together
  const [segment, setSegment] = useState(segments[0] || '');
  const [zoneId, setZoneId] = useState('');

  // zone-restriction
  const [targetType, setTargetType] = useState<'team' | 'segment' | 'leader'>('segment');
  const [targetValue, setTargetValue] = useState(segments[0] || '');
  const [allowedZoneIds, setAllowedZoneIds] = useState<string[]>([]);
  const [forbiddenZoneIds, setForbiddenZoneIds] = useState<string[]>([]);

  // team-separation
  const [team1, setTeam1] = useState(leaders[0] || '');
  const [team2, setTeam2] = useState(leaders[1] || leaders[0] || '');
  const [minDistance, setMinDistance] = useState('5');

  // manual-assignment
  const [agentId, setAgentId] = useState(agents[0]?.id || '');

  const toggleZoneAllowed = (zId: string) => {
    setAllowedZoneIds((prev) =>
      prev.includes(zId) ? prev.filter((z) => z !== zId) : [...prev, zId]
    );
    setForbiddenZoneIds((prev) => prev.filter((z) => z !== zId));
  };

  const toggleZoneForbidden = (zId: string) => {
    setForbiddenZoneIds((prev) =>
      prev.includes(zId) ? prev.filter((z) => z !== zId) : [...prev, zId]
    );
    setAllowedZoneIds((prev) => prev.filter((z) => z !== zId));
  };

  const getAutoDescription = (): string => {
    switch (type) {
      case 'fix-leader': return `Fijar ${leaderName} en box ${boxNumber}`;
      case 'near-leader': return `Equipo de ${leaderName} cerca del líder (máx. ${maxDistance})`;
      case 'keep-segment-together': return `Mantener ${segment} junto${zoneId ? ` en zona ${zones.find(z => z.id === zoneId)?.name || zoneId}` : ''}`;
      case 'zone-restriction': return `Restricción de zona para ${targetValue}`;
      case 'team-separation': return `Separar equipo de ${team1} y ${team2} (mín. ${minDistance})`;
      case 'manual-assignment': {
        const agent = agents.find((a) => a.id === agentId);
        return `Asignar ${agent?.nombre || agentId} al box ${boxNumber}`;
      }
    }
  };

  const buildRule = (): Partial<Rule> => {
    const base = { type, priority, description: description.trim() || getAutoDescription() };
    switch (type) {
      case 'fix-leader':
        return { ...base, leaderName, boxId: `box-${boxNumber}` };
      case 'near-leader':
        return { ...base, leaderName, maxDistance: parseInt(maxDistance) };
      case 'keep-segment-together':
        return { ...base, segment, zoneId: zoneId || undefined };
      case 'zone-restriction':
        return { ...base, targetType, targetValue, allowedZoneIds, forbiddenZoneIds };
      case 'team-separation':
        return { ...base, team1, team2, minDistance: parseInt(minDistance) };
      case 'manual-assignment':
        return { ...base, agentId, boxId: `box-${boxNumber}` };
    }
  };

  const targetValues = targetType === 'segment' ? segments : leaders;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Nueva Regla"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onCreate(buildRule())}>Crear Regla</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Tipo + Prioridad */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Tipo de regla"
            value={type}
            onChange={(e) => setType(e.target.value as Rule['type'])}
            options={[
              { value: 'fix-leader', label: 'Fijar Líder' },
              { value: 'near-leader', label: 'Cerca del Líder' },
              { value: 'keep-segment-together', label: 'Mantener Segmento Unido' },
              { value: 'zone-restriction', label: 'Restricción de Zona' },
              { value: 'team-separation', label: 'Separar Equipos' },
              { value: 'manual-assignment', label: 'Asignación Manual' },
            ]}
          />
          <Select
            label="Prioridad"
            value={priority}
            onChange={(e) => setPriority(e.target.value as Rule['priority'])}
            options={[
              { value: 'high', label: 'Alta' },
              { value: 'medium', label: 'Media' },
              { value: 'low', label: 'Baja' },
            ]}
          />
        </div>

        {/* Campos dinámicos por tipo */}
        {(type === 'fix-leader' || type === 'near-leader') && (
          <Select
            label="Líder"
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
            options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes cargados —' }]}
          />
        )}

        {(type === 'fix-leader') && (
          <Input
            label="Número de box"
            type="number"
            min="1"
            value={boxNumber}
            onChange={(e) => setBoxNumber(e.target.value)}
          />
        )}

        {type === 'near-leader' && (
          <Input
            label="Distancia máxima (en boxes)"
            type="number"
            min="1"
            value={maxDistance}
            onChange={(e) => setMaxDistance(e.target.value)}
          />
        )}

        {type === 'keep-segment-together' && (
          <>
            <Select
              label="Segmento"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              options={segments.length > 0 ? segments.map((s) => ({ value: s, label: s })) : [{ value: '', label: '— Sin segmentos cargados —' }]}
            />
            <Select
              label="Zona preferida (opcional)"
              value={zoneId}
              onChange={(e) => setZoneId(e.target.value)}
              options={[
                { value: '', label: '— Sin zona específica —' },
                ...zones.map((z) => ({ value: z.id, label: z.name })),
              ]}
            />
          </>
        )}

        {type === 'zone-restriction' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Tipo de objetivo"
                value={targetType}
                onChange={(e) => {
                  const t = e.target.value as 'team' | 'segment' | 'leader';
                  setTargetType(t);
                  setTargetValue(t === 'segment' ? (segments[0] || '') : (leaders[0] || ''));
                }}
                options={[
                  { value: 'segment', label: 'Segmento' },
                  { value: 'team', label: 'Equipo (líder)' },
                  { value: 'leader', label: 'Líder' },
                ]}
              />
              <Select
                label="Valor"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                options={targetValues.length > 0 ? targetValues.map((v) => ({ value: v, label: v })) : [{ value: '', label: '— Sin datos cargados —' }]}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-200 mb-2">Zonas</p>
              <div className="space-y-2">
                {zones.map((z) => (
                  <div key={z.id} className="flex items-center gap-6 px-3 py-2 border border-slate-700 rounded text-sm bg-slate-800/50">
                    <span className="flex-1 font-medium text-slate-100">{z.name}</span>
                    <label className="flex items-center gap-1.5 text-emerald-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={allowedZoneIds.includes(z.id)}
                        onChange={() => toggleZoneAllowed(z.id)}
                      />
                      Permitida
                    </label>
                    <label className="flex items-center gap-1.5 text-red-400 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={forbiddenZoneIds.includes(z.id)}
                        onChange={() => toggleZoneForbidden(z.id)}
                      />
                      Prohibida
                    </label>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {type === 'team-separation' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Equipo 1 (líder)"
                value={team1}
                onChange={(e) => setTeam1(e.target.value)}
                options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes cargados —' }]}
              />
              <Select
                label="Equipo 2 (líder)"
                value={team2}
                onChange={(e) => setTeam2(e.target.value)}
                options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes cargados —' }]}
              />
            </div>
            <Input
              label="Distancia mínima (en boxes)"
              type="number"
              min="1"
              value={minDistance}
              onChange={(e) => setMinDistance(e.target.value)}
            />
          </>
        )}

        {type === 'manual-assignment' && (
          <>
            <Select
              label="Agente"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              options={agents.length > 0 ? agents.map((a) => ({ value: a.id, label: `${a.nombre} (${a.usuario})` })) : [{ value: '', label: '— Sin agentes cargados —' }]}
            />
            <Input
              label="Número de box"
              type="number"
              min="1"
              value={boxNumber}
              onChange={(e) => setBoxNumber(e.target.value)}
            />
          </>
        )}

        {/* Descripción */}
        <Input
          label="Descripción"
          value={description}
          placeholder={getAutoDescription()}
          onChange={(e) => setDescription(e.target.value)}
          helperText="Dejar vacío para usar descripción automática"
        />
      </div>
    </Modal>
  );
}
