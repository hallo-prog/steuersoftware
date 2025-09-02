import React from 'react';
import { PolicyAlert, resolveAlert } from '../../services/alertService';

interface PolicyAlertsModalProps {
  ui:any;
  policyName: string;
  alerts: PolicyAlert[];
  onClose(): void;
  onResolved(id:string): void;
}

const severityColors: Record<string,string> = {
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-600/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-700 dark:bg-amber-600/30 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-600/30 dark:text-red-300'
};

const PolicyAlertsModal: React.FC<PolicyAlertsModalProps> = ({ ui, policyName, alerts, onClose, onResolved }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className={`${ui.card} ${ui.border} rounded-xl p-6 w-full max-w-lg space-y-4`}> 
        <div className="flex items-start justify-between">
          <h3 className="text-lg font-bold">Alerts – {policyName}</h3>
          <button onClick={onClose} className={`${ui.buttonSecondary} px-3 py-1 rounded text-xs`}>Schließen</button>
        </div>
        {alerts.length===0 && <div className="text-sm text-slate-500">Keine offenen Alerts.</div>}
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {alerts.map(a=> (
            <div key={a.id} className={`${ui.border} rounded-lg p-3 text-sm flex items-start gap-3`}> 
              <div className={`text-[10px] px-2 py-0.5 rounded font-semibold whitespace-nowrap ${severityColors[a.severity]}`}>{a.severity}</div>
              <div className="flex-1">
                <div className="text-xs leading-snug">{a.message}</div>
                <div className="text-[10px] text-slate-400 mt-1">{new Date(a.created_at).toLocaleString('de-DE')}</div>
              </div>
              <button onClick={async ()=>{ try { await resolveAlert(a.id); onResolved(a.id); } catch {} }} className="text-[10px] px-2 py-1 rounded bg-emerald-600 text-white">Erledigt</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PolicyAlertsModal;
