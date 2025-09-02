import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-Memory DB
const db: Record<string, any[]> = {
  insurance_policies: [],
  policy_versions: [],
  coverage_items: [],
  exclusions: [],
  insurance_claims: [],
  claim_events: [],
  policy_alerts: []
};

const genId = (p:string)=> p + Math.random().toString(36).slice(2,8);

vi.mock('../src/supabaseClient', () => {
  const supabase = {
    from(table: string){
      return {
        insert(payload: any){
          if(Array.isArray(payload)) return this.insert(payload[0]);
          if(table==='insurance_policies'){
            const row = { id: payload.id || genId('pol-'), created_at: new Date().toISOString(), ...payload };
            db.insurance_policies.push(row); return { select: ()=> ({ single: ()=> Promise.resolve({ data: row, error: null }) })};
          }
            if(table==='policy_versions') { db.policy_versions.push({ id: genId('ver-'), ...payload }); return Promise.resolve({ data: null, error: null }); }
          if(table==='coverage_items'){ const row = { id: payload.id||genId('cov-'), created_at:new Date().toISOString(), ...payload }; db.coverage_items.push(row); return { select: ()=> ({ single: ()=> Promise.resolve({ data: row, error: null }) })}; }
          if(table==='exclusions'){ const row = { id: payload.id||genId('exc-'), created_at:new Date().toISOString(), ...payload }; db.exclusions.push(row); return { select: ()=> ({ single: ()=> Promise.resolve({ data: row, error: null }) })}; }
          if(table==='insurance_claims'){ const row = { id: payload.id||genId('clm-'), created_at:new Date().toISOString(), ...payload }; db.insurance_claims.push(row); return { select: ()=> ({ single: ()=> Promise.resolve({ data: row, error: null }) })}; }
          if(table==='claim_events'){ db.claim_events.push({ id: genId('evt-'), created_at:new Date().toISOString(), ...payload }); return Promise.resolve({ data: null, error: null }); }
          if(table==='policy_alerts'){ const row = { id: genId('al-'), created_at:new Date().toISOString(), resolved_at: null, ...payload }; db.policy_alerts.push(row); return { select: ()=> ({ single: ()=> Promise.resolve({ data: row, error: null }) })}; }
          return Promise.resolve({ data: payload, error: null });
        },
        upsert(payload:any){ return this.insert(payload); },
        update(values:any){ return { eq: (_col:string, id:string)=> { const arr=db[table]; const idx=arr.findIndex((r:any)=>r.id===id); if(idx>=0) arr[idx]={...arr[idx], ...values}; return { select: ()=> ({ single: ()=> Promise.resolve({ data: arr[idx], error:null }) }) }; } }; },
        delete(){ return { eq: (_c:string,id:string)=> { const arr=db[table]; const idx=arr.findIndex((r:any)=>r.id===id); if(idx>=0) arr.splice(idx,1); return Promise.resolve({ error:null }); } }; },
        select(){
          return {
            eq: (_col:string, val:any)=> ({
              is: ()=> ({ order: ()=> Promise.resolve({ data: db[table].filter(r=> r.policy_id===val && !r.resolved_at), error:null }) }),
              order: ()=> Promise.resolve({ data: db[table].filter(r=> r.policy_id===val && (table!=='policy_alerts' || !r.resolved_at)), error:null }),
              // spezifisch für Alerts: is('resolved_at', null)
              isResolved: ()=> Promise.resolve({ data: db[table].filter(r=> r.policy_id===val && !r.resolved_at), error:null })
            }),
            in: (_col:string, ids:string[]) => ({ is: ()=> Promise.resolve({ data: db[table].filter(r=> ids.includes(r.policy_id) && !r.resolved_at), error:null }) }),
            order: ()=> Promise.resolve({ data: db[table], error:null })
          } as any;
        },
        order(){ return Promise.resolve({ data: db[table], error:null }); }
      } as any;
    }
  };
  return { supabase };
});

vi.mock('../services/supabaseDataService', () => ({
  upsertPolicy: vi.fn(async (_userId:string, patch:any)=>{
    const { supabase } = await import('../src/supabaseClient');
    if(patch.id){ return (await supabase.from('insurance_policies').update(patch).eq('id', patch.id).select().single()).data; }
    return (await supabase.from('insurance_policies').insert(patch).select().single()).data;
  }),
  upsertClaim: vi.fn(async (_userId:string, patch:any)=>{
    const { supabase } = await import('../src/supabaseClient');
    if(patch.id){ return (await supabase.from('insurance_claims').update(patch).eq('id', patch.id).select().single()).data; }
    return (await supabase.from('insurance_claims').insert(patch).select().single()).data;
  }),
  fetchPolicies: vi.fn(async (_userId:string)=> db.insurance_policies),
}));

import { createOrUpdatePolicy } from '../services/policyService';
import { upsertCoverageItem, upsertExclusion, fetchCoverageItems, fetchExclusions } from '../services/coverageService';
import { createClaim, transitionClaim } from '../services/claimService';
import { generateRenewalAlertsForPolicies, fetchOpenAlerts, resolveAlert } from '../services/alertService';

const NOW = new Date();
vi.setSystemTime(NOW);

describe('End-to-End Versicherungen Flow (vereinfachte In-Memory Simulation)', () => {
  beforeEach(()=>{ Object.keys(db).forEach(k=> db[k].length=0); });

  it('Policy → Coverage/Exclusion → Claim Lifecycle → Alert → Resolve', async () => {
    const endDate = new Date(NOW.getTime() + 30*24*60*60*1000).toISOString();
    const policy = await createOrUpdatePolicy('user-1', { name:'Betriebshaftpflicht', type:'Betriebshaftpflicht', endDate, startDate: NOW.toISOString(), insurer:'Allianz' } as any);
    expect(policy.id).toBeTruthy();
    expect(db.policy_versions.length).toBe(1);

    const cov = await upsertCoverageItem(policy.id, { label:'Inventar', limit_amount: 50000 });
    const exc = await upsertExclusion(policy.id, { label:'Cyber' });
    expect(cov.label).toBe('Inventar');
    expect(exc.label).toBe('Cyber');
    expect((await fetchCoverageItems(policy.id)).length).toBe(1);
    expect((await fetchExclusions(policy.id)).length).toBe(1);

    let claim = await createClaim('user-1', { policyId: policy.id, type: 'Schadensfall', title:'Maschine Defekt', description:'Motor Schaden' } as any);
    claim = await transitionClaim('user-1', claim, 'in_pruefung');
    claim = await transitionClaim('user-1', claim, 'dokumentation');
    claim = await transitionClaim('user-1', claim, 'abgeschlossen');
    expect(claim.status).toBe('abgeschlossen');

    await generateRenewalAlertsForPolicies([{ id: policy.id, endDate: policy.endDate, name: policy.name }]);
    const alerts = await fetchOpenAlerts(policy.id);
    expect(alerts.length).toBe(1);

    await resolveAlert(alerts[0].id);
    expect((await fetchOpenAlerts(policy.id)).length).toBe(0);
  });
});
