import { Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Libraries from './pages/Libraries';
import Exclusions from './pages/Exclusions';
import Files from './pages/Files';
import Queue from './pages/Queue';
import TestEncode from './pages/TestEncode';

function App() {
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav className="w-64 bg-slate-800 p-4 flex flex-col">
        <div className="mb-8 flex items-center gap-3">
          <img src="/icon.png" alt="Compressor" className="w-10 h-10" />
          <div>
            <h1 className="text-xl font-bold text-green-500">Compressor</h1>
            <p className="text-slate-400 text-xs">HEVC Transcoder</p>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <NavItem to="/" label="Dashboard" icon="📊" />
          <NavItem to="/libraries" label="Libraries" icon="📁" />
          <NavItem to="/exclusions" label="Exclusions" icon="🚫" />
          <NavItem to="/files" label="Files" icon="🎬" />
          <NavItem to="/queue" label="Queue" icon="📋" />
          <NavItem to="/test" label="Test Encode" icon="🧪" />
        </div>

        <div className="mt-auto pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">
            Powered by FFmpeg + NVENC
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-auto">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/libraries" element={<Libraries />} />
          <Route path="/exclusions" element={<Exclusions />} />
          <Route path="/files" element={<Files />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/test" element={<TestEncode />} />
        </Routes>
      </main>
    </div>
  );
}

function NavItem({ to, label, icon }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-2 rounded-md transition-colors ${
          isActive
            ? 'bg-green-600 text-white'
            : 'text-slate-300 hover:bg-slate-700'
        }`
      }
    >
      <span>{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default App;
