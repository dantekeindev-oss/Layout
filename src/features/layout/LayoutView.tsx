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

// LID cell backgrounds — subtle tint
const DARK_ZONE_COLORS: Record<string, string> = {
  'LID 1': 'rgba(96,165,250,0.08)',
  'LID 2': 'rgba(52,211,153,0.08)',
  'LID 3': 'rgba(251,191,36,0.08)',
  'LID 4': 'rgba(167,139,250,0.08)',
  'LID 5': 'rgba(244,114,182,0.08)',
  'LID 6': 'rgba(251,146,60,0.08)',
  'LID 7': 'rgba(103,232,249,0.08)',
};

// Professional SaaS accent colors — matching BoxCard
const ZONE_ACCENT_COLORS: Record<string, string> = {
  'LID 1': '#60a5fa',
  'LID 2': '#34d399',
  'LID 3': '#fbbf24',
  'LID 4': '#a78bfa',
  'LID 5': '#f472b6',
  'LID 6': '#fb923c',
  'LID 7': '#67e8f9',
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
  return DARK_ZONE_COLORS[zone] || 'rgba(17,17,24,0.8)';
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
    <div className="h-full flex flex-col" style={{ background: '#0a0a0f' }}>

      {/* ── Toolbar ── */}
      <div className="px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0"
        style={{ background: '#111118', borderBottom: '1px solid #1e1e2e' }}
      >

        {/* Counters */}
        <div className="flex items-center gap-2 mr-2">
          <div className="text-right leading-none">
            <span className="text-xl font-bold tabular-nums text-white">{occupiedInShift}</span>
            <span className="text-sm font-medium text-slate-600">/{totalBoxes}</span>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wider leading-tight text-slate-600">
            boxes<br/>ocupados
          </span>
          {excludedTeamBoxes > 0 && (
            <span className="text-[9px] font-medium text-red-400">({excludedTeamBoxes} excl.)</span>
          )}
        </div>

        <div className="w-px h-5 bg-slate-800" />

        {/* Shift pills */}
        <div className="flex items-center gap-0.5 rounded-lg p-1 bg-slate-900 border border-slate-800">
          {Object.entries(SHIFT_WINDOWS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => useStore.getState().setUiState({ selectedShift: key as ShiftType | 'all' })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedShift === key
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-slate-800" />

        {/* Leader filter */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setLeaderOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedLeader && leaderMode === 'highlight'
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : selectedLeader && leaderMode === 'exclude'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
            }`}
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
            <div className="absolute left-0 top-full mt-1 w-72 rounded-xl shadow-2xl z-50 overflow-hidden bg-slate-900 border border-slate-800">
              {/* Mode toggle */}
              <div className="p-2 border-b border-slate-800">
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5 px-1 text-slate-600">Modo de filtro</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLeaderMode('highlight')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      leaderMode === 'highlight'
                        ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                        : 'text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >Resaltar equipo</button>
                  <button
                    onClick={() => setLeaderMode('exclude')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      leaderMode === 'exclude'
                        ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                        : 'text-slate-500 border border-transparent hover:text-slate-300'
                    }`}
                  >Excluir en vista</button>
                </div>
              </div>
              {/* Leader list */}
              <div className="p-1 max-h-64 overflow-y-auto">
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    !selectedLeader ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-600/25' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                  onClick={() => { setSelectedLeader(''); setLeaderOpen(false); }}
                >Todos los líderes</button>
                {leaderNames.map((l) => (
                  <button
                    key={l}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between ${
                      selectedLeader === l
                        ? leaderMode === 'exclude' ? 'bg-red-500/10 text-red-400 border border-red-500/25' : 'bg-amber-500/10 text-amber-300 border border-amber-500/25'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`}
                    onClick={() => { setSelectedLeader(l); setLeaderOpen(false); }}
                  >
                    <span>{l}</span>
                    {selectedLeader === l && (
                      <span className="text-[8px] font-semibold uppercase tracking-wide ml-2 opacity-70">
                        {leaderMode === 'exclude' ? 'excl.' : 'activo'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-slate-800" />

        {/* Leader Field Quick Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg p-1 bg-slate-900 border border-slate-800">
          {(['superior', 'jefe'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setConfig({ leaderField: f })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                config.leaderField === f
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-600/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {f === 'superior' ? 'Super' : 'Jefe'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-all">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-semibold tabular-nums w-9 text-center text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-all">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition-all">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 transition-all shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportando…' : selectedLeader ? `Exportar — ${selectedLeader.split(' ')[0]}` : 'Exportar imagen'}
        </button>
      </div>

      {/* ── Leader banner ── */}
      {selectedLeader && (
        <div className={`px-5 py-1.5 flex items-center gap-3 border-b ${
          leaderMode === 'exclude' ? 'bg-red-500/5 border-red-500/15' : 'bg-amber-500/5 border-amber-500/15'
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${leaderMode === 'exclude' ? 'bg-red-400' : 'bg-amber-400'}`} />
          <span className={`text-xs font-medium ${leaderMode === 'exclude' ? 'text-red-400' : 'text-amber-300'}`}>
            {leaderMode === 'exclude'
              ? <>Vista sin equipo: <strong>{selectedLeader}</strong> — {excludedAgentIds.size} agentes filtrados</>
              : <>Resaltando equipo de <strong>{selectedLeader}</strong></>
            }
          </span>
          <button onClick={() => setSelectedLeader('')}
            className="ml-auto text-xs text-slate-600 hover:text-slate-300 transition-colors"
          >
            Limpiar ×
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
              background: '#0d0d14',
              borderRadius: 16,
              padding: 16,
              border: '1px solid #1e1e2e',
            }}
          >
            {/* Header info for export */}
            {selectedLeader && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #1e1e2e', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: leaderMode === 'exclude' ? '#f87171' : '#fbbf24' }}>
                  {leaderMode === 'exclude' ? `Vista sin equipo: ${selectedLeader}` : `Equipo: ${selectedLeader}`}
                </span>
                <span style={{ fontSize: 10, color: '#475569', fontWeight: 500 }}>
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
                        background: '#080810',
                        borderRadius: 6,
                        border: '1px solid #1e1e2e',
                        padding: '0 12px',
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(90deg, #1e1e2e 0, #1e1e2e 6px, transparent 6px, transparent 12px)' }} />
                      <span style={{ fontSize: 8, color: '#2a2a3e', fontWeight: 600, letterSpacing: '0.25em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        pasillo
                      </span>
                      <div style={{ flex: 1, height: 1, background: 'repeating-linear-gradient(90deg, #1e1e2e 0, #1e1e2e 6px, transparent 6px, transparent 12px)' }} />
                    </div>
                  );
                }

                /* Vertical gap */
                if (cell.type === 'aisle') {
                  return <div key={cell.id} style={{ gridRow: cell.fila, gridColumn: cell.columna }} />;
                }

                /* LID cell — leader's physical seat */
                if (cell.type === 'lid') {
                  const accent     = ZONE_ACCENT_COLORS[cell.label] ?? '#60a5fa';
                  const bgColor    = getDarkZoneColor(cell.label);
                  const isSelected = ui.selectedBoxId === cell.id;
                  const lidOcc     = (cell as DisplayBox).shiftOccupant;
                  const shiftOccupations = cell.occupations.filter((o) => occOverlapsWindow(o, shiftWindow.start, shiftWindow.end));
                  const multipleLeaders = shiftOccupations.length > 1;
                  return (
                    <div
                      key={cell.id}
                      onClick={() => selectBox(ui.selectedBoxId === cell.id ? undefined : cell.id)}
                      style={{
                        gridRow: cell.fila, gridColumn: cell.columna,
                        height: CELL_H,
                        background: bgColor,
                        borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative',
                        border: `1px solid ${isSelected ? '#6366f1' : `${accent}30`}`,
                        borderLeft: `3px solid ${accent}`,
                        boxShadow: isSelected ? '0 0 0 1px rgba(99,102,241,0.3), 0 4px 12px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.3)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {cell.label}
                      </span>
                      {lidOcc ? (
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#fbbf24', marginTop: 3, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {lidOcc.agentName.split(' ')[0]}
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, color: `${accent}40`, marginTop: 3, fontWeight: 500 }}>Libre</span>
                      )}
                      {multipleLeaders && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          minWidth: 14, height: 14,
                          background: accent, color: '#0a0a0f',
                          fontSize: 8, fontWeight: 700,
                          borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
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
            <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e1e2e' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {layout.zones.map((zone) => {
                  const accent = ZONE_ACCENT_COLORS[zone.name] ?? '#64748b';
                  const range  = ZONE_BOX_RANGES[zone.name] ?? '';
                  return (
                    <div key={zone.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${accent}0d`,
                      border: `1px solid ${accent}25`,
                      borderLeft: `3px solid ${accent}`,
                      borderRadius: 6, padding: '3px 8px',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, color: accent, fontWeight: 700, lineHeight: 1 }}>{zone.name}</div>
                        <div style={{ fontSize: 7, color: '#334155', fontWeight: 500, marginTop: 2 }}>{range}</div>
                      </div>
                    </div>
                  );
                })}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)',
                  borderLeft: '3px solid #fbbf24', borderRadius: 6, padding: '3px 8px',
                }}>
                  <div>
                    <div style={{ fontSize: 9, color: '#fbbf24', fontWeight: 700, lineHeight: 1 }}>Líder</div>
                    <div style={{ fontSize: 7, color: '#334155', fontWeight: 500, marginTop: 2 }}>Jefe de equipo</div>
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
