// FUSION API client — all requests routed through Vite proxy to backend

const BASE = '/api/v1';

function getHeaders(token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, token, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: getHeaders(token),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request('POST', '/auth/login', null, { username, password }),

  me: (token) => request('GET', '/auth/me', token),

  organizations: (token) => request('GET', '/organizations', token),

  systemStatus: (token) => request('GET', '/system/status', token),

  blockchainStatus: () => request('GET', '/blockchain/status', null),

  // Verifications
  createVerification: (token, payload) =>
    request('POST', '/verifications', token, payload),

  getVerification: (token, id) =>
    request('GET', `/verifications/${id}`, token),

  submitResults: (token, id, results) =>
    request('POST', `/verifications/${id}/results`, token, { results }),

  calculateRisk: (token, id) =>
    request('POST', `/verifications/${id}/calculate-risk`, token),

  // Cases
  createCase: (token, payload) =>
    request('POST', '/cases', token, payload),

  listCases: (token) => request('GET', '/cases', token),

  getCase: (token, id) => request('GET', `/cases/${id}`, token),

  shareCase: (token, id, organization_id, role) =>
    request('POST', `/cases/${id}/share`, token, { organization_id, role }),

  acknowledgeCase: (token, id, reason) =>
    request('POST', `/cases/${id}/acknowledge`, token, { reason }),

  submitFindings: (token, id, reason, new_status, payload) =>
    request('POST', `/cases/${id}/findings`, token, { reason, new_status, payload }),

  requestInformation: (token, id, reason) =>
    request('POST', `/cases/${id}/request-information`, token, { reason }),

  disputeCase: (token, id, reason) =>
    request('POST', `/cases/${id}/dispute`, token, { reason }),

  escalateCase: (token, id, reason) =>
    request('POST', `/cases/${id}/escalate`, token, { reason }),

  resolveCase: (token, id, reason) =>
    request('POST', `/cases/${id}/resolve`, token, { reason }),

  correctCase: (token, id, reason, payload) =>
    request('POST', `/cases/${id}/correct`, token, { reason, payload }),

  getCaseHistory: (token, id) =>
    request('GET', `/cases/${id}/history`, token),

  getCaseAudit: (token, id) =>
    request('GET', `/cases/${id}/audit`, token),

  // Evidence
  commitEvidence: (token, file_name, content, case_id) =>
    request('POST', '/evidence/commitment', token, { file_name, content, case_id }),

  verifyEvidence: (token, evidence_text, expected_hash) =>
    request('POST', '/evidence/verify', token, { evidence_text, expected_hash }),

  demoConfig: () => request('GET', '/demo-config', null),
};
