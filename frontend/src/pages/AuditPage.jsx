import { useEffect, useState, useCallback } from 'react';
import { BookOpen, ChevronRight, Hash, Shield, Search, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../api';
import { formatDate, formatDateLong, eventTypeIcon, statusColor, riskBadgeClass } from '../utils';

export default function AuditPage({ token }) {
  const [cases, setCases] = useState([]);
  const [selected, setSelected] = useState(null);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);

  // Evidence verification
  const [evidenceText, setEvidenceText] = useState('');
  const [expectedHash, setExpectedHash] = useState('');
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const c = await api.listCases(token);
      setCases(c);
    } catch (_) {}
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const selectCase = async (c) => {
    setSelected(c);
    setAuditEvents([]);
    setAuditLoading(true);
    setVerifyResult(null);
    try {
      const events = await api.getCaseAudit(token, c.id);
      setAuditEvents(events);
    } catch (_) {}
    finally { setAuditLoading(false); }
  };

  const handleVerify = async () => {
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const result = await api.verifyEvidence(token, evidenceText, expectedHash);
      setVerifyResult(result);
    } catch (err) {
      setVerifyResult({ error: err.message });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="section-title text-xl flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-brand-400" /> Blockchain Audit Explorer
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          View ledger events, transaction references, and verify evidence integrity.
        </p>
        <div className="mt-2 sim-badge inline-flex">⛓ SIMULATION — NOT A REAL BLOCKCHAIN</div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Case list */}
        <div className="glass-card p-4 space-y-2 overflow-y-auto max-h-[500px]">
          <h3 className="subsection-title mb-2">Cases</h3>
          {loading ? (
            <div className="text-gray-500 text-sm">Loading…</div>
          ) : cases.map((c) => (
            <button
              key={c.id}
              onClick={() => selectCase(c)}
              className={`w-full text-left p-2.5 rounded-lg border transition-all text-sm ${
                selected?.id === c.id
                  ? 'bg-brand-600/20 border-brand-500/50'
                  : 'bg-surface-700/30 border-surface-600/30 hover:border-surface-500/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <span className={riskBadgeClass(c.risk_level)}>{c.risk_level}</span>
                <span className={`status-badge border text-xs ${statusColor(c.status)}`}>{c.status}</span>
              </div>
              <span className="text-xs text-gray-300">{c.case_category?.replace(/_/g, ' ')}</span>
              <div className="text-xs text-gray-600 font-mono mt-0.5">{c.id?.slice(0, 20)}…</div>
            </button>
          ))}
        </div>

        {/* Audit event timeline */}
        <div className="md:col-span-2 glass-card p-5">
          {!selected ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <BookOpen className="w-10 h-10 opacity-30 mb-3" />
              <p className="text-sm">Select a case to explore its audit trail.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="subsection-title">Audit Trail</h3>
                <div className="text-xs font-mono text-gray-500">{selected.id}</div>
              </div>

              {auditLoading ? (
                <div className="text-gray-500 text-sm">Loading audit events…</div>
              ) : auditEvents.length === 0 ? (
                <div className="text-gray-500 text-sm">No audit events recorded.</div>
              ) : (
                <div className="space-y-3">
                  {auditEvents.map((ev) => (
                    <div key={ev.id} className="border border-surface-600/40 rounded-lg p-4 bg-surface-700/20 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{eventTypeIcon(ev.event_type)}</span>
                          <span className="text-sm font-semibold text-gray-200">{ev.event_type}</span>
                          <span className="text-xs text-gray-400">{ev.organization_id}</span>
                        </div>
                        <span className="text-xs text-gray-500">{formatDate(ev.created_at)}</span>
                      </div>

                      {ev.transaction_id && (
                        <div className="flex items-center gap-2 text-xs">
                          <Hash className="w-3.5 h-3.5 text-brand-400" />
                          <span className="text-gray-500">Transaction ID:</span>
                          <span className="font-mono text-brand-300">{ev.transaction_id}</span>
                        </div>
                      )}

                      {ev.evidence_commitment && (
                        <div className="flex items-center gap-2 text-xs">
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span className="text-gray-500">Evidence Commitment:</span>
                          <span className="font-mono text-purple-300 truncate">{ev.evidence_commitment}</span>
                        </div>
                      )}

                      {ev.verification_result && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">Risk Level:</span>
                          <span className={riskBadgeClass(ev.verification_result)}>{ev.verification_result}</span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 bg-surface-800/50 rounded p-2 font-mono">
                        {JSON.stringify(ev.details, null, 2)}
                      </div>

                      <div className="text-xs text-amber-400/70 flex items-center gap-1">
                        <span>⛓</span>
                        <span>Ledger status: <strong>SIMULATED</strong> — This is a local simulator record, not a live Hyperledger Fabric ledger entry.</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Evidence integrity verification */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="subsection-title flex items-center gap-2">
          <Shield className="w-4 h-4" /> Evidence Integrity Verification
        </h3>
        <p className="text-xs text-gray-500">
          Paste the original evidence text and its recorded SHA-256 commitment to verify integrity.
          A matching hash confirms the file matches the committed bytes; it does NOT prove that evidence is authentic or that fraud occurred.
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="label-text">Evidence Text / Content</label>
            <textarea
              className="textarea-field font-mono text-xs"
              rows={4}
              value={evidenceText}
              onChange={(e) => setEvidenceText(e.target.value)}
              placeholder="Paste evidence content here…"
            />
          </div>
          <div>
            <label className="label-text">Expected SHA-256 Commitment</label>
            <textarea
              className="textarea-field font-mono text-xs"
              rows={4}
              value={expectedHash}
              onChange={(e) => setExpectedHash(e.target.value)}
              placeholder="SHA-256 hash from ledger…"
            />
          </div>
        </div>
        <button className="btn-primary" onClick={handleVerify} disabled={verifyLoading || !evidenceText || !expectedHash}>
          <Search className="w-4 h-4" /> {verifyLoading ? 'Verifying…' : 'Verify Integrity'}
        </button>

        {verifyResult && !verifyResult.error && (
          <div className={`p-4 rounded-lg border ${verifyResult.verified ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {verifyResult.verified
                ? <CheckCircle2 className="w-5 h-5 text-green-400" />
                : <XCircle className="w-5 h-5 text-red-400" />}
              <span className={`font-semibold ${verifyResult.verified ? 'text-green-400' : 'text-red-400'}`}>
                {verifyResult.message}
              </span>
            </div>
            <div className="grid md:grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-gray-500">Expected: </span>
                <span className="text-gray-300 break-all">{verifyResult.expected_hash}</span>
              </div>
              <div>
                <span className="text-gray-500">Actual: </span>
                <span className="text-gray-300 break-all">{verifyResult.actual_hash}</span>
              </div>
            </div>
            {verifyResult.verified && (
              <p className="mt-2 text-xs text-green-400/70">
                ✓ The checked file matches the committed bytes. This does not prove evidence authenticity, correctness of AI decisions, or that fraud occurred.
              </p>
            )}
          </div>
        )}

        {verifyResult?.error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">{verifyResult.error}</div>
        )}
      </div>
    </div>
  );
}
