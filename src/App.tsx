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
    <div className="h-screen flex flex-col" style={{ background: '#f2ede4' }}>
      {/* ── Top navbar ── */}
      <header className="h-13 shrink-0 px-6 flex items-center justify-between"
        style={{ background: '#1a1714', borderBottom: '1px solid #2c2520' }}
      >
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: '#f2ede4' }}>
            <Layers className="w-4 h-4" style={{ color: '#1a1714' }} />
          </div>
          <div className="leading-none">
            <span className="text-sm font-semibold text-white tracking-tight">Box Assignment</span>
            <span className="block text-[10px] font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>Sistema de Asignación</span>
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
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{ color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
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
    <div className="h-full flex bg-slate-950">
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Reglas de Asignación</h2>
            <p className="text-slate-400 mt-1 text-sm">Configura cómo se asignan los agentes a los boxes.</p>
          </div>
          <RulesPanel />
        </div>
      </div>
      <div className="w-80 border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto">
        <StatsPanel />
      </div>
    </div>
  );
}

function ConfigView() {
  return (
    <div className="h-full flex bg-slate-950">
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-xl mx-auto">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white">Configuración</h2>
            <p className="text-slate-400 mt-1 text-sm">Parámetros generales del sistema de asignación.</p>
          </div>
          <ConfigPanel />
        </div>
      </div>
      <div className="w-80 border-l border-slate-800 bg-slate-900 p-4 overflow-y-auto">
        <StatsPanel />
      </div>
    </div>
  );
}
