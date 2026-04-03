import { memo } from 'react';
import { clsx } from 'clsx';
import { WifiOff } from 'lucide-react';
import type { Box, BoxOccupation } from '../../types';
import { isFemale } from '../../lib/utils/gender';
import { AgentAvatar } from './AgentAvatar';

const ZONE_ACCENT: Record<string, string> = {
  'LID 1': '#3b82f6',
  'LID 2': '#10b981',
  'LID 3': '#f59e0b',
  'LID 4': '#a855f7',
  'LID 5': '#ec4899',
  'LID 6': '#f97316',
  'LID 7': '#06b6d4',
};

interface BoxCardProps {
  box: Box;
  isSelected: boolean;
  isHighlighted: boolean;
  isDimmed?: boolean;
  isLeader?: boolean;
  shiftOccupant?: BoxOccupation;
  shiftOccupationCount?: number;
  onClick: () => void;
}

export const BoxCard = memo(({
  box, isSelected, isHighlighted, isDimmed = false,
  isLeader = false, shiftOccupant, shiftOccupationCount, onClick,
}: BoxCardProps) => {
  const occ = shiftOccupant;
  const female = occ ? isFemale(occ.agentName) : false;
  const hasNext = !occ && !!box.nextOccupant;
  const isInactive = !box.activo;
  const zoneColor = ZONE_ACCENT[box.zona] ?? '#475569';

  if (isInactive) {
    return (
      <div
        onClick={onClick}
        title={`Box ${box.numero} — Fuera de servicio`}
        className={clsx(
          'w-full h-full flex flex-col items-center justify-center rounded-xl cursor-pointer select-none transition-all duration-150',
          'bg-slate-950 border-2 border-dashed border-red-900/60',
          isSelected && '!border-red-500 ring-1 ring-red-500',
        )}
      >
        <WifiOff className="w-5 h-5 text-red-800 mb-1" />
        <span className="text-[9px] font-bold text-red-900 uppercase tracking-wide">Box {box.numero}</span>
        <span className="text-[8px] text-red-900/70 mt-0.5">Fuera de servicio</span>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      title={occ ? `${occ.agentName} · ${occ.entryTime}–${occ.exitTime}` : `Box ${box.numero} · ${box.zona}`}
      className={clsx(
        'w-full h-full flex flex-col rounded-xl overflow-hidden cursor-pointer select-none transition-all duration-150',
        // background
        occ
          ? isLeader ? 'bg-amber-950/80 border-2 border-amber-500/60'
          : 'bg-slate-800 border-2 border-slate-600'
          : 'bg-slate-900 border-2 border-slate-700/60',
        // selection
        isSelected    && '!border-indigo-400 shadow-lg shadow-indigo-900/50 ring-1 ring-indigo-400',
        isHighlighted && !isSelected && '!border-amber-400 shadow-lg shadow-amber-900/40',
        isDimmed      && 'opacity-15 pointer-events-none',
      )}
      style={{ borderLeft: `3px solid ${isSelected ? '#818cf8' : isHighlighted ? '#fbbf24' : zoneColor}` }}
    >
      {/* ── Zone accent bar ── */}
      <div style={{ height: 3, backgroundColor: zoneColor, opacity: occ ? 0.7 : 0.3 }} />

      {/* ── Top strip ── */}
      <div className={clsx(
        'flex items-center justify-between px-2 py-1 shrink-0',
        isLeader ? 'bg-amber-500/20' : occ ? 'bg-slate-700/40' : 'bg-slate-800/40',
      )}>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold text-slate-300 leading-none tabular-nums">
            {box.numero}
          </span>
          <span className="text-[8px] font-semibold leading-none truncate" style={{ color: zoneColor, opacity: 0.85 }}>
            {box.zona}
          </span>
        </div>
        {isLeader && (
          <span className="text-[8px] bg-amber-500 text-amber-950 font-black px-1.5 py-0.5 rounded-full leading-none uppercase tracking-wide shrink-0">
            Líder
          </span>
        )}
      </div>

      {/* ── Body ── */}
      {occ ? (
        <div className="flex items-center gap-2 flex-1 px-2 py-1.5 min-h-0 overflow-hidden">
          <div className="shrink-0">
            <AgentAvatar female={female} isLeader={isLeader} size={42} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-100 leading-tight truncate" title={occ.agentName}>
              {occ.agentName.split(' ').slice(0, 2).join(' ')}
            </p>
            <p className="text-[9px] text-slate-400 leading-tight truncate mt-0.5" title={occ.leader}>
              {occ.leader.split(' ').slice(0, 2).join(' ')}
            </p>
          </div>
        </div>
      ) : hasNext ? (
        <div className="flex flex-col items-center justify-center flex-1 px-2 gap-0.5">
          <span className="text-[9px] text-amber-400 font-semibold">Libre desde</span>
          <span className="text-[13px] font-bold text-amber-300">{box.nextOccupant!.entryTime}</span>
          <span className="text-[9px] text-slate-500 truncate w-full text-center">
            {box.nextOccupant!.agentName.split(' ')[0]}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1">
          <span className="text-[10px] text-slate-600 font-medium">Disponible</span>
        </div>
      )}

      {/* ── Footer ── */}
      {occ && (
        <div className="flex items-center justify-between px-2 py-1 bg-slate-900/60 border-t border-slate-700/50 shrink-0">
          <span className="text-[9px] text-slate-400 font-medium leading-none tabular-nums">
            {occ.entryTime}–{occ.exitTime}
          </span>
          <span className="text-[8px] bg-emerald-500/20 text-emerald-400 border border-emerald-600/40 font-bold px-1.5 py-0.5 rounded-full leading-none">
            Ocupado
          </span>
        </div>
      )}

      {/* Multiple occupants badge — count only occupants in the current shift */}
      {(shiftOccupationCount ?? box.occupations.length) > 1 && (
        <div className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-indigo-600 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-1 shadow">
          {shiftOccupationCount ?? box.occupations.length}
        </div>
      )}
    </div>
  );
});

BoxCard.displayName = 'BoxCard';
