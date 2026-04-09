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
  morning:   { label: 'Mañana',   start: 360, end: 660  },
  midday:    { label: 'Mediodía', start: 720, end: 780  },
  afternoon: { label: 'Tarde',    start: 840, end: 1440 },
};

const AISLE_ROWS = new Set([2, 4, 7, 10]);
const CELL_W = 130;
const CELL_H = 110;
const AISLE_H = 24;
const GAP = 4;

type DisplayBox = Box & { shiftOccupant?: BoxOccupation };

const DARK_ZONE_COLORS: Record<string, string> = {
  'LID 1': 'rgba(37,99,200,0.06)',
  'LID 2': 'rgba(5,150,105,0.06)',
  'LID 3': 'rgba(217,119,6,0.06)',
  'LID 4': 'rgba(124,58,237,0.06)',
  'LID 5': 'rgba(225,29,72,0.06)',
  'LID 6': 'rgba(234,88,12,0.06)',
  'LID 7': 'rgba(8,145,178,0.06)',
};

const ZONE_ACCENT_COLORS: Record<string, string> = {
  'LID 1': '#2563eb',
  'LID 2': '#059669',
  'LID 3': '#d97706',
  'LID 4': '#7c3aed',
  'LID 5': '#e11d48',
  'LID 6': '#ea580c',
  'LID 7': '#0891b2',
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
  return DARK_ZONE_COLORS[zone] || 'rgba(246,246,246,0.5)';
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

  const leaderForLid = useMemo(() => {
    const lidMap: Record<string, string> = {};
    Object.entries(config.leaderBoxAssignments || {}).forEach(([lid, leader]) => {
      if (!leader) return;
      const leaderIsActiveInShift = agents.some((agent) => {
        if (!leaderNamesMatch(agent.nombre, leader)) return false;
        return occOverlapsWindow(
          { agentId: agent.id, agentName: agent.nombre, entryTime: agent.entryTime, exitTime: agent.exitTime, leader: '', segment: '' },
          shiftWindow.start, shiftWindow.end
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

    assignments.forEach((boxId, agentId) => {
      const agent = agents.find((a) => a.id === agentId);
      const cell  = cells.find((b) => b.id === boxId);
      if (agent && cell) {
        const leader = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
        cell.occupations.push({
          agentId: agent.id, agentName: agent.nombre,
          entryTime: agent.entryTime, exitTime: agent.exitTime,
          leader, segment: agent.segmento,
          leaderField: config.leaderField,
          rawLeaderJefe: agent.jefe,
          rawLeaderSuperior: agent.superior,
        });
      }
    });

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

  const excludedAgentIds = useMemo(() => {
    if (!selectedLeader || leaderMode !== 'exclude') return new Set<string>();
    const excludedIds = new Set<string>();
    agents.forEach((agent) => {
      const agentLeader = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
      if (agentLeader === selectedLeader) excludedIds.add(agent.id);
    });
    return excludedIds;
  }, [agents, selectedLeader, leaderMode, config.leaderField]);

  const totalBoxes      = displayCells.filter((c) => c.type === 'box' && c.activo).length;
  const occupiedInShift = displayCells.filter((c) => {
    if (c.type !== 'box') return false;
    const occ = (c as DisplayBox).shiftOccupant;
    if (!occ) return false;
    return !excludedAgentIds.has(occ.agentId);
  }).length;

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
      const canvas = await html2canvas(el, { backgroundColor: '#f6f6f6', scale: 2, useCORS: true });
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
    <div className="h-full flex flex-col" style={{ background: '#f6f6f6' }}>

      {/* ── Toolbar ── */}
      <div
        className="px-4 py-2 flex items-center gap-3 flex-wrap shrink-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #e8e8e8' }}
      >
        {/* Counters */}
        <div className="flex items-center gap-2 mr-1">
          <div className="text-right leading-none">
            <span className="text-lg font-bold tabular-nums" style={{ color: '#111111' }}>{occupiedInShift}</span>
            <span className="text-sm font-medium" style={{ color: '#cccccc' }}>/{totalBoxes}</span>
          </div>
          <span className="text-[9px] font-medium uppercase tracking-wider leading-tight" style={{ color: '#bbbbbb' }}>
            boxes<br/>ocupados
          </span>
          {excludedTeamBoxes > 0 && (
            <span className="text-[9px] font-medium text-red-500">({excludedTeamBoxes} excl.)</span>
          )}
        </div>

        <div className="w-px h-4" style={{ background: '#e8e8e8' }} />

        {/* Shift pills */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: '#f5f5f5', border: '1px solid #e8e8e8' }}>
          {Object.entries(SHIFT_WINDOWS).map(([key, { label }]) => (
            <button
              key={key}
              onClick={() => useStore.getState().setUiState({ selectedShift: key as ShiftType | 'all' })}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all`}
              style={selectedShift === key
                ? { background: '#111111', color: '#ffffff' }
                : { color: '#aaaaaa' }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="w-px h-4" style={{ background: '#e8e8e8' }} />

        {/* Leader filter */}
        <div className="relative flex items-center gap-1.5">
          <button
            onClick={() => setLeaderOpen((o) => !o)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={
              selectedLeader && leaderMode === 'highlight'
                ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706' }
                : selectedLeader && leaderMode === 'exclude'
                ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }
                : { background: '#ffffff', border: '1px solid #e8e8e8', color: '#888888' }
            }
          >
            <span className="max-w-[160px] truncate">
              {selectedLeader
                ? (leaderMode === 'exclude' ? `Sin: ${selectedLeader.split(' ')[0]}` : selectedLeader)
                : 'Filtrar por líder'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
          {selectedLeader && (
            <button
              onClick={() => setSelectedLeader('')}
              className="p-1 rounded-md transition-colors"
              style={{ color: '#aaaaaa' }}
              title="Limpiar filtro"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {leaderOpen && (
            <div className="absolute left-0 top-full mt-1 w-68 rounded-xl shadow-lg z-50 overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e8e8e8', minWidth: 260 }}>
              <div className="p-2" style={{ borderBottom: '1px solid #f0f0f0' }}>
                <p className="text-[9px] font-semibold uppercase tracking-wider mb-1.5 px-1" style={{ color: '#bbbbbb' }}>Modo</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setLeaderMode('highlight')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={leaderMode === 'highlight'
                      ? { background: '#fffbeb', border: '1px solid #fde68a', color: '#d97706' }
                      : { color: '#aaaaaa', border: '1px solid transparent' }}
                  >Resaltar</button>
                  <button
                    onClick={() => setLeaderMode('exclude')}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={leaderMode === 'exclude'
                      ? { background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }
                      : { color: '#aaaaaa', border: '1px solid transparent' }}
                  >Excluir</button>
                </div>
              </div>
              <div className="p-1 max-h-60 overflow-y-auto">
                <button
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all"
                  style={!selectedLeader ? { background: '#111111', color: '#ffffff' } : { color: '#888888' }}
                  onClick={() => { setSelectedLeader(''); setLeaderOpen(false); }}
                >Todos los líderes</button>
                {leaderNames.map((l) => (
                  <button
                    key={l}
                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between"
                    style={selectedLeader === l
                      ? leaderMode === 'exclude'
                        ? { background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }
                        : { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }
                      : { color: '#555555', border: '1px solid transparent' }}
                    onClick={() => { setSelectedLeader(l); setLeaderOpen(false); }}
                  >
                    <span>{l}</span>
                    {selectedLeader === l && (
                      <span style={{ fontSize: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.6 }}>
                        {leaderMode === 'exclude' ? 'excl.' : 'activo'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-4" style={{ background: '#e8e8e8' }} />

        {/* Leader Field Toggle */}
        <div className="flex items-center gap-0.5 rounded-lg p-0.5" style={{ background: '#f5f5f5', border: '1px solid #e8e8e8' }}>
          {(['superior', 'jefe'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setConfig({ leaderField: f })}
              className="px-3 py-1 rounded-md text-xs font-semibold transition-all"
              style={config.leaderField === f
                ? { background: '#111111', color: '#ffffff' }
                : { color: '#aaaaaa' }}
            >
              {f === 'superior' ? 'Super' : 'Jefe'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Zoom */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))} className="p-1.5 rounded-lg transition-all" style={{ color: '#aaaaaa' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-semibold tabular-nums w-9 text-center" style={{ color: '#aaaaaa' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 rounded-lg transition-all" style={{ color: '#aaaaaa' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom(1)} className="p-1.5 rounded-lg transition-all" style={{ color: '#aaaaaa' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#f0f0f0')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
          style={{ background: '#111111', color: '#ffffff', opacity: exporting ? 0.5 : 1, border: 'none', cursor: exporting ? 'not-allowed' : 'pointer' }}
        >
          <Download className="w-3.5 h-3.5" />
          {exporting ? 'Exportando…' : selectedLeader ? `Exportar — ${selectedLeader.split(' ')[0]}` : 'Exportar'}
        </button>
      </div>

      {/* ── Leader banner ── */}
      {selectedLeader && (
        <div
          className="px-5 py-1.5 flex items-center gap-3"
          style={leaderMode === 'exclude'
            ? { background: '#fef2f2', borderBottom: '1px solid #fecaca' }
            : { background: '#fffbeb', borderBottom: '1px solid #fde68a' }}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: leaderMode === 'exclude' ? '#f87171' : '#fbbf24' }} />
          <span className="text-xs font-medium" style={{ color: leaderMode === 'exclude' ? '#dc2626' : '#d97706' }}>
            {leaderMode === 'exclude'
              ? <>Sin equipo: <strong>{selectedLeader}</strong> — {excludedAgentIds.size} filtrados</>
              : <>Resaltando equipo de <strong>{selectedLeader}</strong></>
            }
          </span>
          <button onClick={() => setSelectedLeader('')} className="ml-auto text-xs transition-colors" style={{ color: '#bbbbbb' }}>
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
              background: '#eeeeee',
              borderRadius: 14,
              padding: 14,
              border: '1px solid #e0e0e0',
            }}
          >
            {/* Export header */}
            {selectedLeader && (
              <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: leaderMode === 'exclude' ? '#dc2626' : '#d97706' }}>
                  {leaderMode === 'exclude' ? `Sin equipo: ${selectedLeader}` : `Equipo: ${selectedLeader}`}
                </span>
                <span style={{ fontSize: 10, color: '#aaaaaa', fontWeight: 500 }}>
                  {SHIFT_WINDOWS[selectedShift]?.label ?? ''}
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns, gridTemplateRows, gap: GAP }}>
              {displayCells.map((cell) => {

                /* Aisle row */
                if (cell.type === 'aisle' && cell.columna === 1) {
                  return (
                    <div
                      key={cell.id}
                      style={{
                        gridRow: cell.fila,
                        gridColumn: `1 / span ${cols}`,
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: '#e4e4e4', borderRadius: 5,
                        border: '1px solid #d8d8d8', padding: '0 12px',
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: '#d0d0d0' }} />
                      <span style={{ fontSize: 8, color: '#bbbbbb', fontWeight: 500, letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                        pasillo
                      </span>
                      <div style={{ flex: 1, height: 1, background: '#d0d0d0' }} />
                    </div>
                  );
                }

                if (cell.type === 'aisle') {
                  return <div key={cell.id} style={{ gridRow: cell.fila, gridColumn: cell.columna }} />;
                }

                /* LID cell */
                if (cell.type === 'lid') {
                  const accent     = ZONE_ACCENT_COLORS[cell.label] ?? '#888888';
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
                        background: isSelected ? '#ffffff' : bgColor,
                        borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', position: 'relative',
                        border: `1px solid ${isSelected ? '#cccccc' : '#e0e0e0'}`,
                        borderLeft: `3px solid ${accent}`,
                        boxShadow: isSelected ? '0 0 0 2px rgba(17,17,17,0.08), 0 4px 12px rgba(0,0,0,0.06)' : '0 1px 3px rgba(0,0,0,0.04)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {cell.label}
                      </span>
                      {lidOcc ? (
                        <span style={{ fontSize: 9, fontWeight: 600, color: '#333333', marginTop: 3, maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {lidOcc.agentName.split(' ')[0]}
                        </span>
                      ) : (
                        <span style={{ fontSize: 8, color: '#cccccc', marginTop: 3, fontWeight: 500 }}>Libre</span>
                      )}
                      {multipleLeaders && (
                        <div style={{
                          position: 'absolute', top: 4, right: 4,
                          minWidth: 14, height: 14,
                          background: '#111111', color: '#ffffff',
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
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e0e0e0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {layout.zones.map((zone) => {
                  const accent = ZONE_ACCENT_COLORS[zone.name] ?? '#888888';
                  const range  = ZONE_BOX_RANGES[zone.name] ?? '';
                  return (
                    <div key={zone.id} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'rgba(255,255,255,0.7)', border: '1px solid #e0e0e0',
                      borderLeft: `3px solid ${accent}`, borderRadius: 5, padding: '3px 7px',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, color: accent, fontWeight: 700, lineHeight: 1 }}>{zone.name}</div>
                        <div style={{ fontSize: 7, color: '#aaaaaa', fontWeight: 500, marginTop: 1 }}>{range}</div>
                      </div>
                    </div>
                  );
                })}
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
