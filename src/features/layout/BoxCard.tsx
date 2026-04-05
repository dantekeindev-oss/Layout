import { memo } from 'react';
import { clsx } from 'clsx';
import { WifiOff } from 'lucide-react';
import type { Box, BoxOccupation } from '../../types';
import { isFemale } from '../../lib/utils/gender';
import { AgentAvatar } from './AgentAvatar';

// Professional SaaS palette — distinguible, no neón
const ZONE_ACCENT: Record<string, string> = {
  'LID 1': '#60a5fa',  // azul suave
  'LID 2': '#34d399',  // verde menta
  'LID 3': '#fbbf24',  // ámbar
  'LID 4': '#a78bfa',  // lavanda
  'LID 5': '#f472b6',  // rosa suave
  'LID 6': '#fb923c',  // naranja suave
  'LID 7': '#67e8f9',  // cyan suave
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
  const zoneColor = ZONE_ACCENT[box.zona] ?? '#64748b';

  // Próximo ocupante para recambio
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
          'border-2 border-dashed border-red-900/40',
          isSelected && 'border-red-500/60',
        )}
        style={{ background: '#0a0a0f' }}
      >
        <WifiOff className="w-4 h-4 mb-1 text-red-900/60" />
        <span className="text-[9px] font-semibold uppercase tracking-wide text-red-900/60">Box {box.numero}</span>
      </div>
    );
  }

  const borderColor = isSelected
    ? '#6366f1'
    : isHighlighted
    ? '#fbbf24'
    : occ
    ? `${zoneColor}60`
    : '#1e293b';

  return (
    <div
      onClick={onClick}
      title={occ ? `${occ.agentName} · ${occ.entryTime}–${occ.exitTime}` : `Box ${box.numero} · ${box.zona}`}
      className={clsx('box-card w-full h-full flex flex-col rounded-xl overflow-hidden cursor-pointer select-none')}
      style={{
        background: occ
          ? isLeader ? '#1c1608' : '#111118'
          : '#0d0d14',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${isSelected ? '#6366f1' : isHighlighted ? '#fbbf24' : zoneColor}`,
        boxShadow: isSelected
          ? '0 0 0 1px rgba(99,102,241,0.3), 0 4px 16px rgba(0,0,0,0.4)'
          : isHighlighted
          ? '0 0 0 1px rgba(251,191,36,0.2), 0 4px 16px rgba(0,0,0,0.4)'
          : '0 1px 4px rgba(0,0,0,0.3)',
        opacity: isDimmed ? 0.08 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
    >
      {/* Zone accent bar */}
      <div style={{ height: 2, background: occ ? zoneColor : `${zoneColor}30` }} />

      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-1 pb-0.5 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-bold tabular-nums leading-none text-slate-300">
            {box.numero}
          </span>
          <span className="text-[8px] font-semibold leading-none truncate uppercase tracking-wide"
            style={{ color: `${zoneColor}90` }}>
            {box.zona}
          </span>
        </div>
        {isLeader && (
          <span className="text-[7px] font-bold px-1.5 py-0.5 rounded leading-none uppercase tracking-wider shrink-0 animate-badge-pop"
            style={{
              background: 'rgba(251,191,36,0.12)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: '#fbbf24',
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
            <p className="text-[11px] font-semibold text-slate-100 leading-tight truncate" title={occ.agentName}>
              {occ.agentName.split(' ').slice(0, 2).join(' ')}
            </p>
            <p className="text-[9px] leading-none truncate mt-0.5" style={{ color: `${zoneColor}80` }} title={occ.leader}>
              {occ.leader.split(' ').slice(0, 2).join(' ')}
            </p>
            {occ.segment && (
              <p className="text-[8px] text-slate-600 leading-none truncate mt-0.5">{occ.segment}</p>
            )}
          </div>
        </div>
      ) : hasNext ? (
        <div className="flex flex-col items-center justify-center flex-1 px-2 gap-0.5">
          <span className="text-[8px] text-slate-600 font-medium uppercase tracking-wider">libre ahora</span>
          <span className="text-[12px] font-bold tabular-nums" style={{ color: zoneColor }}>
            {box.nextOccupant!.entryTime}
          </span>
          <span className="text-[8px] text-slate-500 truncate w-full text-center">
            {box.nextOccupant!.agentName.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-1">
          <div className="w-4 h-4 rounded-full border border-slate-800" />
          <span className="text-[8px] text-slate-700 font-medium uppercase tracking-wide">libre</span>
        </div>
      )}

      {/* Footer */}
      {occ && (
        <div className="px-2 py-1 shrink-0"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-slate-500 font-medium tabular-nums">
              {occ.entryTime}–{occ.exitTime}
            </span>
            {!nextAfterCurrent && (
              <span className="text-[7px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
                style={{
                  background: `${zoneColor}15`,
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
                background: sameTeamRecambio ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${sameTeamRecambio ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <span className="text-[8px] font-bold shrink-0"
                style={{ color: sameTeamRecambio ? '#34d399' : '#334155' }}>⇄</span>
              <span className="text-[8px] font-medium truncate"
                style={{ color: sameTeamRecambio ? '#34d399cc' : '#475569' }}>
                {nextAfterCurrent.agentName.split(' ')[0]}
              </span>
              <span className="text-[7px] tabular-nums ml-auto shrink-0"
                style={{ color: sameTeamRecambio ? '#34d39988' : '#334155' }}>
                {nextAfterCurrent.entryTime}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Multi-occupant badge */}
      {(shiftOccupationCount ?? box.occupations.length) > 1 && (
        <div className="absolute top-1 right-1 min-w-[15px] h-[15px] text-[7px] font-bold rounded-full flex items-center justify-center px-1 animate-badge-pop"
          style={{ background: zoneColor, color: '#0a0a0f' }}
        >
          {shiftOccupationCount ?? box.occupations.length}
        </div>
      )}
    </div>
  );
});

BoxCard.displayName = 'BoxCard';
