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

// Zone colors adapted to dark theme (more saturated, semi-transparent)
const DARK_ZONE_COLORS: Record<string, string> = {
  'LID 1': '#1e3a5f',
  'LID 2': '#14532d',
  'LID 3': '#713f12',
  'LID 4': '#4a1d96',
  'LID 5': '#831843',
  'LID 6': '#7c2d12',
  'LID 7': '#164e63',
};

function getDarkZoneColor(zone: string) {
  return DARK_ZONE_COLORS[zone] || '#1e293b';
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
  }, [agents, config.leaderBoxAssignments, config.leaderField, selectedShift, shiftWindow]);

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
    <div className="h-full flex flex-col bg-slate-950">

      {/* ── Toolbar ── */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center gap-3 flex-wrap shrink-0">

        {/* Counters */}
        <div className="flex items-center gap-3 mr-2">
          <div className="text-right">
            <span className="text-lg font-bold text-white tabular-nums">{occupiedInShift}</span>
            <span className="text-slate-500 text-sm">/{totalBoxes}</span>
          </div>
          <span className="text-xs text-slate-500 font-medium leading-tight">boxes<br/>ocupados</span>
          {excludedTeamBoxes > 0 && (
            <span className="text-xs text-red-400 font-medium leading-tight">
              ({excludedTeamBoxes} excluidos)
            </span>
          )}
        </div>

        <div className="w-px h-6 bg-slate-700" />

        {/* Shift pills */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {Object.entries(SHIFT_WINDOWS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => useStore.getState().setUiState({ selectedShift: key as ShiftType | 'all' })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                selectedShift === key
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-700" />

        {/* Leader filter */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setLeaderOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              selectedLeader && leaderMode === 'highlight'
                ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                : selectedLeader && leaderMode === 'exclude'
                ? 'bg-red-500/10 border-red-500/50 text-red-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
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
            <div className="absolute left-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
              {/* Mode toggle */}
              <div className="p-2 border-b border-slate-700 bg-slate-900/60">
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1.5 px-1">Modo de filtro</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLeaderMode('highlight')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      leaderMode === 'highlight'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    Resaltar equipo
                  </button>
                  <button
                    onClick={() => setLeaderMode('exclude')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      leaderMode === 'exclude'
                        ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                  >
                    Excluir en vista
                  </button>
                </div>
              </div>

              {/* Leader list */}
              <div className="p-1 max-h-64 overflow-y-auto">
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!selectedLeader ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-700'}`}
                  onClick={() => { setSelectedLeader(''); setLeaderOpen(false); }}
                >
                  Todos los líderes
                </button>
                {leaderNames.map((l) => (
                  <button
                    key={l}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-between ${
                      selectedLeader === l
                        ? leaderMode === 'exclude' ? 'bg-red-600/80 text-white' : 'bg-amber-500/80 text-slate-900'
                        : 'text-slate-300 hover:bg-slate-700'
                    }`}
                    onClick={() => { setSelectedLeader(l); setLeaderOpen(false); }}
                  >
                    <span>{l}</span>
                    {selectedLeader === l && (
                      <span className="text-[9px] font-bold opacity-80 uppercase tracking-wide ml-2">
                        {leaderMode === 'exclude' ? 'ocultando' : 'resaltando'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-700" />

        {/* Leader Field Quick Toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setConfig({ leaderField: 'superior' })}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              config.leaderField === 'superior'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Usar SUPERIOR (Jerarquía superior)"
          >
            Super
          </button>
          <button
            onClick={() => setConfig({ leaderField: 'jefe' })}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              config.leaderField === 'jefe'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Usar JEFE (Reporta directo)"
          >
            Jefe
          </button>
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-slate-400 w-10 text-center tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(Math.min(2, zoom + 0.1))}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
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
        <div className={`border-b px-5 py-2 flex items-center gap-3 ${
          leaderMode === 'exclude'
            ? 'bg-red-500/10 border-red-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          <div className={`w-2 h-2 rounded-full animate-pulse ${leaderMode === 'exclude' ? 'bg-red-400' : 'bg-amber-400'}`} />
          <span className={`text-xs font-semibold ${leaderMode === 'exclude' ? 'text-red-300' : 'text-amber-300'}`}>
            {leaderMode === 'exclude'
              ? <>Vista sin equipo: <strong>{selectedLeader}</strong> — <span className="text-red-400">({excludedAgentIds.size} agentes filtrados)</span></>
              : <>Resaltando equipo de <strong>{selectedLeader}</strong></>
            }
          </span>
          <button
            onClick={() => setSelectedLeader('')}
            className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpiar filtro
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
              backgroundColor: '#0f172a',
              borderRadius: 16,
              padding: 16,
            }}
          >
            {/* Header info for export */}
            {selectedLeader && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #334155' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: leaderMode === 'exclude' ? '#f87171' : '#fbbf24' }}>
                  {leaderMode === 'exclude' ? `Vista sin equipo: ${selectedLeader}` : `Equipo: ${selectedLeader}`}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 12 }}>
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
                      style={{ gridRow: cell.fila, gridColumn: `1 / span ${cols}`, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <div style={{ flex: 1, height: 1, background: '#334155' }} />
                      <span style={{ fontSize: 9, color: '#475569', fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Pasillo</span>
                      <div style={{ flex: 1, height: 1, background: '#334155' }} />
                    </div>
                  );
                }

                /* Vertical gap */
                if (cell.type === 'aisle') {
                  return <div key={cell.id} style={{ gridRow: cell.fila, gridColumn: cell.columna }} />;
                }

                /* LID cell — leader's physical seat */
                if (cell.type === 'lid') {
                  const zc = getDarkZoneColor(cell.label);
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
                        height: CELL_H, backgroundColor: zc,
                        borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative',
                        border: isSelected ? '2px solid #818cf8' : '2px solid rgba(255,255,255,0.12)',
                        boxShadow: isSelected ? '0 0 0 1px #818cf8' : undefined,
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        {cell.label}
                      </span>
                      {lidOcc ? (
                        <span style={{ fontSize: 9, fontWeight: 700, color: '#fbbf24', marginTop: 2, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {lidOcc.agentName.split(' ')[0]}
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, color: '#475569', marginTop: 2 }}>Libre</span>
                      )}
                      {/* Badge if multiple leaders share this LID today */}
                      {multipleLeaders && (
                        <div style={{
                          position: 'absolute', top: 3, right: 3,
                          minWidth: 14, height: 14,
                          backgroundColor: '#4f46e5', color: 'white',
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
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 16, paddingTop: 12, borderTop: '1px solid #1e293b' }}>
              {layout.zones.map((zone) => (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: getDarkZoneColor(zone.name), border: '1px solid rgba(255,255,255,0.1)' }} />
                  <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{zone.name}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: '#d97706', border: '1px solid rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>Líder</span>
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
