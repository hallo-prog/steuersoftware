import React from 'react';
import { InsuranceClaim } from '../../types';
import { allowedTransitions } from '../../services/claimService';

interface ClaimListProps {
  claims: InsuranceClaim[];
  ui: any;
  onRunAI(claim: InsuranceClaim): void;
  onExport(claim: InsuranceClaim): void;
  onTransition(claim: InsuranceClaim, target: InsuranceClaim['status']): Promise<void>;
  aiEnabled?: boolean;
}

const ClaimList: React.FC<ClaimListProps> = ({ claims, ui, onRunAI, onExport, onTransition, aiEnabled=true }) => {
  if (!claims.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {claims.map(cl => (
        <div key={cl.id} className={`rounded-lg p-2 bg-slate-50 dark:bg-slate-800/60 ${ui.border}`}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{cl.title} <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">{cl.type}</span></div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Status: {cl.status||'offen'}</div>
              {cl.aiSummary && <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 line-clamp-3">{cl.aiSummary}</div>}
            </div>
            <div className="flex gap-1">
              <button onClick={()=> aiEnabled && onRunAI(cl)} disabled={!aiEnabled} title={aiEnabled? 'KI Analyse starten':'Kein GEMINI_API_KEY konfiguriert'} className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-40">KI</button>
              <button onClick={()=>onExport(cl)} className="text-[10px] px-2 py-1 rounded bg-purple-600 text-white">PDF</button>
              {allowedTransitions(cl.status).map(next => (
                <button key={next} onClick={()=>onTransition(cl, next as any)} className="text-[10px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200">→{next.split('_')[0]}</button>
              ))}
            </div>
          </div>
          {cl.aiRecommendation && <div className="mt-1 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">Empfehlung: {cl.aiRecommendation}</div>}
        </div>
      ))}
    </div>
  );
};

export default ClaimList;
