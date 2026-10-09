import { useState, useCallback } from 'react';
import { Shield, LayoutDashboard, FlaskConical, FolderSearch, Users, BookOpen, Settings, LogOut, Menu, X, AlertTriangle, ChevronRight } from 'lucide-react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import VerificationPage from './pages/VerificationPage';
import CasesPage from './pages/CasesPage';
import CollaborationPage from './pages/CollaborationPage';
import AuditPage from './pages/AuditPage';
import AdminPage from './pages/AdminPage';
import { ROLES } from './utils';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'verification', label: 'KYC Simulator', icon: FlaskConical },
  { id: 'cases', label: 'Fraud Cases', icon: FolderSearch },
  { id: 'collaboration', label: 'Collaboration', icon: Users },
  { id: 'audit', label: 'Audit Explorer', icon: BookOpen },
  { id: 'admin', label: 'Administration', icon: Settings },
];

const ORG_BADGE = {
  'org-alpha': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'org-beta': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  'org-gamma': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('fusion-token') || '');
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('fusion-user') || 'null'); } catch { return null; }
  });
  const [page, setPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogin = useCallback((tok, usr) => {
    setToken(tok);
    setUser(usr);
    localStorage.setItem('fusion-token', tok);
    localStorage.setItem('fusion-user', JSON.stringify(usr));
    setPage('dashboard');
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('fusion-token');
    localStorage.removeItem('fusion-user');
    setToken('');
    setUser(null);
    setPage('dashboard');
  }, []);

  if (!user || !token) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const renderPage = () => {
    const props = { token, user };
    switch (page) {
      case 'dashboard': return <DashboardPage {...props} />;
      case 'verification': return <VerificationPage {...props} />;
      case 'cases': return <CasesPage {...props} />;
      case 'collaboration': return <CollaborationPage {...props} />;
      case 'audit': return <AuditPage {...props} />;
      case 'admin': return <AdminPage {...props} />;
      default: return <DashboardPage {...props} />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-56' : 'w-16'} flex-shrink-0 flex flex-col bg-surface-800/80 backdrop-blur-sm border-r border-surface-600/40 transition-all duration-200`}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-surface-600/40">
          <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <div className="font-bold text-gradient text-base leading-none">FUSION</div>
              <div className="text-xs text-gray-600 font-mono">v0.1 PROTOTYPE</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPage(id)}
              title={!sidebarOpen ? label : undefined}
              className={`w-full ${page === id ? 'nav-link-active' : 'nav-link'} ${!sidebarOpen ? 'justify-center px-2' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span className="truncate">{label}</span>}
              {sidebarOpen && page === id && <ChevronRight className="w-3 h-3 ml-auto flex-shrink-0" />}
            </button>
          ))}
        </nav>

        {/* User info */}
        <div className="px-2 py-3 border-t border-surface-600/40 space-y-2">
          {sidebarOpen && (
            <div className="px-3 py-2 space-y-1">
              <div className="text-sm font-medium text-gray-200 truncate">{user.display_name}</div>
              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs border ${ORG_BADGE[user.organization_id] || 'bg-gray-500/20 text-gray-300 border-gray-500/30'}`}>
                {user.organization_id}
              </div>
              <div className="text-xs text-gray-500">{ROLES[user.role] || user.role}</div>
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            title="Log out"
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all text-sm ${!sidebarOpen ? 'justify-center' : ''}`}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {sidebarOpen && 'Log out'}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute bottom-20 -right-3 w-6 h-6 bg-surface-700 border border-surface-600 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-surface-600 transition-all z-10"
        >
          {sidebarOpen ? <X className="w-3 h-3" /> : <Menu className="w-3 h-3" />}
        </button>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {/* Top banner */}
        <div className="sticky top-0 z-10 bg-surface-800/90 backdrop-blur-sm border-b border-surface-600/40 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-300 capitalize">{page.replace(/([A-Z])/g, ' $1')}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="sim-badge text-xs hidden sm:flex">
                <AlertTriangle className="w-3 h-3" />
                SIMULATION — NOT A REAL BLOCKCHAIN
              </div>
              <div className="text-xs text-gray-500 hidden md:block font-mono">{user.username}</div>
            </div>
          </div>
        </div>

        <div className="p-6">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}
