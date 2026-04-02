import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, X, Layers } from 'lucide-react';
import { parseCsvFile } from '../../lib/parsers/csvParser';
import { useStore } from '../../store';
import type { CsvParseResult } from '../../types';

export function CsvUpload() {
  const { setAgents, setUiState } = useStore();
  const [parseResult, setParseResult] = useState<CsvParseResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
      const result = await parseCsvFile(file);
      setParseResult(result);
    } catch (error) {
      setParseResult({
        agents: [],
        leaders: [],
        errors: [{ row: 0, field: 'Archivo', value: file.name, message: error instanceof Error ? error.message : 'Error desconocido' }],
        warnings: [],
        stats: { totalRows: 0, validAgents: 0, errorCount: 1, warningCount: 0, leadersDetected: 0, segmentsDetected: 0 },
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirm = () => {
    if (!parseResult) return;
    localStorage.removeItem('box-assignment-data');
    setAgents(parseResult.agents, parseResult.leaders ?? []);
    setUiState({ currentView: 'layout' });
  };

  if (parseResult) {
    return <ParseResult result={parseResult} onConfirm={handleConfirm} onReset={() => setParseResult(null)} />;
  }

  return (
    <div className="h-full flex items-center justify-center bg-slate-950 p-6">
      <div className="w-full max-w-lg">
        {/* Logo / header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-indigo-900/60">
            <Layers className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Box Assignment</h1>
          <p className="text-slate-400 mt-2 text-sm">Cargá la nómina para comenzar la asignación de boxes</p>
        </div>

        {/* Drop zone */}
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
        />
        <div
          onClick={() => document.getElementById('file-input')?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          className={`relative rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all duration-200
            ${dragOver
              ? 'border-indigo-500 bg-indigo-950/40 scale-[1.01]'
              : 'border-slate-700 bg-slate-900 hover:border-slate-500 hover:bg-slate-800/60'
            }`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin w-10 h-10 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-slate-300 font-medium">Procesando archivo…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                <Upload className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <p className="text-slate-200 font-semibold text-base">
                  {dragOver ? 'Suelta el archivo aquí' : 'Arrastrá o hacé clic para seleccionar'}
                </p>
                <p className="text-slate-500 text-sm mt-1">CSV · Excel (.xlsx, .xls)</p>
              </div>
            </div>
          )}
        </div>

        {/* Column guide */}
        <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Columnas requeridas</p>
          <div className="flex flex-wrap gap-1.5">
            {['DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO', 'HORARIOS', 'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE'].map((col) => (
              <span key={col} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-mono text-slate-300">
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ParseResult({ result, onConfirm, onReset }: { result: CsvParseResult; onConfirm: () => void; onReset: () => void }) {
  const canProceed = result.agents.length > 0;

  return (
    <div className="h-full overflow-auto bg-slate-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Resultado del análisis</h1>
          <p className="text-slate-400 text-sm mt-1">Revisá los datos antes de confirmar</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Filas totales',   value: result.stats.totalRows,        color: 'slate' },
            { label: 'Agentes válidos', value: result.stats.validAgents,       color: 'indigo' },
            { label: 'Líderes',         value: result.stats.leadersDetected,   color: 'amber' },
            { label: 'Segmentos',       value: result.stats.segmentsDetected,  color: 'emerald' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`rounded-xl border p-4 text-center
              ${color === 'slate'   ? 'bg-slate-800 border-slate-700' :
                color === 'indigo'  ? 'bg-indigo-900/30 border-indigo-700/50' :
                color === 'amber'   ? 'bg-amber-900/30 border-amber-700/50' :
                                     'bg-emerald-900/30 border-emerald-700/50'}`}>
              <div className={`text-3xl font-bold ${
                color === 'slate' ? 'text-slate-100' :
                color === 'indigo' ? 'text-indigo-300' :
                color === 'amber' ? 'text-amber-300' : 'text-emerald-300'
              }`}>{value}</div>
              <div className="text-xs text-slate-400 font-medium mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div className="mb-4 rounded-xl border border-red-800/50 bg-red-900/20 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-red-800/40">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-300">Errores ({result.errors.length})</span>
            </div>
            <div className="p-3 max-h-44 overflow-y-auto space-y-1.5">
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} className="text-xs text-red-300 bg-red-900/30 rounded-lg px-3 py-1.5">
                  <span className="font-semibold">Fila {e.row}:</span> {e.message}
                  {e.value ? <span className="opacity-60 ml-1">({String(e.value).slice(0, 40)})</span> : null}
                </div>
              ))}
              {result.errors.length > 10 && <p className="text-xs text-red-400 text-center">…y {result.errors.length - 10} más</p>}
            </div>
          </div>
        )}

        {/* Preview table */}
        {result.agents.length > 0 && (
          <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <span className="text-sm font-semibold text-slate-200">Vista previa — {result.agents.length} agentes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-900/60">
                    {['Nombre', 'Usuario', 'Líder', 'Segmento', 'Horario', 'Contrato'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {result.agents.slice(0, 8).map((a) => (
                    <tr key={a.id} className="hover:bg-slate-700/30 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-200">{a.nombre}</td>
                      <td className="px-3 py-2 text-slate-400 font-mono">{a.usuario}</td>
                      <td className="px-3 py-2 text-slate-300">{a.jefe}</td>
                      <td className="px-3 py-2 text-slate-400">{a.segmento}</td>
                      <td className="px-3 py-2 text-slate-300">{a.entryTime}–{a.exitTime}</td>
                      <td className="px-3 py-2 text-slate-400">{a.contrato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.agents.length > 8 && (
                <p className="text-center text-xs text-slate-500 py-2">…y {result.agents.length - 8} agentes más</p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700 transition-all"
          >
            <X className="w-4 h-4" />
            Cargar otro archivo
          </button>
          <button
            onClick={onConfirm}
            disabled={!canProceed}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-900/40"
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar — {result.agents.length} agentes
          </button>
        </div>
      </div>
    </div>
  );
}
