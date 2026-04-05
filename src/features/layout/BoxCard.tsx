import { memo } from 'react';
import { clsx } from 'clsx';
import { WifiOff } from 'lucide-react';
import type { Box, BoxOccupation } from '../../types';
import { isFemale } from '../../lib/utils/gender';
import { AgentAvatar } from './AgentAvatar';

// Neon palette — cada zona tiene su color + versión oscura para el fondo
const ZONE_ACCENT: Record<string, string> = {
  'LID 1': '#00d4ff',   // cyan neón
  'LID 2': '#00ff88',   // verde neón
  'LID 3': '#ffcc00',   // amarillo neón
  'LID 4': '#bf00ff',   // purple neón
  'LID 5': '#ff0099',   // magenta
  'LID 6': '#ff6600',   // naranja
  'LID 7': '#00ffff',   // cyan claro
};

const ZONE_BG: Record<string, string> = {
  'LID 1': 'rgba(0,212,255,0.05)',
  'LID 2': 'rgba(0,255,136,0.05)',
  'LID 3': 'rgba(255,204,0,0.05)',
  'LID 4': 'rgba(191,0,255,0.05)',
  'LID 5': 'rgba(255,0,153,0.05)',
  'LID 6': 'rgba(255,102,0,0.05)',
  'LID 7': 'rgba(0,255,255,0.05)',
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
  const zoneColor = ZONE_ACCENT[box.zona] ?? '#334155';
  const zoneBg    = ZONE_BG[box.zona]    ?? 'rgba(30,41,59,0.5)';

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
        className="box-card w-full h-full flex flex-col items-center justify-center rounded-xl cursor-pointer select-none"
        style={{
          background: '#050816',
          border: '2px dashed rgba(239,68,68,0.25)',
          boxShadow: isSelected ? '0 0 16px rgba(239,68,68,0.3)' : undefined,
        }}
      >
        <WifiOff className="w-4 h-4 mb-1" style={{ color: 'rgba(239,68,68,0.4)' }} />
        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(239,68,68,0.4)' }}>
          Box {box.numero}
        </span>
      </div>
    );
  }

  const glowColor = isSelected
    ? 'rgba(0,212,255,0.5)'
    : isHighlighted
    ? 'rgba(251,191,36,0.5)'
    : occ
    ? `${zoneColor}44`
    : `${zoneColor}18`;

  const borderColor = isSelected
    ? '#00d4ff'
    : isHighlighted
    ? '#fbbf24'
    : occ
    ? `${zoneColor}bb`
    : `${zoneColor}33`;

  return (
    <div
      onClick={onClick}
      title={occ ? `${occ.agentName} · ${occ.entryTime}–${occ.exitTime}` : `Box ${box.numero} · ${box.zona}`}
      className={clsx('box-card w-full h-full flex flex-col rounded-xl overflow-hidden cursor-pointer select-none', occ && 'occupied')}
      style={{
        '--glow': glowColor,
        background: occ
          ? isLeader
            ? 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(217,119,6,0.08))'
            : `linear-gradient(135deg, ${zoneBg}, rgba(5,8,22,0.95))`
          : 'rgba(5,8,22,0.8)',
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderColor}`,
        boxShadow: occ
          ? `0 0 ${isSelected ? '20px' : '10px'} ${glowColor}, inset 0 0 20px rgba(0,0,0,0.3)`
          : `0 0 6px ${glowColor}`,
        opacity: isDimmed ? 0.1 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      } as React.CSSProperties}
    >
      {/* Top accent bar */}
      <div style={{
        height: 2,
        background: occ
          ? `linear-gradient(90deg, ${zoneColor}, transparent)`
          : `linear-gradient(90deg, ${zoneColor}44, transparent)`,
        animation: occ && isSelected ? 'glow-pulse 2s ease-in-out infinite' : undefined,
      }} />

      {/* Header strip */}
      <div className="flex items-center justify-between px-2 pt-1 pb-0.5 shrink-0"
        style={{ borderBottom: `1px solid ${zoneColor}18` }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-black tabular-nums leading-none" style={{ color: zoneColor, textShadow: occ ? `0 0 8px ${zoneColor}` : undefined }}>
            {box.numero}
          </span>
          <span className="text-[7px] font-bold leading-none uppercase tracking-widest truncate" style={{ color: `${zoneColor}66` }}>
            {box.zona}
          </span>
        </div>
        {isLeader && (
          <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm leading-none uppercase tracking-widest shrink-0 animate-badge-pop"
            style={{
              background: 'rgba(251,191,36,0.15)',
              border: '1px solid rgba(251,191,36,0.5)',
              color: '#fbbf24',
              boxShadow: '0 0 8px rgba(251,191,36,0.3)',
            }}
          >
            LID
          </span>
        )}
      </div>

      {/* Body */}
      {occ ? (
        <div className="flex items-center gap-1.5 flex-1 px-2 py-1 min-h-0 overflow-hidden">
          <div className="shrink-0">
            <AgentAvatar female={female} isLeader={isLeader} size={36} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold leading-tight truncate" style={{ color: '#f1f5f9' }} title={occ.agentName}>
              {occ.agentName.split(' ').slice(0, 2).join(' ')}
            </p>
            <p className="text-[8px] leading-none truncate mt-0.5" style={{ color: `${zoneColor}99` }} title={occ.leader}>
              {occ.leader.split(' ').slice(0, 2).join(' ')}
            </p>
            {occ.segment && (
              <p className="text-[7px] leading-none truncate mt-0.5" style={{ color: 'rgba(100,116,139,0.8)' }}>
                {occ.segment}
              </p>
            )}
          </div>
        </div>
      ) : hasNext ? (
        <div className="flex flex-col items-center justify-center flex-1 px-2 gap-0.5">
          <span className="text-[7px] font-bold uppercase tracking-widest" style={{ color: 'rgba(100,116,139,0.6)' }}>
            libre ahora
          </span>
          <span className="text-[12px] font-black tabular-nums" style={{ color: zoneColor, textShadow: `0 0 8px ${zoneColor}88` }}>
            {box.nextOccupant!.entryTime}
          </span>
          <span className="text-[8px] font-medium truncate w-full text-center" style={{ color: `${zoneColor}77` }}>
            {box.nextOccupant!.agentName.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center flex-1 gap-1">
          <div className="w-4 h-4 rounded-full animate-glow-pulse" style={{
            border: `1px solid ${zoneColor}33`,
            boxShadow: `0 0 6px ${zoneColor}22`,
          }} />
          <span className="text-[8px] font-medium uppercase tracking-widest" style={{ color: `${zoneColor}33` }}>
            libre
          </span>
        </div>
      )}

      {/* Footer */}
      {occ && (
        <div className="px-2 py-1 shrink-0" style={{ borderTop: `1px solid ${zoneColor}18` }}>
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-bold tabular-nums" style={{ color: `${zoneColor}88` }}>
              {occ.entryTime}–{occ.exitTime}
            </span>
            {!nextAfterCurrent && (
              <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-widest"
                style={{
                  background: `${zoneColor}18`,
                  border: `1px solid ${zoneColor}44`,
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
                background: sameTeamRecambio ? 'rgba(0,255,136,0.08)' : 'rgba(30,41,59,0.5)',
                border: `1px solid ${sameTeamRecambio ? 'rgba(0,255,136,0.25)' : 'rgba(30,41,59,0.8)'}`,
              }}
            >
              <span className="text-[8px] font-black shrink-0" style={{ color: sameTeamRecambio ? '#00ff88' : '#334155' }}>⇄</span>
              <span className="text-[8px] font-semibold truncate" style={{ color: sameTeamRecambio ? 'rgba(0,255,136,0.9)' : '#475569' }}>
                {nextAfterCurrent.agentName.split(' ')[0]}
              </span>
              <span className="text-[7px] tabular-nums ml-auto shrink-0" style={{ color: sameTeamRecambio ? 'rgba(0,255,136,0.6)' : '#334155' }}>
                {nextAfterCurrent.entryTime}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Multi-occupant badge */}
      {(shiftOccupationCount ?? box.occupations.length) > 1 && (
        <div className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] text-[7px] font-black rounded-full flex items-center justify-center px-1 animate-badge-pop"
          style={{
            background: zoneColor,
            color: '#050816',
            boxShadow: `0 0 8px ${zoneColor}`,
          }}
        >
          {shiftOccupationCount ?? box.occupations.length}
        </div>
      )}
    </div>
  );
});

BoxCard.displayName = 'BoxCard';
