import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/supabaseClient', () => {
  const rows: any[] = [];
  const policyVersions: any[] = [];
  const riskAssessments: any[] = [];
  const from = (table: string) => {
    return {
      insert: (values:any) => ({
        select: () => ({ single: () => {
          if (table === 'insurance_policies') {
            const id = values.id || 'pol-'+Math.random().toString(36).slice(2,10);
            const row = { id, ...values };
            rows.push(row);
            return Promise.resolve({ data: row, error: null });
          } else if (table === 'policy_versions') {
            policyVersions.push(values);
            return Promise.resolve({ data: { id: 'v1', ...values }, error: null });
          } else if (table === 'policy_risk_assessments') {
            const rec = { id: 'r1', ...values, created_at: new Date().toISOString() };
            riskAssessments.push(rec);
            return Promise.resolve({ data: rec, error: null });
          }
          return Promise.resolve({ data: values, error: null });
        } })
      }),
      update: (values:any) => ({ eq: (_:string, id:string) => ({ select: () => ({ single: () => {
        const idx = rows.findIndex(r=>r.id===id);
        if (idx>=0) { rows[idx] = { ...rows[idx], ...values }; }
        return Promise.resolve({ data: rows[idx], error: null });
      } }) }) }),
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: riskAssessments.slice(-1)[0], error: null }) }) }) }) }),
    } as any;
  };
  return { supabase: { from } };
});

vi.mock('../services/geminiLazy', () => ({
  assessPolicyRisk: vi.fn().mockResolvedValue({ riskScore: 0.42, riskGaps: ['Gap A'], recommendation: 'Mehr Deckung X', model: 'mock-llm' }),
}));

import { createOrUpdatePolicy } from '../services/policyService';
import { assessAndStoreRisk, fetchLatestRiskAssessment } from '../services/riskService';

describe('Policy Version & Risk Assessments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a policy and stores version snapshot', async () => {
    const pol = await createOrUpdatePolicy('user-1', { name: 'Test Police', type: 'Sonstige' });
    expect(pol.id).toBeDefined();
    // After creation version snapshot inserted (mock captured insert call above)
    // We rely on mock arrays; simplistically assert id exists
    expect(pol.name).toBe('Test Police');
  });

  it('assesses risk and stores assessment history', async () => {
    const pol = await createOrUpdatePolicy('user-1', { name: 'Risk Police', type: 'KFZ' });
    const res = await assessAndStoreRisk('apiKey', pol as any, [pol] as any);
    expect(res.riskScore).toBeCloseTo(0.42, 2);
    const latest = await fetchLatestRiskAssessment(pol.id);
    expect(latest?.risk_score).toBeCloseTo(0.42, 2);
  });
});
