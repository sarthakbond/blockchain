import { useEffect, useState, useCallback } from 'react';
import { Search, Filter, RefreshCw, AlertTriangle, ChevronRight, FileText, Clock, History } from 'lucide-react';
import { api } from '../api';
import { riskBadgeClass, statusColor, formatDate, formatDateLong, CASE_CATEGORIES, CASE_STATUSES, eventTypeIcon } from '../utils';

export default function CasesPage({ token, user }) {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseDetail, setCaseDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRisk, setFilterRisk] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [tab, setTab] = useState('details');

  const loadCases = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listCases(token);
      setCases(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadCases(); }, [loadCases]);

  const selectCase = async (c) => {
    setSelectedCase(c);
    setDetailLoading(true);
    setTab('details');
    try {
      const [detail, hist] = await Promise.all([
        api.getCase(token, c.id),
        api.getCaseHistory(token, c.id),
      ]);
      setCaseDetail(detail);
      setHistory(hist);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!selectedCase) return;
    await selectCase(selectedCase);
    await loadCases();
  };

  const filtered = cases.filter((c) => {
    if (search && !c.id.includes(search) && !c.case_category?.toLowerCase().includes(search.toLowerCase()) && !c.summary?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (filterRisk && c.risk_level !== filterRisk) return false;
    if (filterCat && c.case_category !== filterCat) return false;
    return true;
  });

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] animate-fade-in">
      {/* Left: Case list */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              className="input-field pl-9 text-sm"
              placeholder="Search cases…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button className="btn-ghost" onClick={loadCases} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          <select className="select-field text-xs flex-1" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {CASE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select-field text-xs flex-1" value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
            <option value="">All risks</option>
            {['LOW', 'MEDIUM', 'HIGH', 'INDETERMINATE'].map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {loading ? (
            <div className="text-gray-500 text-sm text-center py-8">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="text-gray-500 text-sm text-center py-8">No cases match your filters.</div>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectCase(c)}
                className={`w-full text-left p-3 rounded-lg border transition-all duration-150 ${
                  selectedCase?.id === c.id
                    ? 'bg-brand-600/20 border-brand-500/50'
                    : 'bg-surface-700/30 border-surface-600/30 hover:border-surface-500/50 hover:bg-surface-700/50'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-200 leading-tight">
                    {c.case_category?.replace(/_/g, ' ')}
                  </span>
                  <span className={riskBadgeClass(c.risk_level)}>{c.risk_level}</span>
                </div>
                <div className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs border mb-1 ${statusColor(c.status)}`}>
                  {c.status}
                </div>
                <p className="text-xs text-gray-500 truncate">{c.summary}</p>
                <p className="text-xs text-gray-600 mt-1">{c.originating_organization_name} · {formatDate(c.created_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right: Case detail */}
      <div className="flex-1 overflow-y-auto glass-card p-6">
        {!selectedCase ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
            <FileText className="w-12 h-12 opacity-30" />
            <p>Select a case to view details.</p>
          </div>
        ) : detailLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" /> Loading details…
          </div>
        ) : caseDetail ? (
          <div className="space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-100">{caseDetail.case_category?.replace(/_/g, ' ')}</h2>
                <p className="text-xs font-mono text-gray-500 mt-0.5">{caseDetail.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={riskBadgeClass(caseDetail.risk_level)}>{caseDetail.risk_level}</span>
                <span className={`status-badge border ${statusColor(caseDetail.status)}`}>{caseDetail.status}</span>
                <button className="btn-ghost" onClick={refreshDetail}><RefreshCw className="w-3.5 h-3.5" /></button>
              </div>
            </div>

            <p className="text-sm text-gray-300">{caseDetail.summary}</p>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-surface-600/50">
              {['details', 'history', 'audit'].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                    tab === t ? 'border-brand-500 text-brand-400' : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {t === 'audit' ? 'Audit Events' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'details' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid md:grid-cols-2 gap-3 text-sm">
                  <InfoItem label="Originating Bank" value={caseDetail.originating_organization_name} />
                  <InfoItem label="Access Policy" value={caseDetail.access_policy} />
                  <InfoItem label="Reason Codes">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(caseDetail.reason_codes || []).map((rc) => (
                        <span key={rc} className="px-2 py-0.5 bg-surface-700/60 rounded text-xs font-mono text-gray-300">{rc}</span>
                      ))}
                    </div>
                  </InfoItem>
                  <InfoItem label="Participants">
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(caseDetail.participants || []).map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-xs text-blue-300">{p}</span>
                      ))}
                    </div>
                  </InfoItem>
                  {caseDetail.evidence_commitment && (
                    <InfoItem label="Evidence Commitment" className="md:col-span-2">
                      <div className="font-mono text-xs text-gray-400 mt-1 break-all">{caseDetail.evidence_commitment}</div>
                    </InfoItem>
                  )}
                </div>
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3 animate-fade-in">
                {history.length === 0 ? (
                  <p className="text-gray-500 text-sm">No history events.</p>
                ) : (
                  <div className="relative">
                    <div className="absolute left-5 top-3 bottom-3 w-px bg-surface-600/50" />
                    {history.map((ev, idx) => (
                      <div key={ev.id} className="flex gap-4 relative">
                        <div className={`timeline-dot mt-1 z-10 ${
                          ev.event_type === 'RESOLVED' ? 'border-green-500 bg-green-500/30' :
                          ev.event_type === 'DISPUTED' ? 'border-red-500 bg-red-500/30' :
                          'border-brand-500 bg-brand-500/30'
                        }`} />
                        <div className={`flex-1 pb-4 ${idx === history.length - 1 ? '' : ''}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm">{eventTypeIcon(ev.event_type)}</span>
                            <span className="text-sm font-medium text-gray-200">{ev.event_type}</span>
                            <span className="text-xs text-gray-500">{ev.organization_id}</span>
                            <span className="text-xs text-gray-600">{formatDate(ev.timestamp)}</span>
                          </div>
                          {ev.previous_status && ev.new_status && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              {ev.previous_status} <ChevronRight className="w-3 h-3 inline" /> {ev.new_status}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">{ev.reason}</p>
                          {ev.transaction_ref && (
                            <p className="text-xs font-mono text-gray-600 mt-0.5">tx: {ev.transaction_ref}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'audit' && (
              <CaseAuditTab token={token} caseId={caseDetail.id} />
            )}

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> {error}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InfoItem({ label, value, children, className = '' }) {
  return (
    <div className={className}>
      <p className="text-xs text-gray-500">{label}</p>
      {children || <p className="text-sm text-gray-200 font-medium mt-0.5">{value || '—'}</p>}
    </div>
  );
}

function CaseAuditTab({ token, caseId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCaseAudit(token, caseId)
      .then(setEvents)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token, caseId]);

  if (loading) return <div className="text-gray-500 text-sm">Loading audit events…</div>;

  return (
    <div className="space-y-2 animate-fade-in">
      {events.length === 0 ? (
        <p className="text-gray-500 text-sm">No audit events.</p>
      ) : (
        events.map((ev) => (
          <div key={ev.id} className="p-3 bg-surface-700/30 rounded-lg border border-surface-600/30 text-xs">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="font-medium text-gray-200">{eventTypeIcon(ev.event_type)} {ev.event_type}</span>
              <span className="text-gray-500">{formatDate(ev.created_at)}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <span>{ev.organization_id}</span>
              {ev.transaction_id && (
                <span className="font-mono text-gray-600">tx: {ev.transaction_id?.slice(0, 20)}…</span>
              )}
            </div>
            {ev.evidence_commitment && (
              <div className="mt-1 text-gray-500">
                commitment: <span className="font-mono">{ev.evidence_commitment?.slice(0, 16)}…</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
