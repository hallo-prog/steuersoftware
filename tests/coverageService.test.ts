import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-Memory Tabellen
const tables: Record<string, any[]> = {
  coverage_items: [],
  exclusions: []
};

vi.mock('../src/supabaseClient', () => {
  const supabase = {
    from(table: string) {
      return {
        select() {
          return {
            eq(_col: string, policyId: string) {
              return {
                order() {
                  const data = tables[table].filter(r => r.policy_id === policyId);
                  return Promise.resolve({ data, error: null });
                }
              };
            }
          };
        },
        upsert(payload: any) {
          const arr = tables[table];
          const id = payload.id || (table === 'coverage_items' ? 'cov-' : 'exc-') + Math.random().toString(36).slice(2, 8);
          const row = table === 'coverage_items'
            ? { id, policy_id: payload.policy_id, label: payload.label, limit_amount: payload.limit_amount ?? null, deductible_amount: payload.deductible_amount ?? null, created_at: new Date().toISOString() }
            : { id, policy_id: payload.policy_id, label: payload.label, created_at: new Date().toISOString() };
          arr.push(row);
          return { select: () => ({ single: () => Promise.resolve({ data: row, error: null }) }) };
        },
        delete() {
          return {
            eq(_col: string, id: string) {
              const arr = tables[table];
              const idx = arr.findIndex((r: any) => r.id === id);
              if (idx >= 0) arr.splice(idx, 1);
              return Promise.resolve({ error: null });
            }
          };
        }
      };
    }
  };
  return { supabase };
});

import { fetchCoverageItems, upsertCoverageItem, deleteCoverageItem, fetchExclusions, upsertExclusion, deleteExclusion } from '../services/coverageService';

describe('coverageService CRUD', () => {
  const policyId = 'pol-1';
  beforeEach(() => { tables.coverage_items.length = 0; tables.exclusions.length = 0; });

  it('creates and lists coverage items', async () => {
    await upsertCoverageItem(policyId, { label: 'Haftpflicht', limit_amount: 100000 });
    await upsertCoverageItem(policyId, { label: 'Inventar', deductible_amount: 500 });
    const items = await fetchCoverageItems(policyId);
    expect(items).toHaveLength(2);
    expect(items.some(i => i.label === 'Haftpflicht')).toBeTruthy();
  });

  it('deletes a coverage item', async () => {
    const a = await upsertCoverageItem(policyId, { label: 'A', limit_amount: 1 });
    await deleteCoverageItem(a.id);
    const items = await fetchCoverageItems(policyId);
    expect(items).toHaveLength(0);
  });

  it('manages exclusions', async () => {
    const ex = await upsertExclusion(policyId, { label: 'Cyber' });
    let list = await fetchExclusions(policyId);
    expect(list).toHaveLength(1);
    await deleteExclusion(ex.id);
    list = await fetchExclusions(policyId);
    expect(list).toHaveLength(0);
  });
});
