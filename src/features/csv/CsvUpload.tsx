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
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f2ede4', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Logo / header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#1c1917',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 32px rgba(28,25,23,0.18)',
          }}>
            <Layers style={{ width: 32, height: 32, color: '#f2ede4' }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#1c1917', letterSpacing: '-0.02em', margin: 0 }}>Box Assignment</h1>
          <p style={{ color: '#a8a29e', marginTop: 8, fontSize: 14, margin: '8px 0 0' }}>
            Cargá la nómina para comenzar la asignación de boxes
          </p>
        </div>

        {/* Drop zone */}
        <input
          id="file-input"
          type="file"
          accept=".csv,.xlsx,.xls"
          style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
        />
        <div
          onClick={() => document.getElementById('file-input')?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          style={{
            borderRadius: 16,
            border: `2px dashed ${dragOver ? '#1c1917' : '#d4cfc5'}`,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(28,25,23,0.04)' : '#faf7f2',
            transition: 'all 0.2s ease',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          {isProcessing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <svg style={{ width: 40, height: 40, color: '#1c1917', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p style={{ color: '#1c1917', fontWeight: 500, margin: 0 }}>Procesando archivo…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 12,
                background: '#fff', border: '1.5px solid #e0dbd0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <Upload style={{ width: 24, height: 24, color: '#78716c' }} />
              </div>
              <div>
                <p style={{ color: '#1c1917', fontWeight: 600, fontSize: 15, margin: 0 }}>
                  {dragOver ? 'Suelta el archivo aquí' : 'Arrastrá o hacé clic para seleccionar'}
                </p>
                <p style={{ color: '#a8a29e', fontSize: 13, margin: '6px 0 0' }}>CSV · Excel (.xlsx, .xls)</p>
              </div>
            </div>
          )}
        </div>

        {/* Column guide */}
        <div style={{
          marginTop: 20, padding: 16,
          background: '#fff', border: '1px solid #e0dbd0', borderRadius: 12,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 10px' }}>
            Columnas requeridas
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {['DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO', 'HORARIOS', 'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE'].map((col) => (
              <span key={col} style={{
                padding: '2px 8px',
                background: '#f2ede4', border: '1px solid #d4cfc5',
                borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: '#1c1917', fontWeight: 600,
              }}>
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ParseResult({ result, onConfirm, onReset }: { result: CsvParseResult; onConfirm: () => void; onReset: () => void }) {
  const canProceed = result.agents.length > 0;

  const statCards = [
    { label: 'Filas totales',   value: result.stats.totalRows,       accent: '#78716c' },
    { label: 'Agentes válidos', value: result.stats.validAgents,      accent: '#1a7a56' },
    { label: 'Líderes',         value: result.stats.leadersDetected,  accent: '#b06018' },
    { label: 'Segmentos',       value: result.stats.segmentsDetected, accent: '#6d28d9' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f2ede4', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', letterSpacing: '-0.02em', margin: 0 }}>
            Resultado del análisis
          </h1>
          <p style={{ color: '#a8a29e', fontSize: 13, margin: '6px 0 0' }}>Revisá los datos antes de confirmar</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {statCards.map(({ label, value, accent }) => (
            <div key={label} style={{
              background: '#fff', border: `1px solid #e0dbd0`,
              borderTop: `3px solid ${accent}`,
              borderRadius: 12, padding: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 32, fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#a8a29e', fontWeight: 500, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div style={{
            marginBottom: 16, borderRadius: 12,
            border: '1px solid #fecaca', background: '#fff5f5', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid #fecaca' }}>
              <AlertCircle style={{ width: 16, height: 16, color: '#dc2626' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626' }}>Errores ({result.errors.length})</span>
            </div>
            <div style={{ padding: 12, maxHeight: 176, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: '#dc2626', background: 'rgba(220,38,38,0.08)', borderRadius: 8, padding: '6px 12px' }}>
                  <span style={{ fontWeight: 700 }}>Fila {e.row}:</span> {e.message}
                  {e.value ? <span style={{ opacity: 0.6, marginLeft: 4 }}>({String(e.value).slice(0, 40)})</span> : null}
                </div>
              ))}
              {result.errors.length > 10 && (
                <p style={{ fontSize: 11, color: '#dc2626', textAlign: 'center', margin: 0 }}>
                  …y {result.errors.length - 10} más
                </p>
              )}
            </div>
          </div>
        )}

        {/* Preview table */}
        {result.agents.length > 0 && (
          <div style={{
            marginBottom: 24, borderRadius: 12,
            border: '1px solid #e0dbd0', background: '#fff', overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0dbd0' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#1c1917' }}>
                Vista previa — {result.agents.length} agentes
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf7f2' }}>
                    {['Nombre', 'Usuario', 'Líder', 'Segmento', 'Horario', 'Contrato'].map((h) => (
                      <th key={h} style={{
                        padding: '8px 12px', textAlign: 'left',
                        fontWeight: 600, color: '#a8a29e',
                        textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10,
                        borderBottom: '1px solid #e0dbd0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.agents.slice(0, 8).map((a, idx) => (
                    <tr key={a.id} style={{ background: idx % 2 === 0 ? '#fff' : '#faf7f2' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1c1917' }}>{a.nombre}</td>
                      <td style={{ padding: '8px 12px', color: '#78716c', fontFamily: 'monospace', fontSize: 11 }}>{a.usuario}</td>
                      <td style={{ padding: '8px 12px', color: '#44403c' }}>{a.jefe}</td>
                      <td style={{ padding: '8px 12px', color: '#78716c' }}>{a.segmento}</td>
                      <td style={{ padding: '8px 12px', color: '#44403c' }}>{a.entryTime}–{a.exitTime}</td>
                      <td style={{ padding: '8px 12px', color: '#78716c' }}>{a.contrato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.agents.length > 8 && (
                <p style={{ textAlign: 'center', fontSize: 11, color: '#a8a29e', padding: 8, margin: 0 }}>
                  …y {result.agents.length - 8} agentes más
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={onReset}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              color: '#78716c', background: '#fff', border: '1px solid #d4cfc5',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#1c1917'; e.currentTarget.style.borderColor = '#1c1917'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#78716c'; e.currentTarget.style.borderColor = '#d4cfc5'; }}
          >
            <X style={{ width: 16, height: 16 }} />
            Cargar otro archivo
          </button>
          <button
            onClick={onConfirm}
            disabled={!canProceed}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              color: '#f2ede4', background: canProceed ? '#1c1917' : '#d4cfc5',
              border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed',
              boxShadow: canProceed ? '0 4px 16px rgba(28,25,23,0.2)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <CheckCircle style={{ width: 16, height: 16 }} />
            Confirmar — {result.agents.length} agentes
          </button>
        </div>
      </div>
    </div>
  );
}
