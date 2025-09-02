import React, { useEffect, useState } from 'react';
import { InsurancePolicy, InsuranceDocument } from '../../types';
import ProgressBar from '../ProgressBar';

interface PolicyUploadZoneProps {
  policies: InsurancePolicy[];
  userId: string;
  ui: any;
  showToast?: (m:string,t?:'success'|'error'|'info')=>void;
  createOrUpdatePolicy: (userId: string, patch: Partial<InsurancePolicy>)=>Promise<InsurancePolicy>;
  uploadPolicyDocument: (userId: string, policyId: string, file: File, meta?: any, opts?: any)=>Promise<InsuranceDocument>;
  setPolicyDocs: React.Dispatch<React.SetStateAction<Record<string,(InsuranceDocument & { publicUrl?:string })[]>>>;
}

const PolicyUploadZone: React.FC<PolicyUploadZoneProps> = ({ policies, userId, ui, showToast, createOrUpdatePolicy, uploadPolicyDocument, setPolicyDocs }) => {
  const [targetPolicyId, setTargetPolicyId] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [progress, setProgress] = useState<{done:number,total:number}>({done:0,total:0});
  const [lastUpdate, setLastUpdate] = useState(0);
  useEffect(()=>{ if (!targetPolicyId && policies.length) setTargetPolicyId(policies[0].id); },[policies, targetPolicyId]);
  const notify = (m:string,t?:'success'|'error'|'info') => { if(showToast) showToast(m,t); else try{alert(m);}catch{} };

  const handleFiles = async (files: File[]) => {
    if(!files.length) { notify('Keine PDFs','info'); return; }
    let policyId = targetPolicyId;
    if (createNew) {
      setCreating(true);
      try {
        const baseName = files[0].name.replace(/\.pdf$/i,'');
        const saved = await createOrUpdatePolicy(userId, { name: baseName, type: 'Sonstige' });
        policyId = saved.id;
        setTargetPolicyId(saved.id);
        notify('Neue Police erstellt','success');
      } catch { notify('Neue Police fehlgeschlagen','error'); return; }
      finally { setCreating(false); }
    }
    if(!policyId) { notify('Keine Ziel-Police auswählbar','error'); setUploadingDoc(false); return; }
    setUploadingDoc(true);
    setProgress({done:0,total:files.length});
    let completed = 0;
    try {
      const list: (InsuranceDocument & { publicUrl?:string })[] = [];
      const errors: {file:string; message:string}[] = [];
      const controller = new AbortController();
      (window as any).__policyUploadAbort = controller;
      for(const f of files) {
        try {
          const up = await uploadPolicyDocument(userId, policyId, f, undefined, { signal: controller.signal });
          list.push(up);
        } catch(e:any) { console.warn('Upload Policy Doc failed', f.name, e); errors.push({file:f.name,message:e?.message||'Fehler'}); }
        completed++;
        const now = Date.now();
        if (now - lastUpdate > 120 || completed===files.length) { setProgress({done:completed,total:files.length}); setLastUpdate(now); }
      }
      setPolicyDocs(prev=> ({...prev, [policyId]: [...(prev[policyId]||[]), ...list]}));
      if (list.length && !errors.length) notify(`${list.length} PDF(s) hochgeladen`,'success');
      else if (list.length && errors.length) notify(`${list.length} ok, ${errors.length} Fehler`,'info');
      else if (!list.length && errors.length) notify(`Upload fehlgeschlagen (${errors[0].file}): ${errors[0].message}`,'error');
    } finally { setUploadingDoc(false); }
  };

  return (
    <div className="relative border-2 border-dashed rounded-lg p-4 text-xs bg-slate-50 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className={`font-medium ${ui.textSecondary}`}>PDF Upload</p>
          <p className={`mt-0.5 ${ui.textMuted}`}>Drag & Drop oder Auswahl – wird verknüpft mit ausgewählter Police</p>
        </div>
        <div className="flex items-center gap-2">
          {!createNew && (
            <select value={targetPolicyId} onChange={e=>setTargetPolicyId(e.target.value)} className={`px-2 py-1 rounded ${ui.input} text-[11px]`}>
              {policies.map(p=> <option key={p.id} value={p.id}>{p.name.slice(0,32)}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
            <input type="checkbox" checked={createNew} onChange={()=>setCreateNew(v=>!v)} /> Neu anlegen
          </label>
          <label className={`px-3 py-1.5 rounded text-white text-[11px] font-semibold cursor-pointer hover:bg-blue-700 ${(!createNew && !targetPolicyId)?'bg-blue-300 cursor-not-allowed':'bg-blue-600'}`} title={!createNew && !targetPolicyId ? 'Erst Police auswählen oder Neu anlegen aktivieren' : undefined}>
            <input type="file" accept="application/pdf,.pdf" multiple className="hidden" disabled={!createNew && !targetPolicyId} onChange={e=>{ const input = e.target as HTMLInputElement; const fileList = input.files; const list: File[] = fileList? Array.from(fileList): []; const pdfs = list.filter((f: File)=> { const mt = f.type?.toLowerCase(); return mt==='application/pdf' || mt==='application/x-pdf' || /\.pdf$/i.test(f.name); }); if (!pdfs.length) { notify('Keine gültigen PDF-Dateien erkannt','info'); } else { handleFiles(pdfs); } input.value=''; }} />Auswählen
          </label>
        </div>
      </div>
      <div onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; }} onDrop={e=>{ e.preventDefault(); if(!createNew && !targetPolicyId){ notify('Erst Policy auswählen oder Neu anlegen aktivieren','info'); return; } const fs = Array.from(e.dataTransfer.files||[]) as File[]; const pdfs = fs.filter(f=> { const mt = f.type?.toLowerCase(); return mt==='application/pdf' || mt==='application/x-pdf' || /\.pdf$/i.test(f.name); }); if (!pdfs.length) { notify('Keine gültigen PDF-Dateien erkannt','info'); return; } handleFiles(pdfs); }} className="mt-3 h-20 flex items-center justify-center text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/40">
        <div className="w-full flex flex-col items-center px-4">
          {creating? 'Erstelle Police…' : uploadingDoc? (<>
            <span className="mb-2">Lade hoch… ({progress.done}/{progress.total})</span>
            <ProgressBar done={progress.done} total={progress.total} />
          </>) : 'Hier PDF(s) ablegen'}
        </div>
      </div>
    </div>
  );
};

export default PolicyUploadZone;
