import React from 'react';
import { InsuranceDocument, InsurancePolicy } from '../../types';

interface Props {
  ui: any;
  policy: InsurancePolicy;
  policies: InsurancePolicy[];
  policyDocs: (InsuranceDocument & { publicUrl?: string })[];
  autoExtract: boolean;
  uploading: boolean;
  onToggleAutoExtract: () => void;
  onUpload: (files: File[]) => void | Promise<void>;
  onDeleteDoc: (doc: InsuranceDocument & { publicUrl?: string }) => void | Promise<void>;
  onResolvePublicUrl: (doc: InsuranceDocument & { publicUrl?: string; storagePath?: string }) => void | Promise<void>;
  onClose: () => void;
}

const PolicyDocumentsModal: React.FC<Props> = ({ ui, policy, policyDocs, autoExtract, uploading, onToggleAutoExtract, onUpload, onDeleteDoc, onResolvePublicUrl, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${ui.card} ${ui.border} rounded-xl w-full max-w-3xl p-6 space-y-4`}>
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold">Dokumente – {policy.name}</h3>
          <button onClick={onClose} className={`text-sm px-3 py-1 rounded ${ui.buttonSecondary}`}>Schließen</button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700">
            <input type="file" className="hidden" multiple onChange={e=>{ const list = e.target.files? Array.from(e.target.files) as File[]: []; if(list.length) onUpload(list); e.target.value=''; }} />Upload
          </label>
          <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={autoExtract} onChange={onToggleAutoExtract} /> Auto KI-Extraktion
          </label>
          {uploading && <span className="text-xs text-slate-500 dark:text-slate-400">Lade hoch...</span>}
        </div>
        <div className={`max-h-80 overflow-y-auto rounded-lg divide-y ${ui.border} divide-slate-200 dark:divide-slate-700`}>
          {policyDocs.map(d => (
            <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <div className="truncate flex-1 pr-4">{d.fileName}</div>
              <div className="flex items-center gap-2">
                {d.publicUrl ? (
                  <a href={d.publicUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Öffnen</a>
                ) : d.storagePath ? (
                  <button onClick={()=>onResolvePublicUrl(d)} className="text-blue-600">URL</button>
                ) : (
                  <button onClick={()=>{}} className="text-slate-400">?</button>
                )}
                <button onClick={()=>onDeleteDoc(d)} className="text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30">Del</button>
              </div>
            </div>
          ))}
          {!policyDocs.length && <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">Noch keine Dokumente.</div>}
        </div>
        {autoExtract && policyDocs.length>0 && (
          <div className="mt-4 text-[10px] text-slate-500 dark:text-slate-400">
            Hinweis: Neue Uploads werden automatisch analysiert und schlagen aktualisierte Felder vor.
          </div>
        )}
      </div>
    </div>
  );
};

export default PolicyDocumentsModal;
