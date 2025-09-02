import { useEffect, useState } from 'react';
import { supabase } from '../src/supabaseClient';

export interface RiskHistoryEntry {
  id: string;
  policy_id: string;
  risk_score: number;
  created_at: string;
}

interface Options { limit?: number; enabled?: boolean; }

export const useRiskAssessments = (policyId?: string, opts: Options = {}) => {
  const { limit = 10, enabled = true } = opts;
  const [data, setData] = useState<RiskHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(()=>{
    if(!policyId || !enabled) return;
    let active = true;
    (async()=>{
      setLoading(true); setError(null);
      try {
        const { data: rows, error } = await supabase
          .from('policy_risk_assessments')
          .select('id,policy_id,risk_score,created_at')
          .eq('policy_id', policyId)
          .order('created_at', { ascending: false })
          .limit(limit);
        if(error) throw error;
        if(active) setData(rows as RiskHistoryEntry[]);
      } catch(e:any) { if(active) setError(e); }
      finally { if(active) setLoading(false); }
    })();
    return ()=>{ active=false; };
  },[policyId, limit, enabled]);

  const latest = data[0];
  const previous = data[1];
  const trend = latest && previous ? (latest.risk_score - previous.risk_score) : 0;
  const trendDirection: 'up'|'down'|'flat' = trend > 0.01 ? 'up' : trend < -0.01 ? 'down' : 'flat';

  return { data, loading, error, latest, trend, trendDirection };
};
