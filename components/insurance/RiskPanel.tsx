import React from 'react';
import { assessAndStoreRisk } from '../../services/riskService';
import { useRiskAssessments } from '../../hooks/useRiskAssessments';
import { InsurancePolicy } from '../../types';

interface RiskPanelProps {
  policy: InsurancePolicy;
  apiKey: string;
  allPolicies: InsurancePolicy[];
  ui: any;
  userId: string;
  onPolicyRiskUpdate: (policyId: string, patch: Partial<InsurancePolicy>) => void;
  showToast?: (m:string,t?:'success'|'error'|'info')=>void;
}

const RiskPanel: React.FC<RiskPanelProps> = ({ policy, apiKey, allPolicies, ui, userId, onPolicyRiskUpdate, showToast }) => {
  const { latest, trend, trendDirection, data, loading } = useRiskAssessments(policy.id);
  const [recalc, setRecalc] = React.useState(false);

  const trigger = async () => {
    if (recalc) return;
    setRecalc(true);
    try {
  const res = await assessAndStoreRisk(apiKey, policy, allPolicies);
      onPolicyRiskUpdate(policy.id, { riskScore: res.riskScore, riskGaps: res.riskGaps, riskRecommendation: res.recommendation } as any);
      showToast?.('Risiko neu berechnet','success');
    } catch { showToast?.('Risikoanalyse fehlgeschlagen','error'); }
    finally { setRecalc(false); }
  };

  return (
    <div className={`${ui.card} ${ui.border} p-4 rounded-lg space-y-3`}> 
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Risiko</h4>
        <button onClick={trigger} disabled={recalc} className={`text-xs px-2 py-1 rounded ${recalc? 'bg-amber-300 text-amber-800':'bg-amber-600 text-white hover:bg-amber-700'}`}>{recalc? 'Rechne…':'Neu bewerten'}</button>
      </div>
      {latest ? (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-amber-600/20 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">Score {(latest.risk_score*100).toFixed(0)}%</span>
            <span className="text-[10px] text-slate-500">{new Date(latest.created_at).toLocaleDateString('de-DE')}</span>
            {trendDirection !== 'flat' && (
              <span className={`text-[10px] font-medium ${trendDirection==='up'?'text-rose-600 dark:text-rose-400':'text-emerald-600 dark:text-emerald-400'}`}>{trendDirection==='up'?'+':'-'}{Math.abs(trend*100).toFixed(0)}%</span>
            )}
          </div>
          {latest.risk_gaps && latest.risk_gaps.length>0 && (
            <div>
              <div className="text-[10px] font-medium mb-1">Gaps</div>
              <div className="flex flex-wrap gap-1">
                {latest.risk_gaps.slice(0,6).map(g=> <span key={g} className={`px-2 py-0.5 rounded text-[10px] ${ui.badge}`}>{g}</span>)}
                {latest.risk_gaps.length>6 && <span className="text-[10px] text-slate-400">+{latest.risk_gaps.length-6}</span>}
              </div>
            </div>
          )}
          {latest.recommendation && <div className="text-[11px] text-slate-600 dark:text-slate-300 whitespace-pre-line">{latest.recommendation}</div>}
          {data.length>1 && (
            <div className="text-[10px] text-slate-500">Historie: {data.slice(0,5).map(r=> (r.risk_score*100).toFixed(0)+'%').join(' • ')}</div>
          )}
        </div>
      ) : (
        <div className="text-xs text-slate-500">Noch keine Bewertung.</div>
      )}
    </div>
  );
};

export default RiskPanel;
