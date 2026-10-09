import { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle, Clock, FileSearch,
  BarChart3, TrendingUp, Users, ShieldAlert,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { api } from '../api';
import { riskBadgeClass, statusColor, formatDate } from '../utils';

const PIE_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DashboardPage({ token, user }) {
  const [status, setStatus] = useState(null);
  const [cases, setCases] = useState([]);
  const [bcStatus, setBcStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [s, c, bc] = await Promise.all([
          api.systemStatus(token),
          api.listCases(token),
          api.blockchainStatus(),
        ]);
        if (!active) return;
        setStatus(s);
        setCases(c);
        setBcStatus(bc);
      } catch (_) {}
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400 flex items-center gap-3">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading dashboard…
        </div>
      </div>
    );
  }

  // Compute metrics from live cases
  const highRisk = cases.filter((c) => c.risk_level === 'HIGH').length;
  const needsReview = cases.filter((c) =>
    ['CREATED', 'SHARED', 'ACKNOWLEDGED', 'NEEDS_MORE_INFORMATION', 'ESCALATED'].includes(c.status)
  ).length;
  const crossBank = cases.filter((c) => c.participants?.length > 1).length;
  const awaiting = cases.filter((c) => ['SHARED', 'ACKNOWLEDGED'].includes(c.status)).length;
  const resolved = cases.filter((c) => ['RESOLVED', 'CLOSED_WITHOUT_FINDING'].includes(c.status)).length;

  // Bar chart: cases by category
  const catCounts = {};
  cases.forEach((c) => {
    const k = c.case_category?.replace(/_/g, ' ') || 'OTHER';
    catCounts[k] = (catCounts[k] || 0) + 1;
  });
  const categoryData = Object.entries(catCounts).map(([name, value]) => ({ name: name.split(' ').slice(0, 2).join(' '), value }));

  // Pie: risk distribution
  const riskDist = { LOW: 0, MEDIUM: 0, HIGH: 0, INDETERMINATE: 0 };
  cases.forEach((c) => { riskDist[c.risk_level] = (riskDist[c.risk_level] || 0) + 1; });
  const riskData = Object.entries(riskDist).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  const recentCases = [...cases].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  const statCards = [
    { label: 'Verification Sessions', value: status?.verification_session_count ?? 0, icon: FileSearch, color: 'text-blue-400' },
    { label: 'Cases Needing Review', value: needsReview, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'High Risk Cases', value: highRisk, icon: ShieldAlert, color: 'text-red-400' },
    { label: 'Cross-Bank Investigations', value: crossBank, icon: Users, color: 'text-purple-400' },
    { label: 'Awaiting Response', value: awaiting, icon: Clock, color: 'text-orange-400' },
    { label: 'Resolved Cases', value: resolved, icon: CheckCircle, color: 'text-green-400' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title text-xl mb-1">Overview Dashboard</h1>
        <p className="text-sm text-gray-500">
          {user.display_name} · {user.role.replace(/_/g, ' ')} · {user.organization_id}
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="stat-card">
            <Icon className={`w-5 h-5 ${color} mb-1`} />
            <div className="text-2xl font-bold text-gray-100">{value}</div>
            <div className="text-xs text-gray-500 leading-tight">{label}</div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <h3 className="subsection-title mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> Cases by Category
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={categoryData} margin={{ top: 0, right: 0, left: -20, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} angle={-30} textAnchor="end" />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5">
          <h3 className="subsection-title mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Risk Distribution
          </h3>
          {riskData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={riskData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {riskData.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[['LOW', 'MEDIUM', 'HIGH', 'INDETERMINATE'].indexOf(entry.name)] || PIE_COLORS[i % 4]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, color: '#f3f4f6' }} />
                <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No cases yet</div>
          )}
        </div>
      </div>

      {/* Recent cases + blockchain status */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 glass-card p-5">
          <h3 className="subsection-title mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Recent Cases
          </h3>
          {recentCases.length === 0 ? (
            <p className="text-gray-500 text-sm">No cases yet.</p>
          ) : (
            <div className="space-y-2">
              {recentCases.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-700/40 border border-surface-600/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-200 truncate">
                        {c.case_category?.replace(/_/g, ' ')}
                      </span>
                      <span className={`status-badge border text-xs ${statusColor(c.status)}`}>{c.status}</span>
                      <span className={riskBadgeClass(c.risk_level)}>{c.risk_level}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">
                      {c.originating_organization_name} · {formatDate(c.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5 space-y-4">
          <h3 className="subsection-title flex items-center gap-2">
            <Activity className="w-4 h-4" /> System Status
          </h3>
          {status && (
            <div className="space-y-2 text-sm">
              <InfoRow label="Database" value={status.database} ok />
              <InfoRow label="DB Health" value={status.database_health} ok />
              <InfoRow label="Organisations" value={status.organization_count} />
              <InfoRow label="Verifications" value={status.verification_session_count} />
              <InfoRow label="Cases" value={status.case_count} />
              <InfoRow label="AI Detectors" value="SIMULATED" warn />
              <InfoRow label="Evidence Store" value="LOCAL SIM" warn />
            </div>
          )}
          {bcStatus && (
            <div className="pt-2 border-t border-surface-600/50 space-y-2 text-sm">
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Blockchain</p>
              <div className="sim-badge w-full justify-center text-center">⛓ SIMULATION — NOT A REAL BLOCKCHAIN</div>
              <InfoRow label="Mode" value={bcStatus.mode} warn />
              <InfoRow label="Transactions" value={bcStatus.transaction_count} />
              <InfoRow label="Ledger" value={bcStatus.ledger_ready ? 'Ready' : 'Error'} ok={bcStatus.ledger_ready} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, ok, warn }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className={ok ? 'text-green-400' : warn ? 'text-amber-400' : 'text-gray-300'}>
        {String(value)}
      </span>
    </div>
  );
}
