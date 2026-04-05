import { useMemo, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useStore } from '../../store';
import { BoxCard } from './BoxCard';
import { BoxDetailModal } from './BoxDetailModal';
import { ZoomIn, ZoomOut, RotateCcw, Download, ChevronDown, X } from 'lucide-react';
import { leaderNamesMatch } from '../../lib/assignment/leaderUtils';
import { timeToMinutes } from '../../lib/utils/timeParser';
import type { Box, BoxOccupation, ShiftType } from '../../types';

const SHIFT_WINDOWS: Record<string, { label: string; start: number; end: number }> = {
  morning:   { label: 'Mañana',   start: 360, end: 660  },  // 06:00–11:00
  midday:    { label: 'Mediodía', start: 720, end: 780  },  // 12:00–13:00
  afternoon: { label: 'Tarde',    start: 840, end: 1440 },  // 14:00–00:00
};

const AISLE_ROWS = new Set([2, 4, 7, 10]);
const CELL_W = 130;
const CELL_H = 110;
const AISLE_H = 24;
const GAP = 4;

type DisplayBox = Box & { shiftOccupant?: BoxOccupation };

// Neon zone colors — LID cells background
const DARK_ZONE_COLORS: Record<string, string> = {
  'LID 1': 'rgba(0,212,255,0.12)',
  'LID 2': 'rgba(0,255,136,0.12)',
  'LID 3': 'rgba(255,204,0,0.12)',
  'LID 4': 'rgba(191,0,255,0.12)',
  'LID 5': 'rgba(255,0,153,0.12)',
  'LID 6': 'rgba(255,102,0,0.12)',
  'LID 7': 'rgba(0,255,255,0.12)',
};

// Accent neon colors — matching BoxCard
const ZONE_ACCENT_COLORS: Record<string, string> = {
  'LID 1': '#00d4ff',
  'LID 2': '#00ff88',
  'LID 3': '#ffcc00',
  'LID 4': '#bf00ff',
  'LID 5': '#ff0099',
  'LID 6': '#ff6600',
  'LID 7': '#00ffff',
};

const ZONE_BOX_RANGES: Record<string, string> = {
  'LID 1': 'Boxes 1–29',
  'LID 2': 'Boxes 30–43',
  'LID 3': 'Boxes 44–55',
  'LID 4': 'Boxes 56–68',
  'LID 5': 'Boxes 69–74',
  'LID 6': 'Boxes 75–81',
  'LID 7': 'Boxes 82–91',
};

function getDarkZoneColor(zone: string) {
  return DARK_ZONE_COLORS[zone] || 'rgba(30,41,59,0.5)';
}

function occOverlapsWindow(occ: BoxOccupation, wStart: number, wEnd: number) {
  const s = timeToMinutes(occ.entryTime);
  let e = timeToMinutes(occ.exitTime);
  if (e === 0 || e < s) e = 1440;
  return s < wEnd && e > wStart;
}

