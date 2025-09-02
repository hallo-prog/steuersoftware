import { describe, it, expect } from 'vitest';
import { analyzeLiability, extractContactsFromText, assessPolicyRisk } from '../services/geminiService';

// Fallback Pfade ohne API Key testen (Mock Branches)

describe('KI Fallbacks ohne API Key', () => {
  const dummyLiability: any = { id: 'l1', name: 'Darlehen Demo', outstandingAmount: 5000 };
  it('analyzeLiability liefert Demo Daten ohne Key', async () => {
    const res = await analyzeLiability('', dummyLiability, []);
    expect(res.summary.toLowerCase()).toContain('demo');
    expect(res.riskScore).toBeTypeOf('number');
  });

  it('extractContactsFromText liefert Mock Kontakt ohne Key', async () => {
    const res = await extractContactsFromText('', ['Rechnung Bauhaus GmbH Betrag 100 EUR']);
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name).toBeDefined();
  });

  it('assessPolicyRisk liefert Platzhalter ohne Key', async () => {
    const policy: any = { id: 'p1', name: 'Police Demo' };
    const result = await assessPolicyRisk('', policy, [policy]);
    expect(result.riskScore).toBe(0.5);
    expect(result.riskGaps).toContain('API_KEY_FEHLT');
  });
});
