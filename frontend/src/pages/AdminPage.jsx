import { useEffect, useState } from 'react';
import { Settings, Database, Link2, Bot, HardDrive, Users, Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { api } from '../api';
import { ROLES } from '../utils';

export default function AdminPage({ token, user }) {
  const [status, setStatus] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [bcStatus, setBcStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, o, bc] = await Promise.all([
          api.systemStatus(token),
          api.organizations(token),
          api.blockchainStatus(),
        ]);
        if (!active) return;
        setStatus(s);
        setOrgs(o);
        setBcStatus(bc);
      } catch (_) {}
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [token]);

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>;

  const DEMO_USERS = [
    { username: 'alpha.officer', role: 'BANK_KYC_OFFICER', org: 'Bank Alpha', name: 'Maya Stone' },
    { username: 'alpha.admin', role: 'BANK_ADMINISTRATOR', org: 'Bank Alpha', name: 'Alicia Lee' },
    { username: 'beta.investigator', role: 'BANK_FRAUD_INVESTIGATOR', org: 'Bank Beta', name: 'Daniel Cruz' },
    { username: 'beta.auditor', role: 'NETWORK_AUDITOR', org: 'Bank Beta', name: 'Priya Nair' },
    { username: 'gamma.auditor', role: 'NETWORK_AUDITOR', org: 'Bank Gamma', name: 'Ethan Park' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title text-xl flex items-center gap-2">
          <Settings className="w-5 h-5 text-brand-400" /> Administration &amp; System Status
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Organisation identities, user roles, and service health.
          Private keys, passwords, and sensitive configuration are never displayed here.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Organisations */}
        <div className="glass-card p-5">
          <h3 className="subsection-title flex items-center gap-2 mb-3">
            <Link2 className="w-4 h-4" /> Network Organisations
          </h3>
          {orgs.map((org) => (
            <div key={org.id} className={`mb-3 p-3 rounded-lg border ${org.is_active ? 'border-green-500/20 bg-green-500/5' : 'border-surface-600/30 bg-surface-700/20'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-gray-200">{org.name}</span>
                {org.is_active
                  ? <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Active</span>
                  : <span className="text-xs text-gray-500 flex items-center gap-1"><XCircle className="w-3 h-3" /> Inactive</span>}
              </div>
              <div className="text-xs text-gray-500 font-mono">{org.id}</div>
              <div className="text-xs text-gray-400 mt-0.5">{org.description}</div>
            </div>
          ))}
        </div>

        {/* User roles */}
        <div className="glass-card p-5">
          <h3 className="subsection-title flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" /> Demo Users &amp; Roles
          </h3>
          <p className="text-xs text-amber-400/80 mb-3">Passwords: username + !123!  —  Never expose real credentials.</p>
          {DEMO_USERS.map((u) => (
            <div key={u.username} className={`mb-2 p-2.5 rounded-lg bg-surface-700/30 border border-surface-600/30 ${u.username === user.username ? 'border-brand-500/40' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{u.name}</span>
                {u.username === user.username && <span className="text-xs text-brand-400">◀ you</span>}
              </div>
              <div className="text-xs text-gray-500 font-mono">{u.username}</div>
              <div className="text-xs text-gray-400">{u.org} · {ROLES[u.role] || u.role}</div>
            </div>
          ))}
        </div>

        {/* Service health */}
        <div className="glass-card p-5 space-y-4">
          <h3 className="subsection-title flex items-center gap-2">
            <Database className="w-4 h-4" /> Service Health
          </h3>
          <ServiceRow icon={Database} label="Database" value={status?.database || 'SQLite'} ok />
          <ServiceRow icon={Database} label="DB Health" value={status?.database_health || 'unknown'} ok={status?.database_health === 'ok'} />
          <ServiceRow icon={Bot} label="AI Detectors" value="SIMULATED" warn
            note="No real AI models are integrated. Results are manually entered simulated inputs." />
          <ServiceRow icon={HardDrive} label="Evidence Storage" value="LOCAL SIM" warn
            note="Evidence is stored locally as plaintext. Production would use encrypted object storage." />

          <div className="border-t border-surface-600/50 pt-3 space-y-2">
            <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider">Blockchain Adapter</h4>
            <div className="sim-badge w-full justify-center">⛓ SIMULATION — NOT A REAL BLOCKCHAIN</div>
            {bcStatus && (
              <>
                <ServiceRow icon={Link2} label="Mode" value={bcStatus.mode} warn />
                <ServiceRow icon={CheckCircle2} label="Ledger Ready" value={bcStatus.ledger_ready ? 'Yes' : 'No'} ok={bcStatus.ledger_ready} />
                <ServiceRow icon={Database} label="Transactions" value={bcStatus.transaction_count} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Auth policy */}
      <div className="glass-card p-5">
        <h3 className="subsection-title flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4" /> Authorization Policy Configuration
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-600/50">
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Action</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">KYC Officer</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Fraud Investigator</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Administrator</th>
                <th className="text-left py-2 px-3 text-gray-400 font-medium">Network Auditor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-600/30">
              {[
                ['Create verification session', '✅', '—', '—', '—'],
                ['Submit AI results', '✅', '—', '—', '—'],
                ['Create fraud case', '✅', '—', '✅', '—'],
                ['Share case', '✅ (originator only)', '—', '✅', '—'],
                ['Acknowledge / submit findings', '—', '✅', '—', '—'],
                ['Dispute case', '✅', '✅', '—', '—'],
                ['Resolve case', '✅ (originator)', '—', '✅', '—'],
                ['View case (shared)', '✅', '✅', '✅', '✅'],
                ['View audit trail', '✅', '✅', '✅', '✅'],
                ['Verify evidence', '✅', '✅', '✅', '✅'],
              ].map(([action, ...cells]) => (
                <tr key={action} className="hover:bg-surface-700/20">
                  <td className="py-2 px-3 text-gray-300">{action}</td>
                  {cells.map((cell, i) => (
                    <td key={i} className={`py-2 px-3 text-xs ${cell.startsWith('✅') ? 'text-green-400' : 'text-gray-600'}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">
          Permissions are enforced on the backend. The UI only shows controls permitted by the current user's role; 
          however, all requests are independently validated server-side.
        </p>
      </div>

      {/* Threats */}
      <div className="glass-card p-5">
        <h3 className="subsection-title flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Threat Model Summary
        </h3>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {[
            ['Malicious Insider', 'All case access is checked server-side against organisation membership. Append-only event log prevents silent modification.'],
            ['Compromised Credentials', 'Short-lived demo tokens. Production would use hardened IdP with MFA. Passwords use PBKDF2-SHA256.'],
            ['Fabricated Evidence', 'SHA-256 commitments link evidence to ledger events. Mismatched hashes are detected at verification time.'],
            ['Colluding Organisations', 'Access policy and endorsement policy limit which organisations can read or act on shared cases.'],
            ['Replayed Requests', 'Challenge nonces are generated per session. Production would add request signatures and idempotency keys.'],
            ['Inaccurate AI Outputs', 'AI results are labelled SIMULATED. Risk engine explicitly marks unavailable detectors and escalates to human review.'],
            ['Unauthorised Queries', 'Every case endpoint checks CaseParticipant membership before returning data. 403 on denied access.'],
            ['Customer Correlation', 'No PII, hashes of PII, or identifiers stored on-chain. Only opaque UUIDs and event metadata.'],
          ].map(([threat, mitigation]) => (
            <div key={threat} className="p-3 bg-surface-700/30 rounded-lg border border-surface-600/30">
              <div className="text-amber-400 font-medium text-xs mb-1">{threat}</div>
              <div className="text-gray-400 text-xs leading-relaxed">{mitigation}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ServiceRow({ icon: Icon, label, value, ok, warn, note }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Icon className="w-4 h-4" />
          {label}
        </div>
        <span className={ok ? 'text-green-400' : warn ? 'text-amber-400' : 'text-gray-300'}>{String(value)}</span>
      </div>
      {note && <p className="text-xs text-gray-600 ml-6">{note}</p>}
    </div>
  );
}
