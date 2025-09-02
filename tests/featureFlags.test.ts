import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFeatureFlags, setFeatureFlag } from '../services/featureFlagService';

// Simple in-memory for feature_flags
const rows: any[] = [];

vi.mock('../src/supabaseClient', () => {
  const supabase = {
    from(table: string){
      return {
        select(){
          return {
            eq: (_c:string, user:string)=> Promise.resolve({ data: rows.filter(r=> r.user_id===user), error: null })
          } as any;
        },
        upsert(payload:any){
          const idx = rows.findIndex(r=> r.user_id===payload.user_id && r.flag===payload.flag);
          if(idx>=0) rows[idx] = { ...rows[idx], enabled: payload.enabled };
          else rows.push({ ...payload, created_at: new Date().toISOString() });
          return Promise.resolve({ error: null });
        }
      } as any;
    }
  };
  return { supabase };
});

describe('featureFlagService', () => {
  beforeEach(()=>{ rows.length = 0; });
  it('sets and fetches flags', async () => {
    await setFeatureFlag('u1','risk_heatmap',true);
    await setFeatureFlag('u1','optimizer',false);
    const map = await fetchFeatureFlags('u1');
    expect(map.risk_heatmap).toBe(true);
    expect(map.optimizer).toBe(false);
  });
});
