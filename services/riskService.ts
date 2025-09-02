import { supabase } from '../src/supabaseClient';
import { InsurancePolicy } from '../types';
import { assessPolicyRisk } from './geminiLazy';

export interface RiskAssessmentRecord {
  id: string;
  policy_id: string;
  risk_score: number;
  risk_gaps?: string[];
  recommendation?: string;
  model?: string;
  created_at: string;
}

export const insertRiskAssessment = async (policyId: string, score: number, gaps?: string[], recommendation?: string, model?: string) => {
  const { data, error } = await supabase.from('policy_risk_assessments').insert({
    policy_id: policyId,
    risk_score: score,
    risk_gaps: gaps,
    recommendation,
    model,
  }).select().single();
  if (error) throw error;
  return data as RiskAssessmentRecord;
};

export const fetchLatestRiskAssessment = async (policyId: string): Promise<RiskAssessmentRecord | null> => {
  const { data, error } = await supabase.from('policy_risk_assessments').select('*').eq('policy_id', policyId).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data as any || null;
};

// Führt eine neue Risikoanalyse aus und persistiert das Ergebnis (historisch)
export const assessAndStoreRisk = async (apiKey: string, policy: InsurancePolicy, allPolicies: InsurancePolicy[]) => {
  const res = await assessPolicyRisk(apiKey, policy as any, allPolicies as any);
  await insertRiskAssessment(policy.id, res.riskScore, res.riskGaps, res.recommendation, res.model || 'gemini');
  return res;
};
