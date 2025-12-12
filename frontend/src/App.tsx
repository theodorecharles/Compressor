import React, { useState } from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';

declare const __APP_VERSION__: string;
import Dashboard from './pages/Dashboard';
import Libraries from './pages/Libraries';
import Exclusions from './pages/Exclusions';
import Files from './pages/Files';
import Queue from './pages/Queue';
import TestEncode from './pages/TestEncode';
import Settings from './pages/Settings';

interface NavItemProps {
  to: string;
  label: string;
  icon: string;
  onClick?: () => void;
}

function NavItem({ to, label, icon, onClick }: NavItemProps): React.ReactElement {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
          isActive
            ? 'text-white'
            : 'text-neutral-400 hover:text-white hover:bg-white/5'
        }`
      }
      style={({ isActive }) => isActive ? {
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9), rgba(22, 163, 74, 0.8))',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 4px 20px rgba(34, 197, 94, 0.4), 0 0 40px rgba(34, 197, 94, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
      } : {
        border: '1px solid transparent'
      }}
    >
      <span className="text-lg">{icon}</span>
      <span className="font-semibold">{label}</span>
    </NavLink>
  );
}

function App(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/libraries', label: 'Libraries', icon: '📁' },
    { to: '/exclusions', label: 'Exclusions', icon: '🚫' },
    { to: '/files', label: 'Files', icon: '🎬' },
    { to: '/queue', label: 'Queue', icon: '📋' },
    { to: '/settings', label: 'Settings', icon: '⚙️' },
    { to: '/test', label: 'Test Encode', icon: '🧪' },
  ];

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile header */}
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-b from-neutral-800 to-neutral-800/95 px-4 py-3 flex items-center gap-3 md:hidden backdrop-blur-sm"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-neutral-300 hover:bg-white/10 rounded-lg transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/icon.png" alt="Compressor" className="w-8 h-8" />
        <span className="text-white font-semibold">Compressor</span>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <nav
        className={`
          fixed md:static inset-y-0 left-0 z-50
          w-64 p-4 flex flex-col
          transform transition-transform duration-300 ease-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        style={{
          background: 'linear-gradient(180deg, rgba(23, 23, 23, 0.98) 0%, rgba(10, 10, 10, 0.98) 100%)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '4px 0 30px rgba(0, 0, 0, 0.5)'
        }}
      >
        <div className="mb-8 flex items-center gap-3">
          <div className="relative">
            <img src="/icon.png" alt="Compressor" className="w-11 h-11" style={{ filter: 'drop-shadow(0 0 10px rgba(34, 197, 94, 0.5))' }} />
            <div className="absolute inset-0 rounded-full" style={{ background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)', animation: 'pulse-glow 3s ease-in-out infinite' }} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white" style={{ textShadow: '0 0 20px rgba(34, 197, 94, 0.5)' }}>Compressor</h1>
            <p className="text-neutral-500 text-xs font-medium tracking-wide">HEVC Transcoder</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={closeSidebar}
            className="p-2 text-neutral-400 hover:bg-white/10 hover:text-white rounded-xl transition-all md:hidden"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1.5">
          {navItems.map(item => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              onClick={closeSidebar}
            />
          ))}
        </div>

        <div className="mt-auto pt-4" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <p className="text-neutral-600 text-xs font-medium">
            v{__APP_VERSION__} &middot; FFmpeg + NVENC
          </p>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 overflow-y-auto pt-20 md:pt-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/libraries" element={<Libraries />} />
          <Route path="/exclusions" element={<Exclusions />} />
          <Route path="/files" element={<Files />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/test" element={<TestEncode />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
