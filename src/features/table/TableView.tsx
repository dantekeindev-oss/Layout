import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store';
import { Button, StatusBadge, ShiftBadge } from '../../components/ui';
import * as XLSX from 'xlsx';

export function TableView() {
  const { agents, assignments, layout, config, stats } = useStore();

  const tableData = useMemo(() => {
    return agents
      .filter((agent) => {
        const excludedLeader = config.excludedLeader?.trim();
        if (!excludedLeader) return true;
        const leaderName = config.leaderField === 'jefe' ? agent.jefe : agent.superior;
        return leaderName !== excludedLeader;
      })
      .map((agent) => {
        const boxId = assignments.get(agent.id);
        const box = boxId ? layout.boxes.find((b) => b.id === boxId) : undefined;
        return { ...agent, boxNumber: box?.numero || '-', boxZone: box?.zona || '-' };
      })
      .sort((a, b) => {
        const aNum = typeof a.boxNumber === 'number' ? a.boxNumber : -1;
        const bNum = typeof b.boxNumber === 'number' ? b.boxNumber : -1;
        if (aNum === -1 && bNum !== -1) return 1;
        if (aNum !== -1 && bNum === -1) return -1;
        if (aNum !== -1 && bNum !== -1) return aNum - bNum;
        return a.nombre.localeCompare(b.nombre);
      });
  }, [agents, assignments, layout.boxes, config.excludedLeader, config.leaderField]);

  const handleExportCSV = () => {
    const exportData = tableData.map((row) => ({
      Box: row.boxNumber,
      Zona: row.boxZone,
      Nombre: row.nombre,
      Usuario: row.usuario,
      Líder: config.leaderField === 'jefe' ? row.jefe : row.superior,
      Segmento: row.segmento,
      Ingreso: row.entryTime,
      Egreso: row.exitTime,
      Contrato: row.contrato,
      'Horas Diarias': row.dailyHours,
      Turno: row.shift,
      Estado: row.assignmentStatus,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asignaciones');
    XLSX.writeFile(wb, `asignaciones-boxes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportAssignments = () => {
    const exportRows = useStore.getState().exportData();
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asignaciones');
    XLSX.writeFile(wb, `reporte-asignaciones-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#f6f6f6' }}>

      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid #e8e8e8', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#111111', letterSpacing: '-0.01em', margin: 0 }}>
              Tabla de Asignaciones
            </h1>
            <p style={{ fontSize: 12, color: '#aaaaaa', margin: '3px 0 0' }}>
              {stats.assignedAgents} de {stats.totalAgents} agentes asignados
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportAssignments}>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar Reporte
            </Button>
          </div>
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 24, marginTop: 12 }}>
          <StatItem label="Ocupación" value={`${stats.occupationRate}%`} accent="#059669" />
          <StatItem label="Boxes usados" value={`${stats.usedBoxes}/${stats.totalBoxes}`} accent="#2563eb" />
          <StatItem label="Reutilizados" value={stats.reusedBoxes} accent="#d97706" />
          <StatItem label="Fragmentación" value={`${stats.fragmentationScore}%`} accent="#888888" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#fafafa', borderBottom: '1px solid #e8e8e8' }}>
              {['Box', 'Zona', 'Nombre', 'Usuario', 'Líder', 'Segmento', 'Horario', 'Contrato', 'Turno', 'Estado'].map((h) => (
                <th key={h} style={{
                  padding: '9px 14px', textAlign: 'left',
                  fontSize: 10, fontWeight: 600, color: '#bbbbbb',
                  textTransform: 'uppercase', letterSpacing: '0.07em',
                  borderBottom: '1px solid #e8e8e8',
                  background: '#fafafa',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.map((agent, idx) => (
              <tr
                key={agent.id}
                style={{
                  background: idx % 2 === 0 ? '#ffffff' : '#fafafa',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f5')}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? '#ffffff' : '#fafafa')}
              >
                <td style={{ padding: '9px 14px', fontWeight: 700, color: '#111111', fontVariantNumeric: 'tabular-nums' }}>
                  {agent.boxNumber}
                </td>
                <td style={{ padding: '9px 14px', color: '#888888', fontSize: 12 }}>{agent.boxZone}</td>
                <td style={{ padding: '9px 14px', fontWeight: 600, color: '#222222' }}>{agent.nombre}</td>
                <td style={{ padding: '9px 14px', color: '#aaaaaa', fontFamily: 'monospace', fontSize: 12 }}>{agent.usuario}</td>
                <td style={{ padding: '9px 14px', color: '#555555' }}>
                  {config.leaderField === 'jefe' ? agent.jefe : agent.superior}
                </td>
                <td style={{ padding: '9px 14px', color: '#777777' }}>{agent.segmento}</td>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{ color: '#333333', fontVariantNumeric: 'tabular-nums' }}>{agent.entryTime}</span>
                  <span style={{ color: '#cccccc', margin: '0 4px' }}>→</span>
                  <span style={{ color: '#333333', fontVariantNumeric: 'tabular-nums' }}>{agent.exitTime}</span>
                </td>
                <td style={{ padding: '9px 14px', color: '#888888' }}>
                  {agent.contrato}
                  <span style={{ color: '#cccccc', marginLeft: 4 }}>({agent.dailyHours}h)</span>
                </td>
                <td style={{ padding: '9px 14px' }}>
                  <ShiftBadge shift={agent.shift} />
                </td>
                <td style={{ padding: '9px 14px' }}>
                  <StatusBadge status={agent.assignmentStatus} />
                  {agent.isLocked && (
                    <span style={{ marginLeft: 4, fontSize: 11 }}>🔒</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tableData.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: '#bbbbbb', fontSize: 14 }}>No hay agentes para mostrar</p>
            <p style={{ color: '#cccccc', fontSize: 12, marginTop: 4 }}>Subí un archivo CSV para comenzar</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ fontSize: 11, color: '#aaaaaa' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent }}>{value}</span>
    </div>
  );
}
