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

  const getPriorityStyle = (priority: Rule['priority']) => {
    const styles = {
      high:   { background: '#fef2f2', color: '#dc2626' },
      medium: { background: '#fffbeb', color: '#d97706' },
      low:    { background: '#f5f5f5', color: '#888888' },
    };
    return styles[priority];
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#555555' }}>
          {rules.length === 0 ? 'Sin reglas configuradas' : `${rules.length} regla${rules.length !== 1 ? 's' : ''}`}
        </span>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" />
          Nueva regla
        </Button>
      </div>

      {rules.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center', background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: 12 }}>
          <p style={{ color: '#aaaaaa', fontSize: 13, margin: 0 }}>No hay reglas configuradas</p>
          <p style={{ color: '#cccccc', fontSize: 12, margin: '4px 0 0' }}>
            Agregá reglas para personalizar la asignación
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={() => toggleRule(rule.id)}
              onEdit={(updates) => updateRule(rule.id, updates)}
              onDelete={() => removeRule(rule.id)}
              priorityStyle={getPriorityStyle(rule.priority)}
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
  priorityStyle: { background: string; color: string };
}

function RuleCard({ rule, onToggle, onDelete, priorityStyle }: RuleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div style={{
      background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: 12,
      overflow: 'hidden', opacity: rule.enabled ? 1 : 0.5,
      transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px' }}>
        {/* Drag handle */}
        <button style={{ marginTop: 2, color: '#dddddd', cursor: 'grab', background: 'none', border: 'none', padding: 0 }} draggable>
          <GripVertical style={{ width: 15, height: 15 }} />
        </button>

        {/* Toggle */}
        <button
          onClick={onToggle}
          style={{
            marginTop: 2, width: 18, height: 18, borderRadius: 5,
            border: `2px solid ${rule.enabled ? '#111111' : '#d8d8d8'}`,
            background: rule.enabled ? '#111111' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          {rule.enabled && (
            <svg style={{ width: 10, height: 10 }} fill="white" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>{rule.description}</span>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
              ...priorityStyle,
            }}>
              {rule.priority === 'high' ? 'Alta' : rule.priority === 'medium' ? 'Media' : 'Baja'}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 5,
              background: '#f5f5f5', color: '#888888',
            }}>
              {getRuleTypeLabel(rule.type)}
            </span>
          </div>

          {isExpanded && (
            <div style={{ marginTop: 6, fontSize: 12, color: '#888888', lineHeight: 1.6 }}>
              <RuleDetails rule={rule} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ padding: 5, color: '#cccccc', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f5f5f5'; e.currentTarget.style.color = '#888888'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#cccccc'; }}
          >
            {isExpanded ? <ChevronUp style={{ width: 14, height: 14 }} /> : <ChevronDown style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={onDelete}
            style={{ padding: 5, color: '#cccccc', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={e => { e.currentTarget.style.background = '#fef2f2'; e.currentTarget.style.color = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#cccccc'; }}
          >
            <Trash2 style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

function RuleDetails({ rule }: { rule: Rule }) {
  switch (rule.type) {
    case 'fix-leader':
      return <><p style={{ margin: 0 }}>Líder: <strong style={{ color: '#333333' }}>{rule.leaderName}</strong></p><p style={{ margin: 0 }}>Box: <strong style={{ color: '#333333' }}>{rule.boxId}</strong></p></>;
    case 'near-leader':
      return <><p style={{ margin: 0 }}>Líder: <strong style={{ color: '#333333' }}>{rule.leaderName}</strong></p><p style={{ margin: 0 }}>Distancia máx: <strong style={{ color: '#333333' }}>{rule.maxDistance}</strong></p></>;
    case 'keep-segment-together':
      return <><p style={{ margin: 0 }}>Segmento: <strong style={{ color: '#333333' }}>{rule.segment}</strong></p>{rule.zoneId && <p style={{ margin: 0 }}>Zona: <strong style={{ color: '#333333' }}>{rule.zoneId}</strong></p>}</>;
    case 'zone-restriction':
      return (
        <>
          <p style={{ margin: 0 }}>Objetivo: <strong style={{ color: '#333333' }}>{rule.targetType}</strong> — <strong style={{ color: '#333333' }}>{rule.targetValue}</strong></p>
          {rule.allowedZoneIds.length > 0 && <p style={{ margin: 0 }}>Permitidas: <strong style={{ color: '#333333' }}>{rule.allowedZoneIds.join(', ')}</strong></p>}
          {rule.forbiddenZoneIds && rule.forbiddenZoneIds.length > 0 && <p style={{ margin: 0 }}>Prohibidas: <strong style={{ color: '#333333' }}>{rule.forbiddenZoneIds.join(', ')}</strong></p>}
        </>
      );
    case 'team-separation':
      return <><p style={{ margin: 0 }}>Equipos: <strong style={{ color: '#333333' }}>{rule.team1}</strong> y <strong style={{ color: '#333333' }}>{rule.team2}</strong></p><p style={{ margin: 0 }}>Distancia mín: <strong style={{ color: '#333333' }}>{rule.minDistance}</strong></p></>;
    case 'manual-assignment':
      return <><p style={{ margin: 0 }}>Agente: <strong style={{ color: '#333333' }}>{rule.agentId}</strong></p><p style={{ margin: 0 }}>Box: <strong style={{ color: '#333333' }}>{rule.boxId}</strong></p></>;
    default:
      return null;
  }
}

function getRuleTypeLabel(type: Rule['type']): string {
  const labels: Record<Rule['type'], string> = {
    'fix-leader': 'Fijar Líder',
    'near-leader': 'Cerca del Líder',
    'keep-segment-together': 'Segmento Unido',
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

  const [leaderName, setLeaderName] = useState(leaders[0] || '');
  const [boxNumber, setBoxNumber] = useState('1');
  const [maxDistance, setMaxDistance] = useState('3');

  const [segment, setSegment] = useState(segments[0] || '');
  const [zoneId, setZoneId] = useState('');

  const [targetType, setTargetType] = useState<'team' | 'segment' | 'leader'>('segment');
  const [targetValue, setTargetValue] = useState(segments[0] || '');
  const [allowedZoneIds, setAllowedZoneIds] = useState<string[]>([]);
  const [forbiddenZoneIds, setForbiddenZoneIds] = useState<string[]>([]);

  const [team1, setTeam1] = useState(leaders[0] || '');
  const [team2, setTeam2] = useState(leaders[1] || leaders[0] || '');
  const [minDistance, setMinDistance] = useState('5');

  const [agentId, setAgentId] = useState(agents[0]?.id || '');

  const toggleZoneAllowed = (zId: string) => {
    setAllowedZoneIds((prev) => prev.includes(zId) ? prev.filter((z) => z !== zId) : [...prev, zId]);
    setForbiddenZoneIds((prev) => prev.filter((z) => z !== zId));
  };

  const toggleZoneForbidden = (zId: string) => {
    setForbiddenZoneIds((prev) => prev.includes(zId) ? prev.filter((z) => z !== zId) : [...prev, zId]);
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
      case 'fix-leader':         return { ...base, leaderName, boxId: `box-${boxNumber}` };
      case 'near-leader':        return { ...base, leaderName, maxDistance: parseInt(maxDistance) };
      case 'keep-segment-together': return { ...base, segment, zoneId: zoneId || undefined };
      case 'zone-restriction':   return { ...base, targetType, targetValue, allowedZoneIds, forbiddenZoneIds };
      case 'team-separation':    return { ...base, team1, team2, minDistance: parseInt(minDistance) };
      case 'manual-assignment':  return { ...base, agentId, boxId: `box-${boxNumber}` };
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={() => onCreate(buildRule())}>Crear Regla</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

        {(type === 'fix-leader' || type === 'near-leader') && (
          <Select label="Líder" value={leaderName} onChange={(e) => setLeaderName(e.target.value)}
            options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes —' }]} />
        )}

        {type === 'fix-leader' && (
          <Input label="Número de box" type="number" min="1" value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)} />
        )}

        {type === 'near-leader' && (
          <Input label="Distancia máxima (en boxes)" type="number" min="1" value={maxDistance} onChange={(e) => setMaxDistance(e.target.value)} />
        )}

        {type === 'keep-segment-together' && (
          <>
            <Select label="Segmento" value={segment} onChange={(e) => setSegment(e.target.value)}
              options={segments.length > 0 ? segments.map((s) => ({ value: s, label: s })) : [{ value: '', label: '— Sin segmentos —' }]} />
            <Select label="Zona preferida (opcional)" value={zoneId} onChange={(e) => setZoneId(e.target.value)}
              options={[{ value: '', label: '— Sin zona específica —' }, ...zones.map((z) => ({ value: z.id, label: z.name }))]} />
          </>
        )}

        {type === 'zone-restriction' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Tipo" value={targetType}
                onChange={(e) => {
                  const t = e.target.value as 'team' | 'segment' | 'leader';
                  setTargetType(t);
                  setTargetValue(t === 'segment' ? (segments[0] || '') : (leaders[0] || ''));
                }}
                options={[
                  { value: 'segment', label: 'Segmento' },
                  { value: 'team', label: 'Equipo (líder)' },
                  { value: 'leader', label: 'Líder' },
                ]} />
              <Select label="Valor" value={targetValue} onChange={(e) => setTargetValue(e.target.value)}
                options={targetValues.length > 0 ? targetValues.map((v) => ({ value: v, label: v })) : [{ value: '', label: '— Sin datos —' }]} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#333333', marginBottom: 8 }}>Zonas</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {zones.map((z) => (
                  <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '8px 12px', border: '1px solid #e8e8e8', borderRadius: 8, background: '#fafafa' }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#333333' }}>{z.name}</span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#059669', cursor: 'pointer' }}>
                      <input type="checkbox" checked={allowedZoneIds.includes(z.id)} onChange={() => toggleZoneAllowed(z.id)} />
                      Permitida
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#dc2626', cursor: 'pointer' }}>
                      <input type="checkbox" checked={forbiddenZoneIds.includes(z.id)} onChange={() => toggleZoneForbidden(z.id)} />
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Select label="Equipo 1 (líder)" value={team1} onChange={(e) => setTeam1(e.target.value)}
                options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes —' }]} />
              <Select label="Equipo 2 (líder)" value={team2} onChange={(e) => setTeam2(e.target.value)}
                options={leaders.length > 0 ? leaders.map((l) => ({ value: l, label: l })) : [{ value: '', label: '— Sin líderes —' }]} />
            </div>
            <Input label="Distancia mínima (en boxes)" type="number" min="1" value={minDistance} onChange={(e) => setMinDistance(e.target.value)} />
          </>
        )}

        {type === 'manual-assignment' && (
          <>
            <Select label="Agente" value={agentId} onChange={(e) => setAgentId(e.target.value)}
              options={agents.length > 0 ? agents.map((a) => ({ value: a.id, label: `${a.nombre} (${a.usuario})` })) : [{ value: '', label: '— Sin agentes —' }]} />
            <Input label="Número de box" type="number" min="1" value={boxNumber} onChange={(e) => setBoxNumber(e.target.value)} />
          </>
        )}

        <Input
          label="Descripción"
          value={description}
          placeholder={getAutoDescription()}
          onChange={(e) => setDescription(e.target.value)}
          helperText="Dejar vacío para descripción automática"
        />
      </div>
    </Modal>
  );
}
