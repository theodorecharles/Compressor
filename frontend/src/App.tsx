import React, { useState } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';

declare const __APP_VERSION__: string;
import Dashboard from './pages/Dashboard';
import Libraries from './pages/Libraries';
import Exclusions from './pages/Exclusions';
import Files from './pages/Files';
import Queue from './pages/Queue';
import TestEncode from './pages/TestEncode';

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

function App(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const closeSidebar = () => setSidebarOpen(false);

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '📊' },
    { to: '/libraries', label: 'Libraries', icon: '📁' },
    { to: '/exclusions', label: 'Exclusions', icon: '🚫' },
    { to: '/files', label: 'Files', icon: '🎬' },
    { to: '/queue', label: 'Queue', icon: '📋' },
    { to: '/test', label: 'Test Encode', icon: '🧪' },
  ];

  const currentPage = navItems.find(item => item.to === location.pathname)?.label || 'Compressor';

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center gap-3 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 text-slate-300 hover:bg-slate-700 rounded-md"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <img src="/icon.png" alt="Compressor" className="w-8 h-8" />
        <span className="text-green-500 font-semibold">{currentPage}</span>
      </div>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <nav className={`
        fixed md:static inset-y-0 left-0 z-50
        w-64 bg-slate-800 p-4 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
      `}>
        <div className="mb-8 flex items-center gap-3">
          <img src="/icon.png" alt="Compressor" className="w-10 h-10" />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-green-500">Compressor</h1>
            <p className="text-slate-400 text-xs">HEVC Transcoder</p>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={closeSidebar}
            className="p-2 text-slate-400 hover:bg-slate-700 rounded-md md:hidden"
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

        <div className="mt-auto pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs">
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
          <Route path="/test" element={<TestEncode />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
