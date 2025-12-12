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
        `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-green-600 to-green-500 text-white shadow-lg shadow-green-500/20'
            : 'text-neutral-300 hover:bg-white/5 hover:text-white'
        }`
      }
      style={({ isActive }) => isActive ? {
        border: '1px solid rgba(255, 255, 255, 0.15)',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)'
      } : {
        border: '1px solid transparent'
      }}
    >
      <span>{icon}</span>
      <span className="font-medium">{label}</span>
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
          w-64 bg-gradient-to-b from-neutral-800 to-neutral-900 p-4 flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0
        `}
        style={{ borderRight: '1px solid rgba(255, 255, 255, 0.06)' }}
      >
        <div className="mb-8 flex items-center gap-3">
          <img src="/icon.png" alt="Compressor" className="w-10 h-10 drop-shadow-lg" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white drop-shadow-sm">Compressor</h1>
            <p className="text-neutral-500 text-xs">HEVC Transcoder</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={closeSidebar}
            className="p-2 text-neutral-400 hover:bg-white/10 hover:text-white rounded-lg transition-all md:hidden"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-1">
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
          <p className="text-neutral-600 text-xs">
            v{__APP_VERSION__} &middot; Powered by FFmpeg + NVENC
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
