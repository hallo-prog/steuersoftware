import React, { useEffect, useState } from 'react';
import { Document, Liability, LiabilityDocument } from '../types';
import DebtIcon from './icons/DebtIcon';
import { fetchLiabilities, upsertLiability, deleteLiability, fetchLiabilityDocuments, uploadLiabilityDocument, deleteLiabilityDocument } from '../services/supabaseDataService';
import { analyzeLiability, extractContactsFromText } from '../services/geminiLazy';
import ProgressBar from './ProgressBar';
import EmailComposerModal from './EmailComposerModal';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface Props { apiKey: string; userId: string; documents: Document[]; showToast?: (m:string,t?:'success'|'error'|'info')=>void; }

const defaultCategories = ['Darlehen','Leasing','Lieferantenkredit','Privatdarlehen','Steuerschuld','Sonstige'];

const VerbindlichkeitenView: React.FC<Props> = ({ apiKey, userId, documents, showToast }) => {
  const [items, setItems] = useState<Liability[]>([]);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all'); // neu: Risiko Filter
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Liability|null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [aiLoadingId, setAiLoadingId] = useState<string|null>(null);
  const [docsModalLiability, setDocsModalLiability] = useState<Liability|null>(null);
  const [liabDocs, setLiabDocs] = useState<Record<string, LiabilityDocument[]>>({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{done:number,total:number}>({done:0,total:0});
  const [autoExtractContacts, setAutoExtractContacts] = useState(true);
  const [emailLiability, setEmailLiability] = useState<Liability|null>(null);
  const ui = useThemeClasses();

  // Upload-Zone State (global ähnlich wie bei Versicherungen)
  const [uploadingGlobal, setUploadingGlobal] = useState(false);
  const [uploadProgressGlobal, setUploadProgressGlobal] = useState<{done:number,total:number}>({done:0,total:0});
  const [createNewLiability, setCreateNewLiability] = useState(false);
  const [targetLiabilityId, setTargetLiabilityId] = useState('');
  useEffect(()=>{ if(!targetLiabilityId && items.length) setTargetLiabilityId(items[0].id); },[items,targetLiabilityId]);

  // Load liabilities from Supabase
  useEffect(()=> { let active=true; (async()=>{ try { const list = await fetchLiabilities(userId); if(active) setItems(list); } catch(e){ console.warn('Liabilities laden fehlgeschlagen',e); showToast?.('Verbindlichkeiten Laden fehlgeschlagen','error'); } })(); return ()=>{active=false}; },[userId]);

  const filtered = items.filter(i => {
    const okCat = filterCat==='all'|| i.category===filterCat;
    const q = search.toLowerCase().trim();
    const okSearch = !q || [i.name,i.creditor,i.contractNumber,i.notes].filter(Boolean).some(v=>v!.toLowerCase().includes(q));
    const okRisk = (() => {
      if (filterRisk==='all') return true;
      if (i.aiRiskScore==null) return false;
      if (filterRisk==='low') return i.aiRiskScore < 0.34;
      if (filterRisk==='mid') return i.aiRiskScore >=0.34 && i.aiRiskScore < 0.67;
      if (filterRisk==='high') return i.aiRiskScore >=0.67;
      return true;
    })();
    return okCat && okSearch && okRisk;
  });

  const openNew = () => { setEditing(null); setShowForm(true); };
  const openEdit = (l:Liability) => { setEditing(l); setShowForm(true); };
  const del = async (id:string) => { if(!confirm('Verbindlichkeit löschen?')) return; try { await deleteLiability(id); setItems(prev=> prev.filter(i=>i.id!==id)); showToast?.('Gelöscht','info'); } catch { showToast?.('Löschen fehlgeschlagen','error'); } };

  const handleSubmit = async (e:React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement; const fd = new FormData(form); const data = Object.fromEntries(fd.entries());
    const patch: Partial<Liability> = {
      id: editing?.id,
      name: (data.name as string)||'Position',
      creditor: data.creditor as string,
      contractNumber: data.contractNumber as string,
      startDate: data.startDate as string,
      endDate: data.endDate as string,
      paymentInterval: data.paymentInterval as string,
      outstandingAmount: data.outstandingAmount? Number(data.outstandingAmount): undefined,
      originalAmount: data.originalAmount? Number(data.originalAmount): undefined,
      interestRatePercent: data.interestRatePercent? Number(data.interestRatePercent): undefined,
      category: data.category as string,
      notes: data.notes as string,
      tags: (data.tags as string || '').split(',').map(t=>t.trim()).filter(Boolean),
      contactEmail: data.contactEmail as string,
      contactPhone: data.contactPhone as string,
      aiRiskScore: editing?.aiRiskScore,
      aiRecommendation: editing?.aiRecommendation,
      aiSummary: editing?.aiSummary,
    };
    setIsSaving(true);
    try {
      const saved = await upsertLiability(userId, patch);
      setItems(prev => prev.some(i=>i.id===saved.id) ? prev.map(i=>i.id===saved.id? saved : i) : [saved, ...prev]);
      showToast?.('Gespeichert','success');
      setShowForm(false); setEditing(null); form.reset();
    } catch { showToast?.('Speichern fehlgeschlagen','error'); }
    finally { setIsSaving(false); }
  };

  const runAI = async (liab: Liability) => {
    if (aiLoadingId) return; setAiLoadingId(liab.id);
    try {
      const related = documents.filter(d=> d.liabilityId === liab.id || (liab.contractNumber && d.textContent && d.textContent.toLowerCase().includes(liab.contractNumber.toLowerCase())));
      const res = await analyzeLiability(apiKey, liab, related);
      try {
        const saved = await upsertLiability(userId, { id: liab.id, aiRiskScore: res.riskScore, aiSummary: res.summary, aiRecommendation: res.recommendation });
        setItems(prev=> prev.map(i=> i.id===liab.id? saved : i));
        showToast?.('KI Analyse aktualisiert','success');
      } catch { showToast?.('Analyse speichern fehlgeschlagen','error'); }
    } catch { showToast?.('Analyse fehlgeschlagen','error'); }
    finally { setAiLoadingId(null); }
  };

  const autoLinkDocumentsToLiability = async (liab: Liability) => {
    if (!liab.contractNumber) { showToast?.('Keine Vertragsnummer vorhanden','info'); return; }
    const norm = liab.contractNumber.toLowerCase();
    const matched = documents.filter(d => (d.textContent && d.textContent.toLowerCase().includes(norm)) || (d.invoiceNumber && d.invoiceNumber.toLowerCase()===norm));
    let success = 0;
    for (const m of matched) {
      try { await (await import('../services/supabaseDataService')).updateDocument(m.id, { liabilityId: liab.id } as any); success++; } catch {}
    }
    showToast?.(success? `${success} Beleg(e) verknüpft` : 'Keine passenden Belege gefunden', success? 'success':'info');
  };

  const openDocs = async (liab: Liability) => {
    setDocsModalLiability(liab);
    if (!liabDocs[liab.id]) {
      try { const docs = await fetchLiabilityDocuments(liab.id); setLiabDocs(prev=>({...prev,[liab.id]:docs})); } catch { showToast?.('Dokumente laden fehlgeschlagen','error'); }
    }
  };

  const performLiabUpload = async (fileList: File[]) => {
    if(!docsModalLiability || !fileList.length) return; setUploadingDoc(true);
    setUploadProgress({done:0,total:fileList.length});
    try {
      const added: LiabilityDocument[] = [];
      let done=0; let last=0;
      const controller = new AbortController();
      (window as any).__liabilityDocsModalAbort = controller;
      for (const f of fileList) {
        try {
          const up = await uploadLiabilityDocument(userId, docsModalLiability.id, f, undefined, { signal: controller.signal });
          added.push(up);
          if (autoExtractContacts && apiKey) {
            try { const contacts = await extractContactsFromText(apiKey, [f.name]); if (contacts.length) window.dispatchEvent(new CustomEvent('contacts-updated')); } catch {}
          }
        } catch (err:any) {
          if (err?.name==='AbortError') { showToast?.('Upload abgebrochen','info'); break; }
          console.warn('Upload liab doc fail', err);
        }
        done++;
        const now=Date.now(); if (now-last>120 || done===fileList.length) { setUploadProgress({done,total:fileList.length}); last=now; }
      }
      if (added.length) {
        setLiabDocs(prev=> ({...prev, [docsModalLiability.id]: [ ...(prev[docsModalLiability.id]||[]), ...added ] }));
        showToast?.(`${added.length} Datei(en) hochgeladen`,'success');
      }
    } finally { setUploadingDoc(false); }
  };

  const handleUploadLiabDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if(!docsModalLiability) return; const files = e.target.files; if(!files) return; await performLiabUpload(Array.from(files) as File[]); e.target.value=''; };

  const performGlobalUpload = async (fileList: File[]) => {
    if (!fileList.length) { showToast?.('Keine PDFs','info'); return; }
    let liabId = targetLiabilityId;
    if (createNewLiability) {
      try {
        const baseName = fileList[0].name.replace(/\.pdf$/i,'');
        const saved = await upsertLiability(userId, { name: baseName, category: 'Sonstige' });
        setItems(prev=> [saved, ...prev]);
        liabId = saved.id; setTargetLiabilityId(saved.id);
        showToast?.('Neue Verbindlichkeit erstellt','success');
      } catch { showToast?.('Erstellung fehlgeschlagen','error'); return; }
    }
    if(!liabId) { showToast?.('Keine Ziel-Verbindlichkeit','error'); return; }
    setUploadingGlobal(true); setUploadProgressGlobal({done:0,total:fileList.length});
    let done=0; let last=0; const added: LiabilityDocument[] = [];
    try {
      const controller = new AbortController();
      (window as any).__liabilityGlobalAbort = controller;
      for (const f of fileList) {
        try { const up = await uploadLiabilityDocument(userId, liabId, f, undefined, { signal: controller.signal }); added.push(up); } catch (e:any) { if (e?.name==='AbortError') { showToast?.('Upload abgebrochen','info'); break; } }
        done++; const now=Date.now(); if (now-last>120 || done===fileList.length) { setUploadProgressGlobal({done,total:fileList.length}); last=now; }
      }
      if (added.length) {
        setLiabDocs(prev=> ({...prev,[liabId]:[...(prev[liabId]||[]), ...added]}));
        showToast?.(`${added.length} PDF(s) hochgeladen`,'success');
      }
    } finally { setUploadingGlobal(false); }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className={`text-3xl font-bold flex items-center gap-2 ${ui.textPrimary}`}>Verbindlichkeiten <DebtIcon className="w-7 h-7 text-rose-500"/></h2>
        <div className="flex gap-2">
          <button onClick={openNew} className="bg-rose-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-rose-700">Neue</button>
        </div>
      </div>
      {/* Upload-Zone analog Versicherungen */}
      <div className="border-2 border-dashed rounded-lg p-4 bg-slate-50 dark:bg-slate-900/40 space-y-3 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className={`font-medium ${ui.textSecondary}`}>PDF Upload</p>
            <p className={`${ui.textMuted} mt-0.5`}>Drag & Drop oder Auswahl – verknüpft mit ausgewählter Verbindlichkeit</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!createNewLiability && (
              <select value={targetLiabilityId} onChange={e=>setTargetLiabilityId(e.target.value)} className={`px-2 py-1 rounded ${ui.input} text-[11px]`}> {items.map(l=> <option key={l.id} value={l.id}>{l.name.slice(0,32)}</option>)}</select>
            )}
            <label className="flex items-center gap-1 text-[10px] cursor-pointer select-none">
              <input type="checkbox" checked={createNewLiability} onChange={()=>setCreateNewLiability(v=>!v)} /> Neu anlegen
            </label>
            <label className="px-3 py-1.5 rounded bg-rose-600 text-white text-[11px] font-semibold cursor-pointer hover:bg-rose-700">
              <input type="file" accept="application/pdf" multiple className="hidden" onChange={e=>{ const list = e.target.files? Array.from(e.target.files): []; const pdfs = list.filter(f=> (f as File).type==='application/pdf'); performGlobalUpload(pdfs as File[]); e.target.value=''; }} />Auswählen
            </label>
          </div>
        </div>
        <div onDragOver={e=>{e.preventDefault(); e.dataTransfer.dropEffect='copy';}} onDrop={e=>{ e.preventDefault(); const fs = Array.from(e.dataTransfer.files||[]) as File[]; performGlobalUpload(fs.filter(f=>f.type==='application/pdf')); }} className="h-20 flex items-center justify-center text-[11px] rounded border border-slate-300 dark:border-slate-600 bg-white/70 dark:bg-slate-800/40">
          {!uploadingGlobal && (createNewLiability? 'Hier PDFs ablegen um neue Verbindlichkeit zu erstellen' : 'Hier PDF(s) ablegen')}
          {uploadingGlobal && (
            <div className="w-full px-4">
              <div className="mb-2 text-center">Lade hoch… {uploadProgressGlobal.done}/{uploadProgressGlobal.total}</div>
              <ProgressBar done={uploadProgressGlobal.done} total={uploadProgressGlobal.total} />
            </div>
          )}
        </div>
      </div>
      <div className={`${ui.card} ${ui.border} p-4 rounded-xl shadow-sm space-y-4`}>
        <div className="flex flex-col md:flex-row gap-4">
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen (Name, Gläubiger, Nummer)" className={`flex-1 px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}>
            <option value="all">Alle Kategorien</option>
            {defaultCategories.map(c=> <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterRisk} onChange={e=>setFilterRisk(e.target.value)} className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}>
            <option value="all">Alle Risiken</option>
            <option value="low">Niedrig &lt;34%</option>
            <option value="mid">Mittel 34-66%</option>
            <option value="high">Hoch ≥67%</option>
          </select>
        </div>
        {filtered.length===0 ? (
          <div className={`py-12 text-center border-2 border-dashed rounded-lg text-sm ${ui.textMuted} ${ui.border}`}>Noch keine Verbindlichkeiten erfasst.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(l => (
              <div key={l.id} className={`${ui.card} ${ui.border} rounded-xl p-5 shadow-sm flex flex-col text-[12px] dark:bg-slate-900`}>
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{l.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{l.category}{l.contractNumber? ' • '+l.contractNumber:''}</p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <button onClick={()=>openEdit(l)} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">Edit</button>
                    <button onClick={()=>openDocs(l)} className="text-xs px-2 py-1 rounded bg-indigo-100 dark:bg-indigo-600/30 hover:bg-indigo-200 dark:hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300">Docs</button>
                    <button onClick={()=>autoLinkDocumentsToLiability(l)} className="text-xs px-2 py-1 rounded bg-rose-100 dark:bg-rose-600/30 hover:bg-rose-200 dark:hover:bg-rose-600 text-rose-700 dark:text-rose-300">Auto-Verknüpfen</button>
                    <button onClick={()=>del(l.id)} className="text-xs px-2 py-1 rounded bg-red-100 dark:bg-red-600/30 hover:bg-red-200 dark:hover:bg-red-600 text-red-600 dark:text-red-300">Del</button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                  {l.outstandingAmount!=null && <div>Offen: {l.outstandingAmount.toLocaleString('de-DE')} €</div>}
                  {l.originalAmount!=null && <div>Ursprünglich: {l.originalAmount.toLocaleString('de-DE')} €</div>}
                  {l.interestRatePercent!=null && <div>Zins: {l.interestRatePercent.toFixed(2)}%</div>}
                  {l.startDate && <div>Laufzeit: {new Date(l.startDate).toLocaleDateString('de-DE')} {l.endDate && '– '+new Date(l.endDate).toLocaleDateString('de-DE')}</div>}
                  {l.tags && l.tags.length>0 && <div className="flex flex-wrap gap-1 mt-1">{l.tags.slice(0,6).map(t=> <span key={t} className={`px-2 py-0.5 rounded text-[10px] ${ui.badge}`}>{t}</span>)}{l.tags.length>6 && <span className="text-slate-400 dark:text-slate-500">+{l.tags.length-6}</span>}</div>}
                </div>
                <div className="mt-4 flex gap-2 flex-wrap text-[11px]">
                  <button disabled={aiLoadingId===l.id} onClick={()=>runAI(l)} className="px-2.5 py-1 rounded bg-emerald-600 disabled:opacity-40 text-white font-semibold hover:bg-emerald-700">KI</button>
                  <button onClick={()=>setEmailLiability(l)} className="px-2.5 py-1 rounded bg-fuchsia-600 text-white font-semibold hover:bg-fuchsia-700">Mail</button>
                  {l.aiRiskScore!=null && <span className={`px-2 py-1 rounded font-semibold ${l.aiRiskScore>0.6? 'bg-red-100 dark:bg-red-600/30 text-red-700 dark:text-red-300':'bg-amber-100 dark:bg-amber-600/30 text-amber-700 dark:text-amber-300'}`}>Risk {(l.aiRiskScore*100).toFixed(0)}%</span>}
                </div>
                {l.aiRecommendation && <div className="mt-2 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">Empfehlung: {l.aiRecommendation}</div>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className={`${ui.card} ${ui.border} max-w-2xl w-full rounded-xl p-6 space-y-4 overflow-y-auto max-h-[90vh]`}>
            <h3 className="text-lg font-bold">{editing? 'Verbindlichkeit bearbeiten':'Neue Verbindlichkeit'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Name</label>
                <input name="name" defaultValue={editing?.name||''} required className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Kategorie</label>
                <select name="category" defaultValue={editing?.category||'Sonstige'} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}>{defaultCategories.map(c=> <option key={c} value={c}>{c}</option>)}</select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Gläubiger</label>
                <input name="creditor" defaultValue={editing?.creditor||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Vertrags-/Referenz Nr.</label>
                <input name="contractNumber" defaultValue={editing?.contractNumber||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Beginn</label>
                <input type="date" name="startDate" defaultValue={editing?.startDate?.split('T')[0]||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Ende</label>
                <input type="date" name="endDate" defaultValue={editing?.endDate?.split('T')[0]||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Zahlintervall</label>
                <select name="paymentInterval" defaultValue={editing?.paymentInterval||'monatlich'} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}><option value="monatlich">monatlich</option><option value="quartal">quartal</option><option value="jährlich">jährlich</option><option value="einmalig">einmalig</option></select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Offener Betrag (€)</label>
                <input name="outstandingAmount" type="number" step="0.01" defaultValue={editing?.outstandingAmount ?? ''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Ursprünglicher Betrag (€)</label>
                <input name="originalAmount" type="number" step="0.01" defaultValue={editing?.originalAmount ?? ''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Zinssatz (%)</label>
                <input name="interestRatePercent" type="number" step="0.01" defaultValue={editing?.interestRatePercent ?? ''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Tags (Komma)</label>
                <input name="tags" defaultValue={(editing?.tags||[]).join(', ')} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Kontakt E-Mail</label>
                <input name="contactEmail" type="email" defaultValue={editing?.contactEmail||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Kontakt Telefon</label>
                <input name="contactPhone" defaultValue={editing?.contactPhone||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
              </div>
              <div className="md:col-span-2">
                <label className="block font-semibold text-slate-600 dark:text-slate-300">Notizen</label>
                <textarea name="notes" defaultValue={editing?.notes||''} rows={3} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.textarea}`} />
              </div>
              {editing && (
                <div className="md:col-span-2 text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                  {editing.aiRiskScore!=null && <div>Risk Score: {(editing.aiRiskScore*100).toFixed(0)}%</div>}
                  {editing.aiRecommendation && <div>Empfehlung: {editing.aiRecommendation}</div>}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={()=>{setShowForm(false); setEditing(null);}} className={`px-4 py-2 rounded-lg text-sm ${ui.buttonSecondary}`}>Abbrechen</button>
              <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-semibold text-sm">{isSaving? 'Speichert...':'Speichern'}</button>
            </div>
          </form>
        </div>
      )}

      {docsModalLiability && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={`${ui.card} ${ui.border} rounded-xl w-full max-w-3xl p-6 space-y-4`}>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Dokumente – {docsModalLiability.name}</h3>
              <button onClick={()=>setDocsModalLiability(null)} className="text-sm px-3 py-1 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600">Schließen</button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <label className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold cursor-pointer hover:bg-indigo-700">
                  <input type="file" className="hidden" multiple onChange={handleUploadLiabDocs} />Upload
                </label>
                <label className="flex items-center gap-1 text-[10px] text-slate-600 dark:text-slate-400">
                  <input type="checkbox" checked={autoExtractContacts} onChange={()=>setAutoExtractContacts(v=>!v)} /> Auto KI-Kontakte
                </label>
                {uploadingDoc && <span className="text-xs text-slate-500 dark:text-slate-400">Lade hoch ({uploadProgress.done}/{uploadProgress.total})...</span>}
              </div>
              <div
                onDragOver={e=>{ e.preventDefault(); e.dataTransfer.dropEffect='copy'; }}
                onDrop={e=>{ e.preventDefault(); const fs = Array.from(e.dataTransfer.files||[]) as File[]; performLiabUpload(fs); }}
                className="h-24 flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[11px] bg-slate-50 dark:bg-slate-800/30">
                  {!uploadingDoc && <span>PDF(s) hier ablegen</span>}
                  {uploadingDoc && (
                    <div className="w-full px-4">
                      <div className="mb-2 text-center">Hochladen... {uploadProgress.done}/{uploadProgress.total}</div>
                      <ProgressBar done={uploadProgress.done} total={uploadProgress.total} />
                    </div>
                  )}
              </div>
            </div>
            <div className={`max-h-80 overflow-y-auto ${ui.border} rounded-lg divide-y divide-slate-200 dark:divide-slate-700`}>
              {(liabDocs[docsModalLiability.id]||[]).map(d => (
                <div key={d.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <div className="truncate flex-1 pr-4">{d.fileName}</div>
                  <div className="flex items-center gap-2">
                    <button onClick={async ()=>{ if(confirm('Dokument löschen?')) { try { await deleteLiabilityDocument(d.id); setLiabDocs(prev=>({...prev,[docsModalLiability.id]: prev[docsModalLiability.id].filter(x=>x.id!==d.id)})); showToast?.('Dokument gelöscht','info'); } catch { showToast?.('Löschen fehlgeschlagen','error'); } } }} className="text-red-600 dark:text-red-400 text-xs px-2 py-1 rounded bg-red-50 dark:bg-red-600/20 hover:bg-red-100 dark:hover:bg-red-600/30">Del</button>
                  </div>
                </div>
              ))}
              {!liabDocs[docsModalLiability.id]?.length && <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">Noch keine Dokumente.</div>}
            </div>
            {autoExtractContacts && liabDocs[docsModalLiability.id]?.length>0 && (
              <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-400">Hinweis: Neue Uploads können automatisch Kontakte extrahieren.</div>
            )}
          </div>
        </div>
      )}
      {emailLiability && <EmailComposerModal apiKey={apiKey} liability={emailLiability} onClose={()=>setEmailLiability(null)} />}

      {/* Gruppierte Übersicht nach Kategorie */}
      {items.length>0 && (
        <div className="space-y-4">
          <h3 className={`text-lg font-bold ${ui.textPrimary}`}>Übersicht nach Kategorie</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {defaultCategories.map(cat => {
              const list = items.filter(i=>i.category===cat);
              if(!list.length) return null;
              const sumOutstanding = list.reduce((s,i)=> s + (i.outstandingAmount||0),0);
              const avgInterest = list.filter(i=>i.interestRatePercent!=null).reduce((s,i)=> s + (i.interestRatePercent||0),0) / (list.filter(i=>i.interestRatePercent!=null).length||1);
              return (
                <div key={cat} className={`${ui.card} ${ui.border} rounded-xl p-4 space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{cat}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-600 text-white font-medium">{list.length}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Offen: {sumOutstanding? sumOutstanding.toLocaleString('de-DE')+' €':'–'}</div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Ø Zins: {avgInterest? avgInterest.toFixed(2)+'%':'–'}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {list.slice(0,5).map(l=> <button key={l.id} onClick={()=>openEdit(l)} className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">{l.name.slice(0,18)}</button>)}
                    {list.length>5 && <span className="text-[10px] text-slate-400">+{list.length-5}</span>}
                  </div>
                  <button onClick={()=>{ setEditing(null); setShowForm(true); setTimeout(()=>{ const form=document.querySelector('form'); if(form){ const sel=form.querySelector('select[name="category"]') as HTMLSelectElement|null; if(sel){ sel.value=cat; } } },20); }} className="mt-2 w-full text-[11px] px-2 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700">Neue</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerbindlichkeitenView;
