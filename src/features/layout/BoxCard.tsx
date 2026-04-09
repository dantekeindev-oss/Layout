import { memo } from 'react';
import type { Box, BoxOccupation } from '../../types';

const ZONE_COLOR: Record<string, string> = {
  'LID 1': '#2563eb',
  'LID 2': '#059669',
  'LID 3': '#d97706',
  'LID 4': '#7c3aed',
  'LID 5': '#e11d48',
  'LID 6': '#ea580c',
  'LID 7': '#0891b2',
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

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export const BoxCard = memo(({
  box, isSelected, isHighlighted, isDimmed = false,
  isLeader = false, shiftOccupant, shiftOccupationCount, onClick,
}: BoxCardProps) => {
  const occ      = shiftOccupant;
  const hasNext  = !occ && !!box.nextOccupant;
  const inactive = !box.activo;
  const zone     = ZONE_COLOR[box.zona] ?? '#888888';

  const nextAfterCurrent = occ
    ? (() => {
        const idx = box.occupations.findIndex(o => o.agentId === occ.agentId);
        return idx >= 0 && idx < box.occupations.length - 1
          ? box.occupations[idx + 1] : undefined;
      })()
    : undefined;
  const sameTeam = !!(nextAfterCurrent && nextAfterCurrent.leader === occ?.leader);

  /* ── Inactive ── */
  if (inactive) {
    return (
      <div
        onClick={onClick}
        title={`Box ${box.numero} — Fuera de servicio`}
        style={{
          width: '100%', height: '100%',
          borderRadius: 9,
          border: '1.5px dashed #d8d8d8',
          background: '#f5f5f5',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', userSelect: 'none',
          opacity: 0.55,
        }}
      >
        <span style={{ fontSize: 9, color: '#bbbbbb', fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {box.numero} · inactivo
        </span>
      </div>
    );
  }

  const borderColor      = isSelected ? '#111111' : isHighlighted ? zone : occ ? '#e8e8e8' : '#ebebeb';
  const borderLeftColor  = isSelected ? '#111111' : zone;
  const bg               = occ ? '#ffffff' : '#fafafa';

  return (
    <div
      onClick={onClick}
      className="box-card"
      title={occ ? `${occ.agentName} · ${occ.entryTime}–${occ.exitTime}` : `Box ${box.numero} · ${box.zona}`}
      style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        borderRadius: 9,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderLeft: `3px solid ${borderLeftColor}`,
        boxShadow: isSelected
          ? '0 0 0 2px rgba(17,17,17,0.08), 0 4px 14px rgba(0,0,0,0.07)'
          : occ ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
        cursor: 'pointer', userSelect: 'none', overflow: 'hidden',
        opacity: isDimmed ? 0.07 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
        position: 'relative',
      }}
    >
      {/* Top bar */}
      <div style={{ height: 2, background: occ ? zone : `${zone}22`, flexShrink: 0 }} />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px 2px', flexShrink: 0,
        borderBottom: '1px solid rgba(0,0,0,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#111111', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {box.numero}
          </span>
          <span style={{ fontSize: 7.5, fontWeight: 600, color: `${zone}88`, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {box.zona}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {isLeader && (
            <span style={{
              fontSize: 7, fontWeight: 700, color: '#d97706',
              background: 'rgba(217,119,6,0.08)',
              border: '1px solid rgba(217,119,6,0.2)',
              padding: '1px 5px', borderRadius: 3,
              letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>LÍD</span>
          )}
          {(shiftOccupationCount ?? box.occupations.length) > 1 && (
            <span style={{
              fontSize: 7, fontWeight: 700, color: '#ffffff',
              background: '#111111', width: 14, height: 14,
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {shiftOccupationCount ?? box.occupations.length}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {occ ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '4px 8px', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `${zone}12`,
              border: `1.5px solid ${zone}35`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: zone, letterSpacing: '-0.02em' }}>
                {initials(occ.agentName)}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#111111', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={occ.agentName}>
                {occ.agentName.split(' ').slice(0, 2).join(' ')}
              </div>
              <div style={{ fontSize: 8.5, color: '#bbbbbb', lineHeight: 1.2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={occ.leader}>
                {occ.leader.split(' ').slice(0, 2).join(' ')}
              </div>
            </div>
          </div>
        </div>
      ) : hasNext ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4px 8px', gap: 2 }}>
          <span style={{ fontSize: 7.5, color: '#cccccc', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>libre · entra</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111111', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
            {box.nextOccupant!.entryTime}
          </span>
          <span style={{ fontSize: 8, color: '#bbbbbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%', textAlign: 'center' }}>
            {box.nextOccupant!.agentName.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 8, color: '#d8d8d8', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>disponible</span>
        </div>
      )}

      {/* Footer */}
      {occ && (
        <div style={{
          padding: '3px 8px 4px',
          borderTop: '1px solid rgba(0,0,0,0.04)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 8, color: '#cccccc', fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
              {occ.entryTime}–{occ.exitTime}
            </span>
            {!nextAfterCurrent && (
              <span style={{
                fontSize: 7, fontWeight: 600, color: zone,
                background: `${zone}10`, border: `1px solid ${zone}22`,
                padding: '1px 5px', borderRadius: 3,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>activo</span>
            )}
          </div>
          {nextAfterCurrent && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, marginTop: 2,
              padding: '2px 5px', borderRadius: 4,
              background: sameTeam ? 'rgba(5,150,105,0.06)' : 'rgba(0,0,0,0.02)',
              border: `1px solid ${sameTeam ? 'rgba(5,150,105,0.15)' : 'rgba(0,0,0,0.05)'}`,
            }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: sameTeam ? '#059669' : '#d8d8d8' }}>⇄</span>
              <span style={{ fontSize: 7.5, fontWeight: 600, color: sameTeam ? '#059669' : '#bbbbbb', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {nextAfterCurrent.agentName.split(' ')[0]}
              </span>
              <span style={{ fontSize: 7, color: sameTeam ? '#05966988' : '#dddddd', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                {nextAfterCurrent.entryTime}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

BoxCard.displayName = 'BoxCard';
