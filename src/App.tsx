import { useEffect } from 'react';
import { useStore } from './store';
import { CsvUpload, LayoutView, TableView, StatsPanel, RulesPanel, ConfigPanel } from './features';
import { LayoutGrid, Table, Settings, BarChart3, Upload, Layers } from 'lucide-react';

type ViewType = 'upload' | 'layout' | 'table' | 'rules' | 'config';

export function App() {
  const { ui, agents, setUiState, loadFromStorage } = useStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const currentView = agents.length === 0 ? 'upload' : ui.currentView;

  const renderView = () => {
    switch (currentView) {
      case 'upload':  return <CsvUpload />;
      case 'layout':  return <LayoutView />;
      case 'table':   return <TableView />;
      case 'rules':   return <RulesView />;
      case 'config':  return <ConfigView />;
      default:        return <CsvUpload />;
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ background: '#f6f6f6' }}>
      {/* ── Top navbar ── */}
      <header
        className="h-12 shrink-0 px-5 flex items-center justify-between"
        style={{ background: '#111111', borderBottom: '1px solid #1f1f1f' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <Layers className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-semibold text-white tracking-tight">Box Assignment</span>
            <span className="block text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.3)' }}>Sistema de Asignación</span>
          </div>
        </div>

        {/* Nav */}
        {agents.length > 0 && (
          <nav className="flex items-center gap-0.5">
            {[
              { view: 'layout' as ViewType, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: 'Layout' },
              { view: 'table'  as ViewType, icon: <Table className="w-3.5 h-3.5" />,       label: 'Tabla' },
              { view: 'rules'  as ViewType, icon: <Settings className="w-3.5 h-3.5" />,    label: 'Reglas' },
              { view: 'config' as ViewType, icon: <BarChart3 className="w-3.5 h-3.5" />,   label: 'Config' },
            ].map(({ view, icon, label }) => (
              <button
                key={view}
                onClick={() => setUiState({ currentView: view })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  currentView === view
                    ? 'bg-white/12 text-white'
                    : 'text-white/35 hover:text-white/65 hover:bg-white/6'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Right */}
        {agents.length > 0 && (
          <button
            onClick={() => setUiState({ currentView: 'upload' })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.85)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            <Upload className="w-3.5 h-3.5" />
            Nueva nómina
          </button>
        )}
      </header>

      {/* ── Main ── */}
      <main className="flex-1 overflow-hidden">
        {renderView()}
      </main>
    </div>
  );
}

function RulesView() {
  return (
    <div style={{ height: '100%', display: 'flex', background: '#f6f6f6' }}>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', margin: 0 }}>
              Reglas de Asignación
            </h2>
            <p style={{ color: '#999999', marginTop: 4, fontSize: 13, margin: '4px 0 0' }}>
              Configura cómo se asignan los agentes a los boxes.
            </p>
          </div>
          <RulesPanel />
        </div>
      </div>
      <div style={{ width: 288, borderLeft: '1px solid #e8e8e8', background: '#f2f2f2', padding: 16, overflowY: 'auto' }}>
        <StatsPanel />
      </div>
    </div>
  );
}

function ConfigView() {
  return (
    <div style={{ height: '100%', display: 'flex', background: '#f6f6f6' }}>
      <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111111', letterSpacing: '-0.02em', margin: 0 }}>
              Configuración
            </h2>
            <p style={{ color: '#999999', marginTop: 4, fontSize: 13, margin: '4px 0 0' }}>
              Parámetros generales del sistema de asignación.
            </p>
          </div>
          <ConfigPanel />
        </div>
      </div>
      <div style={{ width: 288, borderLeft: '1px solid #e8e8e8', background: '#f2f2f2', padding: 16, overflowY: 'auto' }}>
        <StatsPanel />
      </div>
    </div>
  );
}
