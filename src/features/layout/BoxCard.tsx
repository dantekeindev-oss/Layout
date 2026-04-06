import { memo } from 'react';
import { clsx } from 'clsx';
import { WifiOff } from 'lucide-react';
import type { Box, BoxOccupation } from '../../types';
import { isFemale } from '../../lib/utils/gender';
import { AgentAvatar } from './AgentAvatar';

// Paleta muted/terrosa — funciona sobre fondo beige
const ZONE_ACCENT: Record<string, string> = {
  'LID 1': '#2563c8',
  'LID 2': '#1a8f65',
  'LID 3': '#c47a1a',
  'LID 4': '#7c3aed',
  'LID 5': '#c4365a',
  'LID 6': '#d4621a',
  'LID 7': '#1a8fa8',
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
  const occ       = shiftOccupant;
  const female    = occ ? isFemale(occ.agentName) : false;
  const hasNext   = !occ && !!box.nextOccupant;
  const isInactive = !box.activo;
  const zoneColor  = ZONE_ACCENT[box.zona] ?? '#78716c';

  const nextAfterCurrent = occ
    ? (() => {
        const idx = box.occupations.findIndex((o) => o.agentId === occ.agentId);
        return idx >= 0 && idx < box.occupations.length - 1 ? box.occupations[idx + 1] : undefined;
      })()
    : undefined;
  const sameTeamRecambio = !!(nextAfterCurrent && nextAfterCurrent.leader === occ?.leader);

  if (isInactive) {
    return (
      <div
        onClick={onClick}
        title={`Box ${box.numero} — Fuera de servicio`}
        className={clsx(
          'box-card w-full h-full flex flex-col items-center justify-center rounded-xl cursor-pointer select-none',
          'border-2 border-dashed',
          isSelected ? 'border-stone-400' : 'border-stone-300',
        )}
        style={{ background: '#ece7de' }}
      >
        <WifiOff className="w-4 h-4 mb-1 text-stone-400" />
        <span className="text-[9px] font-medium uppercase tracking-wide text-stone-400">Box {box.numero}</span>
      </div>
    );
  }

  const borderColor = isSelected ? '#1a1714' : isHighlighted ? '#c47a1a' : '#ddd8cf';
  const borderLeft  = isSelected ? '#1a1714' : isHighlighted ? '#c47a1a' : zoneColor;

  return (
    <div
      onClick={onClick}
      title={occ ? `${occ.agentName} · ${occ.entryTime}–${occ.exitTime}` : `Box ${box.numero} · ${box.zona}`}
      className="box-card w-full h-full flex flex-col rounded-xl overflow-hidden cursor-pointer select-none"
      style={{
        background: occ ? (isLeader ? '#fffbea' : '#ffffff') : '#f7f3ec',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderLeft}`,
        boxShadow: isSelected
          ? '0 0 0 2px rgba(26,23,20,0.15), 0 4px 16px rgba(0,0,0,0.1)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        opacity: isDimmed ? 0.1 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
    >
      {/* Zone bar */}
      <div style={{ height: 2, background: occ ? zoneColor : `${zoneColor}40` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-0.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold tabular-nums leading-none text-stone-800">
            {box.numero}
          </span>
          <span className="text-[8px] font-medium leading-none truncate uppercase tracking-wide"
            style={{ color: `${zoneColor}99` }}>
            {box.zona}
          </span>
        </div>
        {isLeader && (
          <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded leading-none uppercase tracking-wider shrink-0 animate-badge-pop"
            style={{
              background: 'rgba(196,122,26,0.12)',
              border: '1px solid rgba(196,122,26,0.3)',
              color: '#c47a1a',
            }}
          >
            LÍD
          </span>
        )}
      </div>

      {/* Body */}
      {occ ? (
        <div className="flex items-center gap-1.5 flex-1 px-2 py-1.5 min-h-0 overflow-hidden">
          <div className="shrink-0">
            <AgentAvatar female={female} isLeader={isLeader} size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-stone-900 leading-tight truncate" title={occ.agentName}>
              {occ.agentName.split(' ').slice(0, 2).join(' ')}
            </p>
            <p className="text-[9px] leading-none truncate mt-0.5 text-stone-500" title={occ.leader}>
              {occ.leader.split(' ').slice(0, 2).join(' ')}
            </p>
            {occ.segment && (
              <p className="text-[8px] text-stone-400 leading-none truncate mt-0.5">{occ.segment}</p>
            )}
          </div>
        </div>
      ) : hasNext ? (
        <div className="flex flex-col items-center justify-center flex-1 px-2 gap-0.5">
          <span className="text-[8px] text-stone-400 font-medium uppercase tracking-wider">libre ahora</span>
          <span className="text-[12px] font-bold tabular-nums text-stone-700">
            {box.nextOccupant!.entryTime}
          </span>
          <span className="text-[8px] text-stone-400 truncate w-full text-center">
            {box.nextOccupant!.agentName.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-1">
          <div className="w-4 h-4 rounded-full border border-stone-200" />
          <span className="text-[8px] text-stone-300 font-medium uppercase tracking-wide">libre</span>
        </div>
      )}

      {/* Footer */}
      {occ && (
        <div className="px-2 py-1 shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-stone-400 font-medium tabular-nums">
              {occ.entryTime}–{occ.exitTime}
            </span>
            {!nextAfterCurrent && (
              <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{
                  background: `${zoneColor}12`,
                  border: `1px solid ${zoneColor}30`,
                  color: zoneColor,
                }}
              >
                activo
              </span>
            )}
          </div>
          {nextAfterCurrent && (
            <div className="flex items-center gap-1 mt-0.5 rounded px-1 py-0.5"
              style={{
                background: sameTeamRecambio ? 'rgba(26,143,101,0.08)' : 'rgba(0,0,0,0.03)',
                border: `1px solid ${sameTeamRecambio ? 'rgba(26,143,101,0.2)' : 'rgba(0,0,0,0.07)'}`,
              }}
            >
              <span className="text-[8px] font-bold shrink-0"
                style={{ color: sameTeamRecambio ? '#1a8f65' : '#c8c2b5' }}>⇄</span>
              <span className="text-[8px] font-medium truncate"
                style={{ color: sameTeamRecambio ? '#1a8f65' : '#a89e8f' }}>
                {nextAfterCurrent.agentName.split(' ')[0]}
              </span>
              <span className="text-[7px] tabular-nums ml-auto shrink-0"
                style={{ color: sameTeamRecambio ? '#1a8f65aa' : '#c8c2b5' }}>
                {nextAfterCurrent.entryTime}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Multi-occupant badge */}
      {(shiftOccupationCount ?? box.occupations.length) > 1 && (
        <div className="absolute top-1 right-1 min-w-[15px] h-[15px] text-[7px] font-bold rounded-full flex items-center justify-center px-1 animate-badge-pop"
          style={{ background: '#1a1714', color: '#f2ede4' }}
        >
          {shiftOccupationCount ?? box.occupations.length}
        </div>
      )}
    </div>
  );
});

BoxCard.displayName = 'BoxCard';
