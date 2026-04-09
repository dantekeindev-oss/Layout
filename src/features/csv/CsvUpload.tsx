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
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f6f6f6', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: '#111111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          }}>
            <Layers style={{ width: 26, height: 26, color: '#ffffff' }} />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', margin: 0 }}>
            Box Assignment
          </h1>
          <p style={{ color: '#aaaaaa', marginTop: 6, fontSize: 14, margin: '6px 0 0' }}>
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
            borderRadius: 14,
            border: `1.5px dashed ${dragOver ? '#111111' : '#d8d8d8'}`,
            padding: '44px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: dragOver ? 'rgba(17,17,17,0.03)' : '#ffffff',
            transition: 'all 0.18s ease',
            transform: dragOver ? 'scale(1.01)' : 'scale(1)',
          }}
        >
          {isProcessing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <svg style={{ width: 36, height: 36, color: '#111111', animation: 'spin 1s linear infinite' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle style={{ opacity: 0.15 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path style={{ opacity: 0.7 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p style={{ color: '#555555', fontWeight: 500, margin: 0, fontSize: 14 }}>Procesando archivo…</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: '#f5f5f5', border: '1px solid #e8e8e8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Upload style={{ width: 22, height: 22, color: '#888888' }} />
              </div>
              <div>
                <p style={{ color: '#111111', fontWeight: 600, fontSize: 15, margin: 0 }}>
                  {dragOver ? 'Suelta el archivo aquí' : 'Arrastrá o hacé clic para seleccionar'}
                </p>
                <p style={{ color: '#aaaaaa', fontSize: 13, margin: '5px 0 0' }}>CSV · Excel (.xlsx, .xls)</p>
              </div>
            </div>
          )}
        </div>

        {/* Column guide */}
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: '#ffffff', border: '1px solid #e8e8e8', borderRadius: 12,
        }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: '#bbbbbb', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 8px' }}>
            Columnas requeridas
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {['DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO', 'HORARIOS', 'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE'].map((col) => (
              <span key={col} style={{
                padding: '2px 7px',
                background: '#f5f5f5', border: '1px solid #e8e8e8',
                borderRadius: 5, fontSize: 11, fontFamily: 'monospace', color: '#444444', fontWeight: 600,
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
    { label: 'Filas totales',   value: result.stats.totalRows,       accent: '#555555' },
    { label: 'Agentes válidos', value: result.stats.validAgents,      accent: '#059669' },
    { label: 'Líderes',         value: result.stats.leadersDetected,  accent: '#d97706' },
    { label: 'Segmentos',       value: result.stats.segmentsDetected, accent: '#7c3aed' },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f6f6f6', padding: 24 }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', margin: 0 }}>
            Resultado del análisis
          </h1>
          <p style={{ color: '#aaaaaa', fontSize: 13, margin: '5px 0 0' }}>Revisá los datos antes de confirmar</p>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
          {statCards.map(({ label, value, accent }) => (
            <div key={label} style={{
              background: '#ffffff', border: '1px solid #e8e8e8',
              borderTop: `2px solid ${accent}`,
              borderRadius: 12, padding: 16, textAlign: 'center',
            }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 11, color: '#aaaaaa', fontWeight: 500, marginTop: 4 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* Errors */}
        {result.errors.length > 0 && (
          <div style={{
            marginBottom: 14, borderRadius: 12,
            border: '1px solid #fecaca', background: '#fef2f2', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: '1px solid #fecaca' }}>
              <AlertCircle style={{ width: 15, height: 15, color: '#dc2626' }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#dc2626' }}>Errores ({result.errors.length})</span>
            </div>
            <div style={{ padding: 10, maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {result.errors.slice(0, 10).map((e, i) => (
                <div key={i} style={{ fontSize: 11, color: '#dc2626', background: 'rgba(220,38,38,0.06)', borderRadius: 6, padding: '5px 10px' }}>
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
            marginBottom: 20, borderRadius: 12,
            border: '1px solid #e8e8e8', background: '#ffffff', overflow: 'hidden',
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>
                Vista previa — {result.agents.length} agentes
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa' }}>
                    {['Nombre', 'Usuario', 'Líder', 'Segmento', 'Horario', 'Contrato'].map((h) => (
                      <th key={h} style={{
                        padding: '7px 12px', textAlign: 'left',
                        fontWeight: 600, color: '#bbbbbb',
                        textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10,
                        borderBottom: '1px solid #f0f0f0',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.agents.slice(0, 8).map((a, idx) => (
                    <tr key={a.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 600, color: '#111111' }}>{a.nombre}</td>
                      <td style={{ padding: '7px 12px', color: '#888888', fontFamily: 'monospace', fontSize: 11 }}>{a.usuario}</td>
                      <td style={{ padding: '7px 12px', color: '#555555' }}>{a.jefe}</td>
                      <td style={{ padding: '7px 12px', color: '#888888' }}>{a.segmento}</td>
                      <td style={{ padding: '7px 12px', color: '#555555' }}>{a.entryTime}–{a.exitTime}</td>
                      <td style={{ padding: '7px 12px', color: '#888888' }}>{a.contrato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {result.agents.length > 8 && (
                <p style={{ textAlign: 'center', fontSize: 11, color: '#aaaaaa', padding: 8, margin: 0 }}>
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
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 14px', borderRadius: 9, fontSize: 13, fontWeight: 500,
              color: '#666666', background: '#ffffff', border: '1px solid #e8e8e8',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#111111'; e.currentTarget.style.borderColor = '#cccccc'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#666666'; e.currentTarget.style.borderColor = '#e8e8e8'; }}
          >
            <X style={{ width: 15, height: 15 }} />
            Cargar otro archivo
          </button>
          <button
            onClick={onConfirm}
            disabled={!canProceed}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '8px 18px', borderRadius: 9, fontSize: 13, fontWeight: 600,
              color: '#ffffff', background: canProceed ? '#111111' : '#d8d8d8',
              border: 'none', cursor: canProceed ? 'pointer' : 'not-allowed',
              boxShadow: canProceed ? '0 2px 12px rgba(0,0,0,0.14)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            <CheckCircle style={{ width: 15, height: 15 }} />
            Confirmar — {result.agents.length} agentes
          </button>
        </div>
      </div>
    </div>
  );
}
