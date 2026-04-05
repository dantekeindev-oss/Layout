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
    <div className="h-screen flex flex-col" style={{ background: '#050816' }}>
      {/* ── Top navbar ── */}
      <header className="h-14 shrink-0 px-5 flex items-center justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, #050816 0%, #0a0f2e 50%, #050816 100%)',
          borderBottom: '1px solid rgba(0,212,255,0.2)',
          boxShadow: '0 1px 20px rgba(0,212,255,0.08)',
        }}
      >
        {/* scan line animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,255,0.04) 50%, transparent 100%)',
            animation: 'scan-line 4s linear infinite',
          }} />
        </div>

        {/* Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #00d4ff22, #7c3aed44)',
              border: '1px solid rgba(0,212,255,0.4)',
              boxShadow: '0 0 12px rgba(0,212,255,0.3)',
            }}
          >
            <Layers className="w-4 h-4" style={{ color: '#00d4ff' }} />
          </div>
          <div className="leading-none">
            <span className="text-sm font-bold tracking-tight animate-neon-flicker" style={{ color: '#00d4ff', textShadow: '0 0 10px rgba(0,212,255,0.6)' }}>
              Box Assignment
            </span>
            <span className="block text-[10px] font-medium" style={{ color: 'rgba(0,212,255,0.4)' }}>
              Sistema de Asignación
            </span>
          </div>
        </div>

        {/* Nav */}
        {agents.length > 0 && (
          <nav className="flex items-center gap-1 relative z-10">
            {[
              { view: 'layout' as ViewType, icon: <LayoutGrid className="w-4 h-4" />, label: 'Layout' },
              { view: 'table'  as ViewType, icon: <Table className="w-4 h-4" />,       label: 'Tabla' },
              { view: 'rules'  as ViewType, icon: <Settings className="w-4 h-4" />,    label: 'Reglas' },
              { view: 'config' as ViewType, icon: <BarChart3 className="w-4 h-4" />,   label: 'Config' },
            ].map(({ view, icon, label }) => (
              <button
                key={view}
                onClick={() => setUiState({ currentView: view })}
                style={currentView === view ? {
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.15))',
                  border: '1px solid rgba(0,212,255,0.4)',
                  color: '#00d4ff',
                  boxShadow: '0 0 10px rgba(0,212,255,0.2)',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  color: 'rgba(148,163,184,0.7)',
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all hover:border-cyan-800 hover:text-slate-200"
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all relative z-10"
            style={{
              border: '1px solid rgba(148,163,184,0.2)',
              color: 'rgba(148,163,184,0.6)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
              e.currentTarget.style.color = '#00d4ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(148,163,184,0.2)';
              e.currentTarget.style.color = 'rgba(148,163,184,0.6)';
            }}
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
