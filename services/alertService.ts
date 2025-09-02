import { supabase } from '../src/supabaseClient';

export interface PolicyAlert {
  id: string;
  policy_id: string;
  alert_type: string;
  severity: 'info'|'warning'|'critical';
  message: string;
  resolved_at: string|null;
  created_at: string;
}

const RENEWAL_THRESHOLDS_DAYS = [60,30,7];

export const generateRenewalAlerts = async (policy: { id:string; endDate?: string|null; name: string }) => {
  if(!policy.endDate) return [] as PolicyAlert[];
  const end = new Date(policy.endDate).getTime();
  const now = Date.now();
  const diffDays = Math.floor((end - now)/ (1000*60*60*24));
  if(diffDays < 0) return [];
  const thresholdsHit = RENEWAL_THRESHOLDS_DAYS.filter(d=> diffDays === d);
  if(!thresholdsHit.length) return [];
  const existing = await fetchOpenAlerts(policy.id);
  const inserted: PolicyAlert[] = [];
  for (const d of thresholdsHit) {
    const message = `Police '${policy.name}' läuft in ${d} Tagen aus.`;
    if (existing.some(a=>a.message===message)) continue;
    const severity: PolicyAlert['severity'] = d <= 7 ? 'critical' : (d <= 30 ? 'warning' : 'info');
    const { data, error } = await supabase.from('policy_alerts').insert({ policy_id: policy.id, alert_type: 'renewal_window', severity, message }).select().single();
    if(!error && data) inserted.push(data as PolicyAlert);
  }
  return inserted;
};

export const generateRenewalAlertsForPolicies = async (policies: { id:string; endDate?:string|null; name:string }[]) => {
  const all: PolicyAlert[] = [];
  for(const p of policies){
    try { const res = await generateRenewalAlerts(p); if(res.length) all.push(...res); } catch {}
  }
  return all;
};

export const fetchOpenAlerts = async (policyId: string): Promise<PolicyAlert[]> => {
  const { data, error } = await supabase.from('policy_alerts').select('*').eq('policy_id', policyId).is('resolved_at', null).order('created_at', { ascending:false });
  if (error) throw error; return data as PolicyAlert[];
};

export const fetchOpenAlertsForPolicies = async (policyIds: string[]): Promise<Record<string, PolicyAlert[]>> => {
  if(!policyIds.length) return {};
  const { data, error } = await supabase.from('policy_alerts').select('*').in('policy_id', policyIds).is('resolved_at', null);
  if(error) throw error;
  const map: Record<string, PolicyAlert[]> = {};
  (data||[]).forEach(a=> { if(!map[a.policy_id]) map[a.policy_id]=[]; map[a.policy_id].push(a as PolicyAlert); });
  Object.values(map).forEach(list=> list.sort((a,b)=> new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  return map;
};

export const resolveAlert = async (id: string) => {
  const { error } = await supabase.from('policy_alerts').update({ resolved_at: new Date().toISOString() }).eq('id', id);
  if(error) throw error;
};
