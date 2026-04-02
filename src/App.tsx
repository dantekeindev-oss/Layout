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
    <div className="h-screen flex flex-col bg-slate-950">
      {/* ── Top navbar ── */}
      <header className="h-14 shrink-0 bg-slate-900 border-b border-slate-800 px-5 flex items-center justify-between shadow-xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold text-white tracking-tight">Box Assignment</span>
            <span className="block text-[10px] text-slate-500 font-medium">Sistema de Asignación</span>
          </div>
        </div>

        {/* Nav */}
        {agents.length > 0 && (
          <nav className="flex items-center gap-1">
            {[
              { view: 'layout' as ViewType, icon: <LayoutGrid className="w-4 h-4" />, label: 'Layout' },
              { view: 'table'  as ViewType, icon: <Table className="w-4 h-4" />,       label: 'Tabla' },
              { view: 'rules'  as ViewType, icon: <Settings className="w-4 h-4" />,    label: 'Reglas' },
              { view: 'config' as ViewType, icon: <BarChart3 className="w-4 h-4" />,   label: 'Config' },
            ].map(({ view, icon, label }) => (
              <button
                key={view}
                onClick={() => setUiState({ currentView: view })}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  currentView === view
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </nav>
        )}

        {/* Right actions */}
        {agents.length > 0 && (
          <button
            onClick={() => setUiState({ currentView: 'upload' })}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all border border-slate-700"
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
