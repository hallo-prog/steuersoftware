import { useEffect, useState } from 'react';
import { fetchLatestRiskAssessment } from '../services/riskService';
import { InsurancePolicy } from '../types';

export const useLatestRiskAssessment = (policy?: InsurancePolicy) => {
  const [risk, setRisk] = useState<{score:number; gaps?:string[]; recommendation?:string; createdAt?:string}|null>(null);
  useEffect(()=>{ if(!policy?.id) return; let active=true; (async()=>{ try { const latest = await fetchLatestRiskAssessment(policy.id); if(latest && active) setRisk({ score: latest.risk_score, gaps: latest.risk_gaps||[], recommendation: latest.recommendation, createdAt: latest.created_at }); } catch {} })(); return ()=>{ active=false; }; },[policy?.id]);
  return risk;
};
