import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transitionClaim, ClaimTransitionError, createClaim } from '../services/claimService';

vi.mock('../src/supabaseClient', () => {
  const claims: any[] = [];
  const claimEvents: any[] = [];
  const from = (table: string) => {
    return {
      insert: (vals: any) => ({
        select: () => ({
          single: () => {
            if (table === 'insurance_claims') {
              const id = vals.id || 'clm-' + Math.random().toString(36).slice(2, 8);
              const row = { id, ...vals };
              claims.push(row);
              return Promise.resolve({ data: row, error: null });
            } else if (table === 'claim_events') {
              claimEvents.push(vals);
              return Promise.resolve({ data: { id: 'e1', ...vals }, error: null });
            }
            return Promise.resolve({ data: vals, error: null });
          }
        })
      }),
      update: (vals: any) => ({
        eq: (_col: string, id: string) => ({
          select: () => ({
            single: () => {
              const idx = claims.findIndex(c => c.id === id);
              if (idx >= 0) {
                claims[idx] = { ...claims[idx], ...vals };
              }
              return Promise.resolve({ data: claims[idx], error: null });
            }
          })
        })
      }),
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null })
            })
          })
        })
      })
    } as any;
  };
  return { supabase: { from } };
});

vi.mock('../services/supabaseDataService', () => ({
  upsertClaim: vi.fn(async (_userId:string, claim:any) => {
    const { supabase } = await import('../src/supabaseClient');
    if (claim.id) {
      return (await supabase.from('insurance_claims').update(claim).eq('id', claim.id).select().single()).data;
    }
    return (await supabase.from('insurance_claims').insert(claim).select().single()).data;
  })
}));

describe('Claim State Machine', () => {
  let claim: any;
  beforeEach(async () => {
    vi.clearAllMocks();
    claim = await createClaim('user-1', { policyId: 'pol-1', type: 'Schadensfall', title: 'Defekt', description: 'X' });
  });

  it('allows valid transitions', async () => {
    claim = await transitionClaim('user-1', claim, 'in_pruefung');
    expect(claim.status).toBe('in_pruefung');
    claim = await transitionClaim('user-1', claim, 'dokumentation');
    expect(claim.status).toBe('dokumentation');
    claim = await transitionClaim('user-1', claim, 'abgeschlossen');
    expect(claim.status).toBe('abgeschlossen');
  });

  it('rejects invalid transitions', async () => {
    await expect(transitionClaim('user-1', claim, 'abgeschlossen')).rejects.toBeInstanceOf(ClaimTransitionError);
  });
});
