import { useMemo } from 'react';
import { Download } from 'lucide-react';
import { useStore } from '../../store';
import { Button, StatusBadge, ShiftBadge } from '../../components/ui';
import * as XLSX from 'xlsx';

export function TableView() {
  const { agents, assignments, layout, config, stats } = useStore();

  // Prepare table data
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

        return {
          ...agent,
          boxNumber: box?.numero || '-',
          boxZone: box?.zona || '-',
        };
      })
      .sort((a, b) => {
        // Sort by box number, then unassigned
        const aNum = typeof a.boxNumber === 'number' ? a.boxNumber : -1;
        const bNum = typeof b.boxNumber === 'number' ? b.boxNumber : -1;
        if (aNum === -1 && bNum !== -1) return 1;
        if (aNum !== -1 && bNum === -1) return -1;
        if (aNum !== -1 && bNum !== -1) {
          return aNum - bNum;
        }
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

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `asignaciones-boxes-${timestamp}.xlsx`);
  };

  const handleExportAssignments = () => {
    const exportRows = useStore.getState().exportData();

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asignaciones');

    const timestamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `reporte-asignaciones-${timestamp}.xlsx`);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Tabla de Asignaciones</h1>
            <p className="text-sm text-slate-500 mt-1">
              {stats.assignedAgents} de {stats.totalAgents} agentes asignados
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
            <Button variant="primary" size="sm" onClick={handleExportAssignments}>
              <Download className="w-4 h-4 mr-2" />
              Exportar Reporte
            </Button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 mt-4 text-sm">
          <StatItem label="Ocupación" value={`${stats.occupationRate}%`} color="success" />
          <StatItem label="Boxes Usados" value={`${stats.usedBoxes}/${stats.totalBoxes}`} color="primary" />
          <StatItem label="Reutilizados" value={stats.reusedBoxes} color="warning" />
          <StatItem label="Fragmentación" value={`${stats.fragmentationScore}%`} color="gray" />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Box</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Zona</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Usuario</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Líder</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Segmento</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Horario</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Contrato</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Turno</th>
              <th className="px-4 py-3 text-left font-medium text-slate-200">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/30">
            {tableData.map((agent) => (
              <tr key={agent.id} className="hover:bg-slate-800/50">
                <td className="px-4 py-3 font-medium text-slate-100">{agent.boxNumber}</td>
                <td className="px-4 py-3 text-slate-300">{agent.boxZone}</td>
                <td className="px-4 py-3 font-medium text-slate-100">{agent.nombre}</td>
                <td className="px-4 py-3 text-slate-400">{agent.usuario}</td>
                <td className="px-4 py-3 text-slate-300">
                  {config.leaderField === 'jefe' ? agent.jefe : agent.superior}
                </td>
                <td className="px-4 py-3 text-slate-300">{agent.segmento}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-slate-100">{agent.entryTime}</span>
                    <span className="text-slate-500">→</span>
                    <span className="text-slate-100">{agent.exitTime}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">
                  {agent.contrato}
                  <span className="text-slate-500 ml-1">({agent.dailyHours}h)</span>
                </td>
                <td className="px-4 py-3">
                  <ShiftBadge shift={agent.shift} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={agent.assignmentStatus} />
                  {agent.isLocked && (
                    <span className="ml-1 text-xs text-primary-600">🔒</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty state */}
        {tableData.length === 0 && (
          <div className="text-center py-12">
            <p className="text-slate-500">No hay agentes para mostrar</p>
            <p className="text-sm text-slate-400 mt-1">
              Sube un archivo CSV para comenzar
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string | number;
  color: 'success' | 'primary' | 'warning' | 'gray' | 'danger';
}

function StatItem({ label, value, color }: StatItemProps) {
  const colorClasses = {
    success: 'text-emerald-400',
    primary: 'text-indigo-400',
    warning: 'text-amber-400',
    gray: 'text-slate-400',
    danger: 'text-red-400',
  };

  return (
    <div>
      <span className="text-slate-500">{label}:</span>{' '}
      <span className={`font-medium ${colorClasses[color]}`}>{value}</span>
    </div>
  );
}
