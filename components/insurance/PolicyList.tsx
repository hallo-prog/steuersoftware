import React from 'react';
import { InsurancePolicy, InsuranceClaim, InsuranceDocument } from '../../types';
import ClaimList from './ClaimList';
import { PolicyAlert } from '../../services/alertService';

interface PolicyListProps {
  policies: InsurancePolicy[]; // bereits gefiltert
  claims: InsuranceClaim[];
  policyDocs: Record<string,(InsuranceDocument & { publicUrl?: string })[]>;
  policyAlerts?: Record<string, PolicyAlert[]>;
  ui: any;
  onEdit(policy: InsurancePolicy): void;
  onDelete(id: string): void;
  onAssessRisk(policy: InsurancePolicy): Promise<void>;
  onCreateClaim(policyId: string): void;
  onAutoLink(policy: InsurancePolicy): void;
  onOpenDocuments(policy: InsurancePolicy): void;
  onRunClaimAI(claim: InsuranceClaim): void;
  onExportClaim(claim: InsuranceClaim): void;
  onTransitionClaim(claim: InsuranceClaim, target: InsuranceClaim['status']): Promise<void>;
  showToast?: (m:string,t?:'success'|'error'|'info')=>void;
  aiEnabled?: boolean;
}

const PolicyList: React.FC<PolicyListProps> = ({ policies, claims, policyDocs, policyAlerts, ui, onEdit, onDelete, onAssessRisk, onCreateClaim, onAutoLink, onOpenDocuments, onRunClaimAI, onExportClaim, onTransitionClaim, aiEnabled=true }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {policies.map(p => {
        const claimCnt = claims.filter(c=>c.policyId===p.id).length;
        const latestRisk = (p as any).riskScore!=null ? { score: (p as any).riskScore } : undefined;
        const alerts = policyAlerts?.[p.id] || [];
        const critical = alerts.filter(a=>a.severity==='critical').length;
        const warning = alerts.filter(a=>a.severity==='warning').length;
        const info = alerts.filter(a=>a.severity==='info').length;
        return (
          <div key={p.id} className={`${ui.card} ${ui.border} dark:bg-slate-900 rounded-xl p-5 shadow-sm flex flex-col`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className={`text-sm font-bold leading-snug ${ui.textPrimary}`}>{p.name}</h3>
                <p className={`text-xs mt-0.5 ${ui.textMuted}`}>{p.type}{p.policyNumber ? ' • '+p.policyNumber : ''}</p>
                {latestRisk && <div className="mt-1 text-[10px]"><span className="px-1.5 py-0.5 rounded bg-amber-600/20 text-amber-700 dark:text-amber-300">Risk {(latestRisk.score*100).toFixed(0)}%</span></div>}
                {alerts.length>0 && (
                  <div className="flex gap-1 mt-1">
                    {critical>0 && <span title={`${critical} kritische Alerts`} className="px-1.5 py-0.5 rounded bg-red-600 text-white text-[10px] font-semibold">{critical}</span>}
                    {warning>0 && <span title={`${warning} Warnungen`} className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-semibold">{warning}</span>}
                    {info>0 && <span title={`${info} Hinweise`} className="px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-semibold">{info}</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={()=>onEdit(p)} className={`text-xs px-2 py-1 rounded ${ui.buttonSecondary}`}>Edit</button>
                <button onClick={()=>onDelete(p.id)} className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-600/30 hover:bg-red-200 dark:hover:bg-red-600 text-red-600 dark:text-red-300">Del</button>
                <button onClick={()=> aiEnabled && onAssessRisk(p)} disabled={!aiEnabled} title={aiEnabled? 'Risiko neu berechnen':'Kein GEMINI_API_KEY konfiguriert'} className="text-xs px-2 py-1 rounded bg-amber-100 dark:bg-amber-600/30 hover:bg-amber-200 dark:hover:bg-amber-600 text-amber-700 dark:text-amber-300 disabled:opacity-40">Risk</button>
              </div>
            </div>
            <div className="mt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400">Dokumente: {policyDocs[p.id]?.length ?? 0}</div>
                <div className={`mt-3 space-y-1 text-[11px] ${ui.textSecondary}`}>
                  {p.premiumAmount && <div>Prämie: {p.premiumAmount.toLocaleString('de-DE')} € / {p.paymentInterval}</div>}
                  {p.startDate && <div>Laufzeit: {new Date(p.startDate).toLocaleDateString('de-DE')} {p.endDate && '– '+ new Date(p.endDate).toLocaleDateString('de-DE')}</div>}
                  {p.coverageItems && p.coverageItems.length>0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.coverageItems.slice(0,5).map(ci => <span key={ci} className={`px-2 py-0.5 rounded text-[10px] ${ui.badge}`}>{ci}</span>)}
                      {p.coverageItems.length>5 && <span className="text-slate-400 dark:text-slate-500">+{p.coverageItems.length-5}</span>}
                    </div>
                  )}
                </div>
            <div className="mt-4 flex gap-2 flex-wrap text-[11px]">
              <button onClick={()=>onCreateClaim(p.id)} className="px-2.5 py-1 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700">Fall</button>
              <button onClick={()=>onAutoLink(p)} className="px-2.5 py-1 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700">Auto-Verknüpfen</button>
              <span className="px-2 py-1 rounded bg-amber-100 dark:bg-amber-600/30 text-amber-700 dark:text-amber-300 font-semibold">Fälle {claimCnt}</span>
              <button onClick={()=>onOpenDocuments(p)} className="px-2.5 py-1 rounded bg-slate-700 dark:bg-slate-600 text-white font-semibold hover:bg-slate-800 dark:hover:bg-slate-500">Docs</button>
            </div>
            <ClaimList ui={ui} claims={claims.filter(c=>c.policyId===p.id)} onRunAI={onRunClaimAI} onExport={onExportClaim} onTransition={onTransitionClaim} />
          </div>
        );
      })}
    </div>
  );
};

export default PolicyList;
