import { useState } from 'react';
import { Shield, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { api } from '../api';

const DEMO_ACCOUNTS = [
  { username: 'alpha.officer', password: 'alpha.officer!123!', label: 'Bank Alpha — KYC Officer', role: 'BANK_KYC_OFFICER', org: 'Bank Alpha', color: 'border-blue-500/40 hover:border-blue-400/60 hover:bg-blue-500/5' },
  { username: 'alpha.admin', password: 'alpha.admin!123!', label: 'Bank Alpha — Administrator', role: 'BANK_ADMINISTRATOR', org: 'Bank Alpha', color: 'border-blue-500/40 hover:border-blue-400/60 hover:bg-blue-500/5' },
  { username: 'beta.investigator', password: 'beta.investigator!123!', label: 'Bank Beta — Fraud Investigator', role: 'BANK_FRAUD_INVESTIGATOR', org: 'Bank Beta', color: 'border-purple-500/40 hover:border-purple-400/60 hover:bg-purple-500/5' },
  { username: 'beta.auditor', password: 'beta.auditor!123!', label: 'Bank Beta — Network Auditor', role: 'NETWORK_AUDITOR', org: 'Bank Beta', color: 'border-purple-500/40 hover:border-purple-400/60 hover:bg-purple-500/5' },
  { username: 'gamma.auditor', password: 'gamma.auditor!123!', label: 'Bank Gamma — Network Auditor', role: 'NETWORK_AUDITOR', org: 'Bank Gamma', color: 'border-teal-500/40 hover:border-teal-400/60 hover:bg-teal-500/5' },
];

export default function LoginPage({ onLogin }) {
  const [form, setForm] = useState({ username: 'alpha.officer', password: 'alpha.officer!123!' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.login(form.username, form.password);
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = async (account) => {
    setForm({ username: account.username, password: account.password });
    setError('');
    setLoading(true);
    try {
      const data = await api.login(account.username, account.password);
      onLogin(data.access_token, data.user);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-900/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 relative z-10 animate-fade-in">
        {/* Left: Branding */}
        <div className="flex flex-col justify-center gap-6 md:pr-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-500 to-purple-600 rounded-xl flex items-center justify-center glow-blue">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gradient">FUSION</h1>
                <p className="text-xs text-gray-500 font-mono">v0.1 — PROTOTYPE</p>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-gray-100 leading-tight mb-3">
              Permissioned KYC Fraud Intelligence
            </h2>
            <p className="text-gray-400 leading-relaxed">
              A cross-bank investigation platform where AI detects deepfake and fraud signals, 
              and blockchain provides shared trust, authorization, and tamper-evident audit history.
            </p>
          </div>

          <div className="space-y-2">
            {[
              'Deepfake and liveness detection results',
              'Multi-bank fraud case coordination',
              'Tamper-evident event audit trail',
              'Configurable risk classification engine',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-400">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <strong className="block">DEMO PROTOTYPE — NOT FOR PRODUCTION USE</strong>
              Uses synthetic data, simulated AI outputs, and a local blockchain simulator.
              The blockchain ledger label reads: <span className="font-mono">"SIMULATION — NOT A REAL BLOCKCHAIN"</span>
            </div>
          </div>
        </div>

        {/* Right: Login form + quick accounts */}
        <div className="space-y-4">
          <div className="glass-card p-6 animate-slide-up">
            <h3 className="section-title mb-4">Sign in</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-text">Username</label>
                <input
                  id="login-username"
                  type="text"
                  className="input-field"
                  value={form.username}
                  autoComplete="username"
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                />
              </div>
              <div>
                <label className="label-text">Password</label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input-field pr-10"
                    value={form.password}
                    autoComplete="current-password"
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Authenticating…
                  </span>
                ) : 'Sign in'}
              </button>
            </form>
          </div>

          <div className="glass-card p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick demo accounts</p>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  type="button"
                  onClick={() => quickLogin(acc)}
                  disabled={loading}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 text-sm disabled:opacity-50 ${acc.color}`}
                >
                  <div className="font-medium text-gray-200">{acc.label}</div>
                  <div className="text-xs text-gray-500 font-mono mt-0.5">{acc.username}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
