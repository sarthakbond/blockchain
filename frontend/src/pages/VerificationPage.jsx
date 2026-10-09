import { useState } from 'react';
import { FlaskConical, Plus, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { api } from '../api';
import { CHECK_NAMES, CASE_CATEGORIES, riskBadgeClass, checkStatusColor } from '../utils';


const DEFAULT_CHECKS = CHECK_NAMES.map((c) => ({
  name: c.key,
  label: c.label,
  status: 'UNAVAILABLE',
  risk_score: '',
  model_id: 'fusion-sim-v1',
  model_version: '1.0.0',
  explanation: '',
  reason_codes: '',
}));

export default function VerificationPage({ token, user }) {
  const [checks, setChecks] = useState(DEFAULT_CHECKS);
  const [sessionId, setSessionId] = useState('');
  const [method, setMethod] = useState('VIDEO_LIVENESS');
  const [verificationId, setVerificationId] = useState(null);
  const [riskResult, setRiskResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1=config, 2=results, 3=risk, 4=case
  const [caseCreated, setCaseCreated] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [caseForm, setCaseForm] = useState({ case_category: 'DEEPFAKE_FACE', summary: '' });

  const updateCheck = (name, field, value) => {
    setChecks((prev) => prev.map((c) => c.name === name ? { ...c, [field]: value } : c));
  };

  const handleCreateSession = async () => {
    setError('');
    setLoading(true);
    try {
      const sid = sessionId || `session-${Date.now()}`;
      const data = await api.createVerification(token, {
        session_identifier: sid,
        issuing_bank: user.organization_id,
        verification_method: method,
        consent_status: 'AUTHORIZED',
      });
      setVerificationId(data.id);
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitResults = async () => {
    setError('');
    setLoading(true);
    try {
      const results = checks.map((c) => ({
        name: c.name,
        status: c.status,
        risk_score: c.risk_score ? parseFloat(c.risk_score) : null,
        model_id: c.model_id,
        model_version: c.model_version,
        explanation: c.explanation,
        reason_codes: c.reason_codes ? c.reason_codes.split(',').map((r) => r.trim()).filter(Boolean) : [],
      }));
      await api.submitResults(token, verificationId, results);
      const risk = await api.calculateRisk(token, verificationId);
      setRiskResult(risk);
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCase = async () => {
    setError('');
    setLoading(true);
    try {
      const c = await api.createCase(token, {
        case_category: caseForm.case_category,
        risk_level: riskResult.overall_risk,
        summary: caseForm.summary || `Simulated KYC risk: ${riskResult.overall_risk}`,
        reason_codes: riskResult.rule_ids || [],
        verification_session_id: verificationId,
      });
      setCaseCreated(c);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setChecks(DEFAULT_CHECKS);
    setSessionId('');
    setVerificationId(null);
    setRiskResult(null);
    setCaseCreated(null);
    setStep(1);
    setError('');
  };

  const riskColor = {
    HIGH: 'text-red-400 border-red-500/30 bg-red-500/10',
    MEDIUM: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    LOW: 'text-green-400 border-green-500/30 bg-green-500/10',
    INDETERMINATE: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="section-title text-xl flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-brand-400" /> KYC Verification Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Create a synthetic verification session, enter simulated detector outputs, and generate a risk classification.
          </p>
        </div>
        <div className="sim-badge">⚗️ SIMULATED — NOT REAL AI</div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 text-sm">
        {['Session', 'Detector Inputs', 'Risk Assessment', 'Case'].map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all ${
              step === i + 1 ? 'bg-brand-600/30 border-brand-500/50 text-brand-300' :
              step > i + 1 ? 'bg-green-500/10 border-green-500/30 text-green-400' :
              'bg-surface-700/30 border-surface-600/30 text-gray-500'
            }`}>
              {step > i + 1 ? <CheckCircle2 className="w-3 h-3" /> : <span>{i + 1}</span>}
              {s}
            </div>
            {i < 3 && <div className="w-4 h-px bg-surface-600" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Step 1: Create session */}
      {step === 1 && (
        <div className="glass-card p-6 space-y-4 animate-slide-up">
          <h3 className="subsection-title">Step 1 — Create Verification Session</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="label-text">Session Identifier (optional)</label>
              <input className="input-field" placeholder="Auto-generated if empty" value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
            </div>
            <div>
              <label className="label-text">Verification Method</label>
              <select className="select-field" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="VIDEO_LIVENESS">Video Liveness</option>
                <option value="DOCUMENT_ONLY">Document Only</option>
                <option value="VOICE_CHALLENGE">Voice Challenge</option>
                <option value="PASSIVE_LIVENESS">Passive Liveness</option>
              </select>
            </div>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            A challenge nonce will be generated server-side. No PII is stored in the session record.
          </div>
          <button className="btn-primary" onClick={handleCreateSession} disabled={loading}>
            {loading ? 'Creating…' : 'Create Session'}
          </button>
        </div>
      )}

      {/* Step 2: Detector inputs */}
      {step === 2 && (
        <div className="glass-card p-6 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <h3 className="subsection-title">Step 2 — Enter Simulated Detector Results</h3>
            <div className="text-xs text-gray-500 font-mono">Session: {verificationId?.slice(0, 16)}…</div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>Results entered here are <strong>manually simulated inputs</strong>, not real AI predictions. Use UNAVAILABLE for unintegrated detectors.</span>
          </div>

          <div className="space-y-2">
            {checks.map((check) => {
              const isOpen = expanded[check.name];
              return (
                <div key={check.name} className="border border-surface-600/50 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [check.name]: !isOpen }))}
                    className="w-full flex items-center justify-between p-3 bg-surface-700/40 hover:bg-surface-700/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`status-badge border text-xs px-2 py-0.5 ${checkStatusColor(check.status)}`}>
                        {check.status}
                      </span>
                      <span className="text-sm text-gray-200">{check.label}</span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 grid md:grid-cols-2 gap-3 bg-surface-800/40">
                      <div>
                        <label className="label-text">Status</label>
                        <select className="select-field" value={check.status} onChange={(e) => updateCheck(check.name, 'status', e.target.value)}>
                          <option>UNAVAILABLE</option>
                          <option>PASS</option>
                          <option>REVIEW</option>
                          <option>FAIL</option>
                        </select>
                      </div>
                      <div>
                        <label className="label-text">Risk Score (0–1)</label>
                        <input type="number" step="0.01" min="0" max="1" className="input-field" placeholder="Optional" value={check.risk_score} onChange={(e) => updateCheck(check.name, 'risk_score', e.target.value)} />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label-text">Explanation</label>
                        <input className="input-field" value={check.explanation} onChange={(e) => updateCheck(check.name, 'explanation', e.target.value)} placeholder="Brief explanation…" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="label-text">Reason Codes (comma-separated)</label>
                        <input className="input-field" value={check.reason_codes} onChange={(e) => updateCheck(check.name, 'reason_codes', e.target.value)} placeholder="e.g. FACE_MANIPULATION_HIGH, LIVENESS_FAILURE" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-3">
            <button className="btn-secondary" onClick={reset}>Back</button>
            <button className="btn-primary" onClick={handleSubmitResults} disabled={loading}>
              {loading ? 'Calculating…' : 'Submit & Calculate Risk'}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Risk result */}
      {step === 3 && riskResult && (
        <div className="space-y-4 animate-slide-up">
          <div className={`glass-card p-6 border ${riskColor[riskResult.overall_risk] || riskColor.INDETERMINATE}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="subsection-title">Risk Assessment Result</h3>
              <span className={`text-2xl font-bold ${riskColor[riskResult.overall_risk]?.split(' ')[0]}`}>
                {riskResult.overall_risk}
              </span>
            </div>
            <p className="text-sm text-gray-300 mb-3">{riskResult.explanation}</p>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="label-text">Recommendation</p>
                <p className="text-gray-200 font-medium">{riskResult.recommendation}</p>
              </div>
              <div>
                <p className="label-text">Triggered Rules</p>
                <div className="flex flex-wrap gap-1">
                  {(riskResult.rule_ids || []).map((r) => (
                    <span key={r} className="px-2 py-0.5 bg-surface-700/60 rounded text-xs font-mono text-gray-300">{r}</span>
                  ))}
                </div>
              </div>
              {(riskResult.missing_checks || []).length > 0 && (
                <div className="md:col-span-2">
                  <p className="label-text text-amber-400">Missing / Unavailable Checks</p>
                  <div className="flex flex-wrap gap-1">
                    {riskResult.missing_checks.map((m) => (
                      <span key={m} className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">{m}</span>
                    ))}
                  </div>
                  <p className="text-xs text-amber-400/70 mt-1">Missing detectors do NOT count as passing checks.</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="subsection-title mb-3">Create Investigation Case</h3>
            <div className="grid md:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="label-text">Case Category</label>
                <select className="select-field" value={caseForm.case_category} onChange={(e) => setCaseForm((f) => ({ ...f, case_category: e.target.value }))}>
                  {CASE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label-text">Risk Level (auto-filled)</label>
                <input className="input-field opacity-60" readOnly value={riskResult.overall_risk} />
              </div>
              <div className="md:col-span-2">
                <label className="label-text">Summary</label>
                <textarea className="textarea-field" rows={2} value={caseForm.summary} onChange={(e) => setCaseForm((f) => ({ ...f, summary: e.target.value }))} placeholder={`Simulated KYC risk: ${riskResult.overall_risk}`} />
              </div>
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary" onClick={reset}>Start Over</button>
              <button className="btn-primary" onClick={handleCreateCase} disabled={loading}>
                <Plus className="w-4 h-4" /> {loading ? 'Creating…' : 'Create Case'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Case created */}
      {step === 4 && caseCreated && (
        <div className="glass-card p-6 text-center space-y-4 animate-slide-up">
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
          <h3 className="text-lg font-bold text-gray-100">Case Created Successfully</h3>
          <p className="text-sm text-gray-400">Case ID: <span className="font-mono text-brand-300">{caseCreated.id}</span></p>
          <p className="text-sm text-gray-400">Status: <span className="text-green-400">{caseCreated.status}</span></p>
          <p className="text-xs text-gray-500">Navigate to <strong>Fraud Cases</strong> to manage this case, share it with other banks, and track its lifecycle.</p>
          <button className="btn-secondary" onClick={reset}>Run Another Simulation</button>
        </div>
      )}
    </div>
  );
}