export function LayoutView() {
  const { layout, agents, leaders, assignments, leaderAssignments, ui, config, setZoom, selectBox, assignAgentToBox, setConfig, toggleBoxActive } = useStore();

  const selectedShift = ui.selectedShift as string;
  const shiftWindow   = SHIFT_WINDOWS[selectedShift] ?? SHIFT_WINDOWS['morning'];
  const zoom          = ui.zoom;

  // Build map of which leader occupies each LID position
  const leaderForLid = useMemo(() => {
    const lidMap: Record<string, string> = {};
    Object.entries(config.leaderBoxAssignments || {}).forEach(([lid, leader]) => {
      if (!leader) return;
      const leaderIsActiveInShift = agents.some((agent) => {
        if (!leaderNamesMatch(agent.nombre, leader)) return false;
        return occOverlapsWindow(
          { agentId: agent.id, agentName: agent.nombre, entryTime: agent.entryTime, exitTime: agent.exitTime, leader: '', segment: '' },
          shiftWindow.start,
          shiftWindow.end
        );
      });
      if (!leaderIsActiveInShift) return;
      lidMap[lid] = leader;
    });
    return lidMap;
  }, [agents, config.leaderBoxAssignments, selectedShift, shiftWindow]);

  const gridRef      = useRef<HTMLDivElement>(null);
  const [selectedLeader, setSelectedLeader] = useState('');
  const [leaderMode, setLeaderMode]         = useState<'highlight' | 'exclude'>('highlight');
  const [leaderOpen, setLeaderOpen]         = useState(false);
  const [exporting, setExporting]           = useState(false);

  const leaderNames = useMemo(() => {
    const s = new Set<string>();
    agents.forEach((a) => { if (a.superior) s.add(a.superior); if (a.jefe) s.add(a.jefe); });
    return Array.from(s).sort();
  }, [agents]);

  const allCells = useMemo(() => {
    const cells = layout.boxes.map((box) => ({
      ...box,
      occupations: [] as BoxOccupation[],
      nextOccupant: undefined as BoxOccupation | undefined,
    }));

    // Regular agent occupations
    assignments.forEach((boxId, agentId) => {
      const agent = agents.find((a) => a.id === agentId);
      const cell  = cells.find((b) => b.id === boxId);
      if (agent && cell) {
        const leader = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
        cell.occupations.push({
          agentId: agent.id, agentName: agent.nombre,
          entryTime: agent.entryTime, exitTime: agent.exitTime,
          leader,
          segment: agent.segmento,
          leaderField: config.leaderField,
          rawLeaderJefe: agent.jefe,
          rawLeaderSuperior: agent.superior,
        });
      }
    });

    // Leader occupations on LID cells
    leaderAssignments.forEach((boxId, leaderId) => {
      const leader = leaders.find((l) => l.id === leaderId);
      const cell   = cells.find((b) => b.id === boxId);
      if (leader && cell) {
        cell.occupations.push({
          agentId: leader.id, agentName: leader.nombre,
          entryTime: leader.entryTime, exitTime: leader.exitTime,
          leader: '', segment: '',
        });
      }
    });

    cells.forEach((c) => {
      if (!c.occupations.length) return;
      c.occupations.sort((a, b) => timeToMinutes(a.entryTime) - timeToMinutes(b.entryTime));
    });
    return cells;
  }, [layout.boxes, agents, leaders, assignments, leaderAssignments, config.leaderField]);

  const displayCells = useMemo(() => allCells.map((cell) => {
    if (cell.type !== 'box' && cell.type !== 'lid') {
      return { ...cell, shiftOccupant: undefined as BoxOccupation | undefined };
    }
    const shiftOccupant = cell.occupations.find((o) => occOverlapsWindow(o, shiftWindow.start, shiftWindow.end));
    const nextOccupant = !shiftOccupant
      ? (cell.occupations.find((o) => timeToMinutes(o.entryTime) >= shiftWindow.end) ?? cell.occupations[0])
      : undefined;
    return { ...cell, shiftOccupant, nextOccupant };
  }), [allCells, selectedShift, shiftWindow]);

  // Get all agent IDs that belong to the selected leader's team (for exclude mode)
  const excludedAgentIds = useMemo(() => {
    if (!selectedLeader || leaderMode !== 'exclude') return new Set<string>();
    const excludedIds = new Set<string>();
    agents.forEach((agent) => {
      const agentLeader = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
      if (agentLeader === selectedLeader) {
        excludedIds.add(agent.id);
      }
    });
    return excludedIds;
  }, [agents, selectedLeader, leaderMode, config.leaderField]);

  const totalBoxes      = displayCells.filter((c) => c.type === 'box' && c.activo).length;
  const occupiedInShift = displayCells.filter((c) => {
    if (c.type !== 'box') return false;
    const occ = (c as DisplayBox).shiftOccupant;
    if (!occ) return false;
    // Don't count if the occupant is in the excluded team
    return !excludedAgentIds.has(occ.agentId);
  }).length;

  // Count boxes occupied by excluded team (for display)
  const excludedTeamBoxes = selectedLeader && leaderMode === 'exclude'
    ? displayCells.filter((c) => {
        if (c.type !== 'box') return false;
        const occ = (c as DisplayBox).shiftOccupant;
        return occ && excludedAgentIds.has(occ.agentId);
      }).length
    : 0;

  const selectedBox = useMemo(
    () => ui.selectedBoxId ? (allCells.find((b) => b.id === ui.selectedBoxId) ?? null) : null,
    [ui.selectedBoxId, allCells],
  );

  const handleExport = async () => {
    if (!gridRef.current) return;
    setExporting(true);
    try {
      const el = gridRef.current;
      const prevTransform = el.style.transform;
      el.style.transform = 'scale(1)';
      el.style.transformOrigin = 'top left';
      const canvas = await html2canvas(el, { backgroundColor: '#0f172a', scale: 2, useCORS: true });
      el.style.transform = prevTransform;
      const link = document.createElement('a');
      const suffix = selectedLeader ? `-${selectedLeader.replace(/\s+/g, '_')}` : '';
      link.download = `layout${suffix}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const cols = layout.columns;
  const rows = layout.rows;
  const naturalW = cols * CELL_W + (cols - 1) * GAP;
  const naturalH = Array.from({ length: rows }, (_, i) =>
    AISLE_ROWS.has(i + 1) ? AISLE_H : CELL_H
  ).reduce((a, b) => a + b, 0) + (rows - 1) * GAP;

  const gridTemplateColumns = `repeat(${cols}, ${CELL_W}px)`;
  const gridTemplateRows    = Array.from({ length: rows }, (_, i) =>
    AISLE_ROWS.has(i + 1) ? `${AISLE_H}px` : `${CELL_H}px`
  ).join(' ');

  return (
    <div className="h-full flex flex-col" style={{ background: '#050816' }}>

      {/* ── Toolbar ── */}
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0"
        style={{
          background: 'linear-gradient(180deg, #0a0f2e 0%, #050816 100%)',
          borderBottom: '1px solid rgba(0,212,255,0.15)',
        }}
      >

        {/* Counters */}
        <div className="flex items-center gap-2 mr-2">
          <div className="text-right leading-none">
            <span className="text-xl font-black tabular-nums" style={{ color: '#00d4ff', textShadow: '0 0 12px rgba(0,212,255,0.6)' }}>
              {occupiedInShift}
            </span>
            <span className="text-sm font-bold" style={{ color: 'rgba(0,212,255,0.35)' }}>/{totalBoxes}</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-widest leading-tight" style={{ color: 'rgba(100,116,139,0.6)' }}>
            boxes<br/>ocupados
          </span>
          {excludedTeamBoxes > 0 && (
            <span className="text-[9px] font-bold" style={{ color: '#ff0099' }}>
              ({excludedTeamBoxes} excl.)
            </span>
          )}
        </div>

        <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.15)' }} />

        {/* Shift pills */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
          {Object.entries(SHIFT_WINDOWS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => useStore.getState().setUiState({ selectedShift: key as ShiftType | 'all' })}
              className="px-3 py-1 rounded-md text-xs font-bold transition-all"
              style={selectedShift === key ? {
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))',
                border: '1px solid rgba(0,212,255,0.5)',
                color: '#00d4ff',
                boxShadow: '0 0 10px rgba(0,212,255,0.2)',
              } : {
                color: 'rgba(100,116,139,0.7)',
                border: '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.15)' }} />

        {/* Leader filter */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setLeaderOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={selectedLeader && leaderMode === 'highlight' ? {
              background: 'rgba(255,204,0,0.1)', border: '1px solid rgba(255,204,0,0.4)', color: '#ffcc00',
            } : selectedLeader && leaderMode === 'exclude' ? {
              background: 'rgba(255,0,153,0.1)', border: '1px solid rgba(255,0,153,0.4)', color: '#ff0099',
            } : {
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(148,163,184,0.7)',
            }}
          >
            <span className="max-w-[160px] truncate">
              {selectedLeader
                ? (leaderMode === 'exclude' ? `Vista sin: ${selectedLeader.split(' ')[0]}` : selectedLeader)
                : 'Filtrar por líder'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
          {selectedLeader && (
            <button
              onClick={() => { setSelectedLeader(''); }}
              className="p-1 rounded-md text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
              title="Limpiar filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {leaderOpen && (
            <div className="absolute left-0 top-full mt-1 w-72 rounded-xl shadow-2xl z-50 overflow-hidden"
              style={{ background: '#0a0f2e', border: '1px solid rgba(0,212,255,0.2)', boxShadow: '0 0 30px rgba(0,212,255,0.1)' }}
            >
              {/* Mode toggle */}
              <div className="p-2" style={{ borderBottom: '1px solid rgba(0,212,255,0.1)' }}>
                <p className="text-[9px] font-bold uppercase tracking-widest mb-1.5 px-1" style={{ color: 'rgba(0,212,255,0.4)' }}>Modo de filtro</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLeaderMode('highlight')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={leaderMode === 'highlight' ? {
                      background: 'rgba(255,204,0,0.15)', border: '1px solid rgba(255,204,0,0.4)', color: '#ffcc00',
                    } : { color: 'rgba(100,116,139,0.6)', border: '1px solid transparent' }}
                  >Resaltar</button>
                  <button
                    onClick={() => setLeaderMode('exclude')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all"
                    style={leaderMode === 'exclude' ? {
                      background: 'rgba(255,0,153,0.15)', border: '1px solid rgba(255,0,153,0.4)', color: '#ff0099',
                    } : { color: 'rgba(100,116,139,0.6)', border: '1px solid transparent' }}
                  >Excluir</button>
                </div>
              </div>

              {/* Leader list */}
              <div className="p-1 max-h-64 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all"
                  style={!selectedLeader ? {
                    background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff',
                  } : { color: 'rgba(148,163,184,0.7)' }}
                  onClick={() => { setSelectedLeader(''); setLeaderOpen(false); }}
                >
                  Todos los líderes
                </button>
                {leaderNames.map((l) => (
                  <button
                    key={l}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between"
                    style={selectedLeader === l ? {
                      background: leaderMode === 'exclude' ? 'rgba(255,0,153,0.15)' : 'rgba(255,204,0,0.15)',
                      color: leaderMode === 'exclude' ? '#ff0099' : '#ffcc00',
                      border: `1px solid ${leaderMode === 'exclude' ? 'rgba(255,0,153,0.3)' : 'rgba(255,204,0,0.3)'}`,
                    } : { color: 'rgba(148,163,184,0.7)', border: '1px solid transparent' }}
                    onClick={() => { setSelectedLeader(l); setLeaderOpen(false); }}
                  >
                    <span>{l}</span>
                    {selectedLeader === l && (
                      <span className="text-[8px] font-black uppercase tracking-widest ml-2 opacity-80">
                        {leaderMode === 'exclude' ? 'excl.' : 'activo'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5" style={{ background: 'rgba(0,212,255,0.15)' }} />

        {/* Leader Field Quick Toggle */}
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.1)' }}>
          {(['superior', 'jefe'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setConfig({ leaderField: f })}
              className="px-3 py-1 rounded-md text-xs font-bold transition-all capitalize"
              style={config.leaderField === f ? {
                background: 'linear-gradient(135deg, rgba(191,0,255,0.2), rgba(0,212,255,0.2))',
                border: '1px solid rgba(191,0,255,0.5)',
                color: '#bf00ff',
                boxShadow: '0 0 8px rgba(191,0,255,0.2)',
              } : { color: 'rgba(100,116,139,0.6)', border: '1px solid transparent' }}
            >
              {f === 'superior' ? 'Super' : 'Jefe'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          {[
            { icon: <ZoomOut className="w-3.5 h-3.5" />, action: () => setZoom(Math.max(0.4, zoom - 0.1)) },
            { icon: <ZoomIn  className="w-3.5 h-3.5" />, action: () => setZoom(Math.min(2, zoom + 0.1)) },
            { icon: <RotateCcw className="w-3.5 h-3.5" />, action: () => setZoom(1) },
          ].map((btn, i) => (
            <button key={i} onClick={btn.action}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(100,116,139,0.6)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#00d4ff'; e.currentTarget.style.background = 'rgba(0,212,255,0.08)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(100,116,139,0.6)'; e.currentTarget.style.background = 'transparent'; }}
            >
              {btn.icon}
            </button>
          ))}
          <span className="text-[10px] font-black tabular-nums w-9 text-center" style={{ color: 'rgba(0,212,255,0.5)' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all disabled:opacity-40"
          style={{
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(124,58,237,0.2))',
            border: '1px solid rgba(0,212,255,0.4)',
            color: '#00d4ff',
            boxShadow: '0 0 12px rgba(0,212,255,0.15)',
          }}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportando…' : selectedLeader ? `Export — ${selectedLeader.split(' ')[0]}` : 'Exportar'}
        </button>
      </div>

      {/* ── Leader banner ── */}
      {selectedLeader && (
        <div className="px-5 py-1.5 flex items-center gap-3"
          style={{
            background: leaderMode === 'exclude' ? 'rgba(255,0,153,0.08)' : 'rgba(255,204,0,0.08)',
            borderBottom: `1px solid ${leaderMode === 'exclude' ? 'rgba(255,0,153,0.2)' : 'rgba(255,204,0,0.2)'}`,
          }}
        >
          <div className="w-1.5 h-1.5 rounded-full animate-glow-pulse"
            style={{ background: leaderMode === 'exclude' ? '#ff0099' : '#ffcc00', boxShadow: `0 0 6px ${leaderMode === 'exclude' ? '#ff0099' : '#ffcc00'}` }}
          />
          <span className="text-xs font-bold" style={{ color: leaderMode === 'exclude' ? '#ff0099' : '#ffcc00' }}>
            {leaderMode === 'exclude'
              ? <>Vista sin equipo: <strong>{selectedLeader}</strong> — {excludedAgentIds.size} agentes filtrados</>
              : <>Equipo: <strong>{selectedLeader}</strong></>
            }
          </span>
          <button onClick={() => setSelectedLeader('')}
            className="ml-auto text-[10px] font-bold uppercase tracking-widest transition-all"
            style={{ color: 'rgba(100,116,139,0.5)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#00d4ff'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(100,116,139,0.5)'; }}
          >
            limpiar ×
          </button>
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="flex-1 overflow-auto">
        <div
          style={{
            width: naturalW * zoom + 32,
            height: naturalH * zoom + 32,
            minWidth: '100%',
            minHeight: '100%',
            padding: 16,
            boxSizing: 'border-box',
          }}
        >
          <div
            ref={gridRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: naturalW,
              background: 'linear-gradient(135deg, #050816 0%, #080d1e 100%)',
              borderRadius: 16,
              padding: 16,
              border: '1px solid rgba(0,212,255,0.08)',
            }}
          >
            {/* Header info for export */}
            {selectedLeader && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: leaderMode === 'exclude' ? '#ff0099' : '#ffcc00', textShadow: leaderMode === 'exclude' ? '0 0 10px #ff009966' : '0 0 10px #ffcc0066' }}>
                  {leaderMode === 'exclude' ? `Vista sin equipo: ${selectedLeader}` : `Equipo: ${selectedLeader}`}
                </span>
                <span style={{ fontSize: 10, color: 'rgba(0,212,255,0.4)', fontWeight: 700, letterSpacing: '0.1em' }}>
                  {SHIFT_WINDOWS[selectedShift]?.label ?? ''}
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns, gridTemplateRows, gap: GAP }}>
              {displayCells.map((cell) => {

                /* Horizontal PASILLO */
                if (cell.type === 'aisle' && cell.columna === 1) {
                  return (
                    <div
                      key={cell.id}
                      style={{
                        gridRow: cell.fila,
                        gridColumn: `1 / span ${cols}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        backgroundColor: '#080d18',
                        borderRadius: 6,
                        border: '1px solid #1e293b',
                        padding: '0 12px',
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(90deg, #1e293b 0, #1e293b 6px, transparent 6px, transparent 12px)' }} />
                      <span style={{ fontSize: 8, color: '#334155', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        ← PASILLO →
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(90deg, #1e293b 0, #1e293b 6px, transparent 6px, transparent 12px)' }} />
                    </div>
                  );
                }

                /* Vertical gap */
                if (cell.type === 'aisle') {
                  return <div key={cell.id} style={{ gridRow: cell.fila, gridColumn: cell.columna }} />;
                }

                /* LID cell — leader's physical seat */
                if (cell.type === 'lid') {
                  const neonColor = ZONE_ACCENT_COLORS[cell.label] ?? '#00d4ff';
                  const bgColor   = getDarkZoneColor(cell.label);
                  const isSelected = ui.selectedBoxId === cell.id;
                  const lidOcc = (cell as DisplayBox).shiftOccupant;
                  const shiftOccupations = cell.occupations.filter((o) => occOverlapsWindow(o, shiftWindow.start, shiftWindow.end));
                  const multipleLeaders = shiftOccupations.length > 1;
                  return (
                    <div
                      key={cell.id}
                      onClick={() => selectBox(ui.selectedBoxId === cell.id ? undefined : cell.id)}
                      style={{
                        gridRow: cell.fila, gridColumn: cell.columna,
                        height: CELL_H,
                        background: `linear-gradient(135deg, ${bgColor}, rgba(5,8,22,0.9))`,
                        borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative',
                        border: `1px solid ${isSelected ? neonColor : `${neonColor}44`}`,
                        borderLeft: `3px solid ${neonColor}`,
                        boxShadow: isSelected
                          ? `0 0 20px ${neonColor}66, inset 0 0 15px rgba(0,0,0,0.5)`
                          : `0 0 10px ${neonColor}22`,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 900, color: neonColor, letterSpacing: '0.1em', textTransform: 'uppercase', textShadow: `0 0 8px ${neonColor}` }}>
                        {cell.label}
                      </span>
                      {lidOcc ? (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginTop: 3, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center', textShadow: '0 0 6px rgba(251,191,36,0.6)' }}>
                          {lidOcc.agentName.split(' ')[0]}
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, color: `${neonColor}44`, marginTop: 3, fontWeight: 700, letterSpacing: '0.1em' }}>LIBRE</span>
                      )}
                      {multipleLeaders && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          minWidth: 14, height: 14,
                          background: neonColor, color: '#050816',
                          fontSize: 8, fontWeight: 900,
                          borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                          boxShadow: `0 0 8px ${neonColor}`,
                        }}>
                          {shiftOccupations.length}
                        </div>
                      )}
                    </div>
                  );
                }

                /* Box */
                const isSelected = ui.selectedBoxId === cell.id;
                const rawOcc     = (cell as DisplayBox).shiftOccupant;
                const nextOcc    = cell.nextOccupant;

                // In exclude mode: treat as excluded if agent belongs to selected leader's team
                const isExcluded = !!selectedLeader && leaderMode === 'exclude'
                  && !!rawOcc && excludedAgentIds.has(rawOcc.agentId);
                const shiftOcc   = isExcluded ? undefined : rawOcc;

                const shiftOccupationCount = cell.occupations.filter(
                  (o) => occOverlapsWindow(o, shiftWindow.start, shiftWindow.end)
                ).length;

                const isLeader      = !!shiftOcc && leaderNames.includes(shiftOcc.agentName);
                const isDimmed      = leaderMode === 'highlight' && !!selectedLeader && !!shiftOcc && shiftOcc.leader !== selectedLeader;
                const isHighlighted = leaderMode === 'highlight' && !!selectedLeader && !!shiftOcc && shiftOcc.leader === selectedLeader;

                return (
                  <div key={cell.id} style={{ gridRow: cell.fila, gridColumn: cell.columna, height: CELL_H }}>
                    <BoxCard
                      box={{ ...cell, nextOccupant: isExcluded ? undefined : nextOcc }}
                      isSelected={isSelected}
                      isHighlighted={isHighlighted}
                      isDimmed={isDimmed}
                      isLeader={isLeader}
                      shiftOccupant={shiftOcc}
                      shiftOccupationCount={shiftOccupationCount}
                      onClick={() => selectBox(ui.selectedBoxId === cell.id ? undefined : cell.id)}
                    />
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(0,212,255,0.08)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {layout.zones.map((zone) => {
                  const accent = ZONE_ACCENT_COLORS[zone.name] ?? '#475569';
                  const range  = ZONE_BOX_RANGES[zone.name] ?? '';
                  return (
                    <div key={zone.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${accent}0d`,
                      border: `1px solid ${accent}30`,
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: 6, padding: '3px 8px',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, color: accent, fontWeight: 900, lineHeight: 1, letterSpacing: '0.05em', textShadow: `0 0 6px ${accent}66` }}>{zone.name}</div>
                        <div style={{ fontSize: 7, color: `${accent}55`, fontWeight: 600, marginTop: 2 }}>{range}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.3)',
                  borderLeft: '3px solid #fbbf24', borderRadius: 6, padding: '3px 8px',
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 900, lineHeight: 1, textShadow: '0 0 6px rgba(251,191,36,0.6)' }}>LÍD</div>
                    <div style={{ fontSize: 7, color: 'rgba(251,191,36,0.4)', fontWeight: 600, marginTop: 2 }}>Jefe equipo</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedBox && (
        <BoxDetailModal
          box={selectedBox}
          agents={agents}
          onClose={() => selectBox(undefined)}
          onAssignAgent={(agentId, boxId) => { assignAgentToBox(agentId, boxId); selectBox(undefined); }}
          onToggleActive={(boxId) => toggleBoxActive(boxId)}
        />
      )}
    </div>
  );
}
