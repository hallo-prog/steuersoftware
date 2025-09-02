import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple in-memory alert + policy storage
const policies: any[] = [];
const alerts: any[] = [];

// Helper to compute dates
function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

vi.mock('../src/supabaseClient', () => {
  const supabase = {
    from(table: string) {
      return {
        select() {
          // fetchOpenAlerts: select('*').eq('policy_id', id).is('resolved_at', null).order('created_at', { ascending:false })
          const chain = {
            is: () => ({ order: () => Promise.resolve({ data: alerts.filter(a=> !a.resolved_at), error: null }) })
          };
          return {
            eq: (_col: string, policyId: string) => ({ is: () => ({ order: () => Promise.resolve({ data: alerts.filter(a=> a.policy_id===policyId && !a.resolved_at), error: null }) }) }),
            in: (_col: string, ids: string[]) => ({ is: () => Promise.resolve({ data: alerts.filter(a=> ids.includes(a.policy_id) && !a.resolved_at), error: null }) }),
            ...chain
          } as any;
        },
        insert(payload: any) {
          if (table === 'policy_alerts') {
            const row = { id: 'al-' + (alerts.length+1), created_at: new Date().toISOString(), resolved_at: null, ...payload };
            alerts.push(row);
            return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) };
          }
          policies.push(payload); return Promise.resolve({ data: [payload], error: null });
        },
        update(values: any) { return { eq: (_c:string, id:string) => { const a = alerts.find(al=> al.id===id); if(a) Object.assign(a, values); return Promise.resolve({ data:[a], error:null }); } }; },
      };
    }
  };
  return { supabase };
});

// Mock uuid
vi.mock('uuid', () => ({ v4: () => 'uuid-fixed' }));

import { generateRenewalAlertsForPolicies, fetchOpenAlertsForPolicies, resolveAlert } from '../services/alertService';

describe('alertService renewal thresholds', () => {
  beforeEach(() => { policies.length = 0; alerts.length = 0; });
  vi.setSystemTime(new Date());

  it('creates alerts only at exact 60/30/7 day thresholds', async () => {
    const today = new Date();
    [60,30,7].forEach(days => { policies.push({ id: `pol-${days}`, name: `P${days}`, endDate: addDays(today, days).toISOString() }); });
    policies.push({ id: 'pol-59', name: 'P59', endDate: addDays(today, 59).toISOString() });

    await generateRenewalAlertsForPolicies(policies);
    const map = await fetchOpenAlertsForPolicies(policies.map(p=>p.id));
    const all = Object.values(map).flat();
    expect(all.length).toBe(3);
    const severities = all.map(a=>a.severity).sort();
    expect(severities).toEqual(['critical','info','warning']);
  });

  it('resolves an alert', async () => {
    const today = new Date();
    policies.push({ id: 'pol-30', name: 'P30', endDate: addDays(today, 30).toISOString() });
    await generateRenewalAlertsForPolicies(policies);
    let all = Object.values(await fetchOpenAlertsForPolicies(['pol-30'])).flat();
    expect(all.length).toBe(1);
    const id = all[0].id;
    await resolveAlert(id);
    all = Object.values(await fetchOpenAlertsForPolicies(['pol-30'])).flat();
    expect(all.length).toBe(0);
  });
});
