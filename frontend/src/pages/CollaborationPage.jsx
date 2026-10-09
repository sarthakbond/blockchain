import { useEffect, useState, useCallback } from 'react';
import { Users, Share2, MessageSquare, AlertTriangle, CheckCircle2, ArrowUpCircle, XCircle, RefreshCw } from 'lucide-react';
import { api } from '../api';
import { riskBadgeClass, statusColor, formatDate, eventTypeIcon } from '../utils';

export default function CollaborationPage({ token, user }) {
  const [cases, setCases] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [shareOrgId, setShareOrgId] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [activeAction, setActiveAction] = useState(null); // 'share' | 'findings' | 'dispute' | 'resolve' | 'escalate' | 'request'

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, o] = await Promise.all([api.listCases(token), api.organizations(token)]);
      setCases(c);
      setOrgs(o);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectCase = async (c) => {
    setSelected(c);
    setDetail(null);
    setHistory([]);
    setError('');
    setSuccess('');
    setActiveAction(null);
    try {
      const [d, h] = await Promise.all([
        api.getCase(token, c.id),
        api.getCaseHistory(token, c.id),
      ]);
      setDetail(d);
      setHistory(h);
    } catch (err) {
      setError(err.message);
    }
  };

  const performAction = async () => {
    setError('');
    setSuccess('');
    setActionLoading(true);
    try {
      switch (activeAction) {
        case 'share':
          await api.shareCase(token, selected.id, shareOrgId, 'BANK_FRAUD_INVESTIGATOR');
          setSuccess(`Case shared with ${orgs.find(o => o.id === shareOrgId)?.name}.`);
          break;
        case 'acknowledge':
          await api.acknowledgeCase(token, selected.id, actionReason || 'Acknowledged.');
          setSuccess('Case acknowledged.');
          break;
        case 'findings':
          await api.submitFindings(token, selected.id, actionReason || 'Findings submitted.', 'UNDER_REVIEW', {});
          setSuccess('Findings submitted. Case set to UNDER_REVIEW.');
          break;
        case 'request':
          await api.requestInformation(token, selected.id, actionReason || 'Additional information requested.');
          setSuccess('Information request recorded.');
          break;
        case 'dispute':
          await api.disputeCase(token, selected.id, actionReason || 'Finding disputed.');
          setSuccess('Dispute recorded.');
          break;
        case 'escalate':
          await api.escalateCase(token, selected.id, actionReason || 'Case escalated.');
          setSuccess('Case escalated.');
          break;
        case 'resolve':
          await api.resolveCase(token, selected.id, actionReason || 'Case resolved.');
          setSuccess('Case resolved.');
          break;
        default:
          break;
      }
      setActiveAction(null);
      setActionReason('');
      await loadData();
      await selectCase(selected);
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const isOriginator = detail && detail.organization_id === user.organization_id;
  const isParticipant = detail && detail.participants?.includes(user.organization_id);
  const canAct = isOriginator || isParticipant;

  const shareableOrgs = orgs.filter(
    (o) => o.id !== user.organization_id && !detail?.participants?.includes(o.id) && o.is_active
  );

  const ACTIONS = [
    { key: 'share', label: 'Share', icon: Share2, condition: isOriginator && shareableOrgs.length > 0, color: 'btn-primary' },
    { key: 'acknowledge', label: 'Acknowledge', icon: CheckCircle2, condition: !isOriginator && canAct, color: 'btn-secondary' },
    { key: 'findings', label: 'Submit Findings', icon: MessageSquare, condition: canAct, color: 'btn-secondary' },
    { key: 'request', label: 'Request Info', icon: RefreshCw, condition: canAct, color: 'btn-secondary' },
    { key: 'dispute', label: 'Dispute', icon: XCircle, condition: canAct, color: 'btn-danger' },
    { key: 'escalate', label: 'Escalate', icon: ArrowUpCircle, condition: canAct, color: 'btn-secondary' },
    { key: 'resolve', label: 'Resolve', icon: CheckCircle2, condition: isOriginator || ['BANK_ADMINISTRATOR', 'NETWORK_AUDITOR'].includes(user.role), color: 'btn-primary' },
  ];

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)] animate-fade-in">
      {/* Case list */}
      <div className="w-72 flex-shrink-0 overflow-y-auto space-y-2 pr-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Cases</h2>
          <button className="btn-ghost" onClick={loadData}><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>
        {loading ? (
          <div className="text-gray-500 text-sm text-center py-8">Loading…</div>
        ) : cases.map((c) => (
          <button
            key={c.id}
            onClick={() => selectCase(c)}
            className={`w-full text-left p-3 rounded-lg border transition-all duration-150 ${
              selected?.id === c.id
                ? 'bg-brand-600/20 border-brand-500/50'
                : 'bg-surface-700/30 border-surface-600/30 hover:border-surface-500/50'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-gray-200">{c.case_category?.replace(/_/g, ' ')}</span>
              <span className={riskBadgeClass(c.risk_level)}>{c.risk_level}</span>
            </div>
            <div className={`inline-flex px-1.5 py-0.5 rounded text-xs border ${statusColor(c.status)}`}>{c.status}</div>
            <p className="text-xs text-gray-500 mt-1">{c.originating_organization_name}</p>
            <p className="text-xs text-gray-600">{formatDate(c.created_at)}</p>
          </button>
        ))}
      </div>

      {/* Detail + Actions */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {!selected ? (
          <div className="glass-card p-12 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Select a case to collaborate on it.</p>
          </div>
        ) : (
          <>
            {/* Case header */}
            <div className="glass-card p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-100">{detail?.case_category?.replace(/_/g, ' ')}</h2>
                  <p className="text-xs font-mono text-gray-500">{selected.id}</p>
                </div>
                <div className="flex items-center gap-2">
                  {detail && <span className={riskBadgeClass(detail.risk_level)}>{detail.risk_level}</span>}
                  {detail && <span className={`status-badge border ${statusColor(detail.status)}`}>{detail.status}</span>}
                </div>
              </div>
              <p className="text-sm text-gray-300">{detail?.summary}</p>
              {detail && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
                  <span>Originator: <strong className="text-gray-200">{detail.originating_organization_name}</strong></span>
                  <span>·</span>
                  <span>Participants: <strong className="text-gray-200">{detail.participants?.join(', ')}</strong></span>
                </div>
              )}
            </div>

            {/* Action toolbar */}
            <div className="glass-card p-4">
              <h3 className="subsection-title mb-3">Actions</h3>
              {!canAct && (
                <div className="text-sm text-gray-500">Your organisation does not have permission to act on this case.</div>
              )}
              <div className="flex flex-wrap gap-2 mb-3">
                {ACTIONS.filter((a) => a.condition).map(({ key, label, icon: Icon, color }) => (
                  <button
                    key={key}
                    className={`${color} text-sm`}
                    onClick={() => setActiveAction(activeAction === key ? null : key)}
                    disabled={actionLoading}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              {activeAction && (
                <div className="border border-surface-600/50 rounded-lg p-4 space-y-3 bg-surface-700/20">
                  <h4 className="text-sm font-medium text-gray-300 capitalize">{activeAction.replace(/_/g, ' ')}</h4>
                  {activeAction === 'share' && (
                    <div>
                      <label className="label-text">Share with organisation</label>
                      <select className="select-field" value={shareOrgId} onChange={(e) => setShareOrgId(e.target.value)}>
                        <option value="">Select…</option>
                        {shareableOrgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="label-text">Reason / Notes</label>
                    <textarea
                      className="textarea-field text-sm"
                      rows={2}
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      placeholder="Provide a brief reason for this action…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary text-sm" onClick={() => { setActiveAction(null); setActionReason(''); }}>Cancel</button>
                    <button className="btn-primary text-sm" onClick={performAction} disabled={actionLoading || (activeAction === 'share' && !shareOrgId)}>
                      {actionLoading ? 'Processing…' : 'Confirm'}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" /> {error}
                </div>
              )}
              {success && (
                <div className="mt-2 p-2.5 bg-green-500/10 border border-green-500/30 rounded-lg text-sm text-green-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> {success}
                </div>
              )}
            </div>

            {/* Timeline */}
            {history.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="subsection-title mb-4">Case Timeline</h3>
                <div className="relative">
                  <div className="absolute left-4 top-3 bottom-3 w-px bg-surface-600/50" />
                  {history.map((ev, idx) => (
                    <div key={ev.id} className="flex gap-4 pb-4 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 z-10 border ${
                        ev.event_type === 'RESOLVED' ? 'bg-green-500/20 border-green-500/50' :
                        ev.event_type === 'DISPUTED' ? 'bg-red-500/20 border-red-500/50' :
                        ev.event_type === 'ESCALATED' ? 'bg-rose-500/20 border-rose-500/50' :
                        'bg-brand-500/20 border-brand-500/50'
                      }`}>
                        {eventTypeIcon(ev.event_type)}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-200">{ev.event_type}</span>
                          <span className="text-xs text-gray-500">{ev.organization_id}</span>
                          <span className="text-xs text-gray-600">·</span>
                          <span className="text-xs text-gray-600">{formatDate(ev.timestamp)}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{ev.reason}</p>
                        {ev.transaction_ref && (
                          <p className="text-xs font-mono text-gray-600">tx: {ev.transaction_ref}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
