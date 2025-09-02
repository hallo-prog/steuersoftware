import React, { useState, useEffect } from 'react';
import { InsurancePolicy, InsuranceClaim, InsuranceType, InsuranceClaimType, Document, InsuranceDocument } from '../types';
import { extractInsurancePolicyFromFiles, summarizeInsuranceClaim } from '../services/geminiLazy';
import SparklesIcon from './icons/SparklesIcon';
import { PlusIcon } from './icons/PlusIcon';
import { fetchPolicies, fetchClaims, deletePolicyDB, upsertClaim, deleteClaimDB, updateDocument, fetchPolicyDocuments, uploadPolicyDocument, deletePolicyDocument, deleteFileFromPublicUrl } from '../services/supabaseDataService';
import { createOrUpdatePolicy } from '../services/policyService';
import { assessAndStoreRisk } from '../services/riskService';
import { transitionClaim, allowedTransitions } from '../services/claimService';
import { useLatestRiskAssessment } from '../hooks/useLatestRiskAssessment';
import PolicyFormModal from './insurance/PolicyFormModal';
import ClaimFormModal from './insurance/ClaimFormModal';
// Ausgelagerte Subcomponents
import PolicyDocumentsModal from './insurance/PolicyDocumentsModal.tsx';
import PolicyList from './insurance/PolicyList';
import PolicyListSkeleton from './insurance/PolicyListSkeleton';
import PolicyUploadZone from './insurance/PolicyUploadZone';
import RiskPanel from './insurance/RiskPanel';
import { fetchOpenAlertsForPolicies, generateRenewalAlertsForPolicies, PolicyAlert } from '../services/alertService';
import PolicyAlertsModal from './insurance/PolicyAlertsModal';
import { useThemeClasses } from '../hooks/useThemeClasses';
import ProgressBar from './ProgressBar';

interface VersicherungenViewProps { apiKey: string; userId: string; documents: Document[]; showToast?: (msg:string,type?:'success'|'error'|'info')=>void; }

// Lokale Helper zum Generieren von IDs
const genId = (p: string) => p + '-' + Math.random().toString(36).slice(2,10);

const defaultTypes: InsuranceType[] = ['Betriebshaftpflicht','Hausrat','Private Rechtsschutz','Betriebliche Rechtsschutz','KFZ','Sonstige'];

const VersicherungenView: React.FC<VersicherungenViewProps> = ({ apiKey, userId, documents, showToast }) => {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<InsurancePolicy | null>(null);
  const [showClaimForm, setShowClaimForm] = useState<{policyId:string}|null>(null);
  const [policyFilter, setPolicyFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [filesForExtraction, setFilesForExtraction] = useState<File[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [docsModalPolicy, setDocsModalPolicy] = useState<InsurancePolicy | null>(null);
  const [policyDocs, setPolicyDocs] = useState<Record<string, (InsuranceDocument & { publicUrl?:string })[]>>({});
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [autoExtractPolicyDocs, setAutoExtractPolicyDocs] = useState(true);
  const [policyAlerts, setPolicyAlerts] = useState<Record<string, PolicyAlert[]>>({});
  const [alertsModalPolicy, setAlertsModalPolicy] = useState<InsurancePolicy|null>(null);
  const ui = useThemeClasses();

  // Extrahierte Subcomponents: PolicyUploadZone, PolicyList, ClaimList

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const [p,c] = await Promise.all([
          fetchPolicies(userId),
          fetchClaims(userId)
        ]);
        if (!active) return;
  setPolicies(p);
  setClaims(c);
  try { const map = await fetchOpenAlertsForPolicies(p.map(x=>x.id)); if(active) setPolicyAlerts(map); } catch {}
      } catch (e) {
        console.warn('Load insurance data failed', e); showToast?.('Versicherungsdaten Laden fehlgeschlagen','error');
      } finally { if (active) setIsLoading(false); }
    })();
    return () => { active = false; };
  }, [userId]);

  const filteredPolicies = policies.filter(p => {
    const typeOk = policyFilter === 'all' || p.type === policyFilter;
    const q = search.toLowerCase().trim();
    const searchOk = !q || [p.name, p.insurer, p.policyNumber, p.coverageSummary].filter(Boolean).some(v => v!.toLowerCase().includes(q));
    return typeOk && searchOk;
  });

  const handlePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const data: Partial<InsurancePolicy> = Object.fromEntries(fd.entries());
  const patch: Partial<InsurancePolicy> = {
      id: editingPolicy?.id,
      name: (data.name as string)||editingPolicy?.name,
      type: (data.type as InsuranceType)||editingPolicy?.type,
      insurer: data.insurer as string,
      policyNumber: data.policyNumber as string,
      startDate: data.startDate as string,
      endDate: data.endDate as string,
      paymentInterval: data.paymentInterval as any,
      premiumAmount: data.premiumAmount ? Number(data.premiumAmount) : (editingPolicy?.premiumAmount),
      coverageSummary: data.coverageSummary as string,
      contactPhone: data.contactPhone as string,
      contactEmail: data.contactEmail as string,
    };
    setIsSaving(true);
    try {
  const saved = await createOrUpdatePolicy(userId, patch);
      setPolicies(prev => {
        const exists = prev.some(p=>p.id===saved.id); return exists? prev.map(p=>p.id===saved.id?saved:p): [saved, ...prev];
      });
      showToast?.('Police gespeichert','success');
      setShowPolicyForm(false); setEditingPolicy(null); form.reset();
    } catch (e) { console.warn('Save policy failed', e); showToast?.('Speichern fehlgeschlagen','error'); }
    finally { setIsSaving(false); }
  };

  const handlePolicyExtraction = async () => {
    if (!filesForExtraction.length) { alert('Bitte zuerst Dokument(e) auswählen.'); return; }
    setIsExtracting(true);
    try {
      const result = await extractInsurancePolicyFromFiles(apiKey, filesForExtraction);
      // Vorbefüllen Formular für neue Police
      setEditingPolicy(null);
      setShowPolicyForm(true);
      // wait for next tick then patch values via small timeout
      setTimeout(()=>{
        const form = document.querySelector('form');
        if (form) {
          const setVal = (name:string, value:any) => { const el = form.querySelector(`[name="${name}"]`) as HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement|null; if (el && value!=null) el.value = String(value); };
          setVal('name', result.name||'Police');
            setVal('insurer', result.insurer||'');
            setVal('policyNumber', result.policyNumber||'');
            if (result.startDate) setVal('startDate', result.startDate.substring(0,10));
            if (result.endDate) setVal('endDate', result.endDate.substring(0,10));
            if (result.paymentInterval) setVal('paymentInterval', result.paymentInterval);
            if (result.premiumAmount!=null) setVal('premiumAmount', result.premiumAmount);
            setVal('coverageSummary', result.coverageSummary||'');
            if (result.coverageItems && result.coverageItems.length) setVal('coverageItems', result.coverageItems.join('\n'));
            if (result.exclusions && result.exclusions.length) setVal('exclusions', result.exclusions.join('\n'));
            setVal('contactEmail', result.contactEmail||'');
            setVal('contactPhone', result.contactPhone||'');
            if (result.type) setVal('type', result.type);
        }
      },50);
    } catch (e:any) {
      alert('Extraktion fehlgeschlagen: '+ (e.message||e));
    } finally {
      setIsExtracting(false);
    }
  };

  const openEdit = (p: InsurancePolicy) => { setEditingPolicy(p); setShowPolicyForm(true); };
  const deletePolicy = async (id: string) => { if (confirm('Police löschen?')) { try { await deletePolicyDB(id); setPolicies(prev => prev.filter(p=>p.id!==id)); showToast?.('Police gelöscht','info'); } catch (e) { showToast?.('Löschen fehlgeschlagen','error'); } } };

  const relatedClaims = (policyId: string) => claims.filter(c => c.policyId === policyId);

  const autoLinkDocumentsToPolicy = async (policy: InsurancePolicy) => {
    if (!policy.policyNumber) { showToast?.('Keine Policennummer zum Verknüpfen','info'); return []; }
    const norm = policy.policyNumber.toLowerCase();
    const matched = documents.filter(d => (d.textContent && d.textContent.toLowerCase().includes(norm)) || (d.invoiceNumber && d.invoiceNumber.toLowerCase()===norm));
    let success = 0;
    for (const m of matched) {
      try { await updateDocument(m.id, { insurancePolicyId: policy.id }); success++; } catch {}
    }
    showToast?.(success? `${success} Beleg(e) verknüpft` : 'Keine passenden Belege gefunden', success?'success':'info');
    return matched;
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showClaimForm) return;
    const form = e.target as HTMLFormElement; const fd = new FormData(form); const data = Object.fromEntries(fd.entries());
    try {
      const saved = await upsertClaim(userId, { policyId: showClaimForm.policyId, type: data.type as InsuranceClaimType, title: data.title as string, description: data.description as string, status: 'offen' });
      setClaims(prev => [saved, ...prev]);
      showToast?.('Fall erstellt','success');
      setShowClaimForm(null); form.reset();
    } catch (e) { showToast?.('Fall erstellen fehlgeschlagen','error'); }
  };

  const runClaimAI = async (cl: InsuranceClaim) => {
    if (cl.aiSummary && cl.aiRecommendation) return; // schon vorhanden
    const relatedDocs = documents.filter(d => d.insurancePolicyId === cl.policyId);
    const res = await summarizeInsuranceClaim(apiKey, cl, relatedDocs);
    try {
      const updated = await upsertClaim(userId, { id: cl.id, policyId: cl.policyId, type: cl.type, title: cl.title, description: cl.description, status: cl.status, aiSummary: res.summary, aiRecommendation: res.recommendation });
      setClaims(prev => prev.map(c => c.id===cl.id ? updated : c));
      showToast?.('KI Analyse abgeschlossen','success');
    } catch (e) { showToast?.('KI Analyse speichern fehlgeschlagen','error'); }
  };

  const exportClaimDossier = (cl: InsuranceClaim) => {
    const policy = policies.find(p=>p.id===cl.policyId);
    const docs = documents.filter(d=>d.insurancePolicyId===cl.policyId);
    const win = window.open('', '_blank'); if (!win) return;
    win.document.write('<html><head><title>Dossier</title><style>body{font-family:sans-serif;} h1{font-size:20px;} table{border-collapse:collapse;width:100%;margin-top:10px;} td,th{border:1px solid #ccc;padding:4px;font-size:12px;} .sec{margin-top:18px;} pre{white-space:pre-wrap;font-size:12px;background:#f8fafc;padding:8px;border:1px solid #e2e8f0;border-radius:6px;} .badge{display:inline-block;background:#2563eb;color:#fff;padding:2px 6px;border-radius:4px;font-size:10px;margin-left:6px;}</style></head><body>');
    win.document.write(`<h1>Versicherungsfall: ${cl.title} <span class="badge">${cl.type}</span></h1>`);
    if (policy) win.document.write(`<div class="sec"><strong>Police:</strong> ${policy.name} (${policy.policyNumber||'k.A.'}) – ${policy.type}</div>`);
    win.document.write(`<div class="sec"><strong>Beschreibung:</strong><br/>${cl.description||'-'}</div>`);
    win.document.write('<div class="sec"><strong>Verknüpfte Belege:</strong><table><thead><tr><th>Name</th><th>Betrag</th><th>Datum</th><th>Vendor</th></tr></thead><tbody>');
    docs.forEach(d=> win!.document!.write(`<tr><td>${d.name}</td><td>${d.totalAmount??''}</td><td>${new Date(d.date).toLocaleDateString('de-DE')}</td><td>${d.vendor||''}</td></tr>`));
    win.document.write('</tbody></table></div>');
    const updatedClaim = claims.find(c=>c.id===cl.id);
    if (updatedClaim?.aiSummary) win.document.write(`<div class="sec"><strong>KI Zusammenfassung:</strong><pre>${updatedClaim.aiSummary}</pre></div>`);
    if (updatedClaim?.aiRecommendation) win.document.write(`<div class="sec"><strong>KI Empfehlung:</strong><pre>${updatedClaim.aiRecommendation}</pre></div>`);
    win.document.write('</body></html>');
    win.document.close(); win.focus(); win.print();
  };

  return (
  <div className="space-y-8">
      {!apiKey && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-700 px-4 py-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3">
          <div className="font-semibold mt-0.5">Hinweis</div>
          <div className="leading-snug">
            Kein <code>GEMINI_API_KEY</code> konfiguriert. KI-Funktionen (Extraktion, Risikoanalyse, Claim Analyse) sind deaktiviert. Trage den Schlüssel unter Einstellungen ein um volle Funktionalität zu erhalten.
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h2 className={`text-3xl font-bold flex items-center gap-2 ${ui.textPrimary}`}>Versicherungen <SparklesIcon className="w-6 h-6 text-blue-500" /></h2>
        <div className="flex gap-2">
          <button onClick={()=>{setEditingPolicy(null); setShowPolicyForm(true);}} className="flex items-center bg-blue-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"><PlusIcon className="w-4 h-4 mr-2"/>Police</button>
          <label className={`flex items-center font-medium px-3 py-2 rounded-lg text-sm cursor-pointer ${ui.buttonSecondary}`}>
            <input type="file" multiple className="hidden" onChange={e=> setFilesForExtraction(e.target.files? Array.from(e.target.files): [])} />Dokumente
          </label>
          <button onClick={handlePolicyExtraction} disabled={!filesForExtraction.length || isExtracting || !apiKey} title={apiKey? undefined:'Kein GEMINI_API_KEY gesetzt'} className="flex items-center bg-emerald-600 disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm">{isExtracting? 'KI extrahiert...' : 'Kathi analysieren'}</button>
          <button onClick={async ()=>{ try { const created = await generateRenewalAlertsForPolicies(policies); if(created.length){ setPolicyAlerts(prev=>{ const copy={...prev}; created.forEach(a=>{ if(!copy[a.policy_id]) copy[a.policy_id]=[]; copy[a.policy_id]=[a,...copy[a.policy_id]]; }); return copy; }); showToast?.(`${created.length} Renewal Alerts erzeugt`,'success'); } else showToast?.('Keine neuen Renewal Alerts','info'); } catch { showToast?.('Alert Generierung Fehler','error'); } }} className="flex items-center bg-amber-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-amber-700 text-sm">Renewal Check</button>
        </div>
      </div>
  <div className={`${ui.card} ${ui.border} p-4 rounded-xl shadow-sm space-y-6`}>
        {/* Direkte Upload-Zone für neue Policy-Dokumente (Drag & Drop) */}
  <PolicyUploadZone />
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Suchen (Name, Versicherer, Nummer)" className={`w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <select value={policyFilter} onChange={e=>setPolicyFilter(e.target.value)} className={`px-3 py-2 rounded-lg text-sm ${ui.input}`}>
              <option value="all">Alle Typen</option>
              {defaultTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
  {isLoading ? <PolicyListSkeleton /> : filteredPolicies.length === 0 ? (
          <div className={`py-12 text-center border-2 border-dashed rounded-lg text-sm ${ui.textMuted} ${ui.border}`}>Noch keine Policen erfasst.</div>
        ) : (
          <PolicyList
            policies={filteredPolicies}
            claims={claims}
            policyDocs={policyDocs}
            policyAlerts={policyAlerts}
            ui={ui}
            onEdit={openEdit}
            onDelete={deletePolicy}
            onAssessRisk={async (p)=>{ if(!apiKey){ showToast?.('Kein GEMINI_API_KEY konfiguriert','info'); return; } try { const res = await assessAndStoreRisk(apiKey, p as any, policies as any); const saved = await createOrUpdatePolicy(userId, { id:p.id, riskScore: res.riskScore, riskGaps: res.riskGaps, riskRecommendation: res.recommendation } as any); setPolicies(prev=> prev.map(x=>x.id===p.id?saved:x)); showToast?.('Risiko aktualisiert','success'); } catch { showToast?.('Risikoanalyse fehlgeschlagen','error'); } }}
            onCreateClaim={(policyId)=> setShowClaimForm({policyId})}
            onAutoLink={autoLinkDocumentsToPolicy}
            onOpenDocuments={async (p)=>{ setDocsModalPolicy(p); if (!policyDocs[p.id]) { try { const docs = await fetchPolicyDocuments(p.id); setPolicyDocs(prev=>({...prev,[p.id]:docs})); } catch { showToast?.('Dokumente laden fehlgeschlagen','error'); } } }}
            onRunClaimAI={runClaimAI}
            onExportClaim={exportClaimDossier}
            onTransitionClaim={async (cl, next)=>{ try { const updated = await transitionClaim(userId, cl as any, next as any); setClaims(prev=> prev.map(c=>c.id===cl.id? updated: c)); showToast?.('Status aktualisiert','success'); } catch (e:any) { showToast?.(e?.message||'Transition Fehler','error'); } }}
            aiEnabled={!!apiKey}
          />
        )}
      </div>

      {/* Policy Form Modal */}
  {showPolicyForm && (
    <PolicyFormModal
      ui={ui}
      defaultTypes={defaultTypes}
      editingPolicy={editingPolicy}
      isSaving={isSaving}
      onClose={()=>{setShowPolicyForm(false); setEditingPolicy(null);}}
      onSubmit={handlePolicySubmit}
    />
  )}

      {/* Claim Form Modal */}
      {showClaimForm && (
        <ClaimFormModal ui={ui} onClose={()=>setShowClaimForm(null)} onSubmit={handleClaimSubmit} />
      )}

      {docsModalPolicy && (
        <PolicyDocumentsModal
          ui={ui}
          policy={docsModalPolicy}
            policies={policies}
          policyDocs={policyDocs[docsModalPolicy.id]||[]}
          autoExtract={autoExtractPolicyDocs}
          uploading={uploadingDoc}
          onToggleAutoExtract={()=>setAutoExtractPolicyDocs(v=>!v)}
          onClose={()=>setDocsModalPolicy(null)}
          onUpload={async (files)=>{
            setUploadingDoc(true);
            try {
              const list: (InsuranceDocument & { publicUrl?:string })[] = [];
              const errors: {file:string; message:string}[] = [];
              const controller = new AbortController();
              (window as any).__policyDocsModalAbort = controller;
              for (const file of files) {
                try {
                  const up = await uploadPolicyDocument(userId, docsModalPolicy.id, file, undefined, { signal: controller.signal });
                  list.push(up);
                  if (autoExtractPolicyDocs) {
                    try {
                      const res = await extractInsurancePolicyFromFiles(apiKey, [file]);
                      const policy = policies.find(p=>p.id===docsModalPolicy.id);
                      if (policy && res) {
                        const suggestions: string[] = [];
                        if (res.policyNumber && !policy.policyNumber) suggestions.push('Policennummer: '+res.policyNumber);
                        if (res.insurer && !policy.insurer) suggestions.push('Versicherer: '+res.insurer);
                        if (res.premiumAmount && !policy.premiumAmount) suggestions.push('Prämie: '+res.premiumAmount);
                        if (res.coverageItems && (!policy.coverageItems||policy.coverageItems.length<res.coverageItems.length)) suggestions.push('Coverage Items ('+res.coverageItems.length+')');
                        if (suggestions.length) {
                          if (confirm('KI hat neue Felder erkannt:\n'+suggestions.join('\n')+'\nÜbernehmen?')) {
                            try {
                              const saved = await createOrUpdatePolicy(userId, { id: policy.id, policyNumber: policy.policyNumber||res.policyNumber, insurer: policy.insurer||res.insurer, premiumAmount: policy.premiumAmount||res.premiumAmount, coverageItems: (policy.coverageItems && policy.coverageItems.length? policy.coverageItems : res.coverageItems)||policy.coverageItems, coverageSummary: policy.coverageSummary||res.coverageSummary });
                              setPolicies(prev=> prev.map(p=>p.id===policy.id?saved:p));
                              showToast?.('Policy aktualisiert','success');
                            } catch (se) { console.warn('Policy update after extraction failed', se); }
                          }
                        }
                      }
                    } catch (ee) { console.warn('Auto extraction failed', ee); }
                  }
                } catch (er:any) {
                  if (er?.name==='AbortError') { showToast?.('Upload abgebrochen','info'); break; }
                  console.warn('Upload Policy Doc (modal) failed', file.name, er);
                  errors.push({file: file.name, message: er?.message||'Fehler'});
                }
              }
              setPolicyDocs(prev=> ({...prev, [docsModalPolicy.id]: [...(prev[docsModalPolicy.id]||[]), ...list]}));
              if (list.length && !errors.length) { showToast?.(`${list.length} Datei(en) hochgeladen`,'success'); }
              else if (list.length && errors.length) { showToast?.(`${list.length} ok, ${errors.length} Fehler`,'info'); }
              else if (!list.length && errors.length) { showToast?.(`Upload fehlgeschlagen (${errors[0].file}): ${errors[0].message}`,'error'); }
            } finally { setUploadingDoc(false); }
          }}
          onDeleteDoc={async (doc)=>{
            if(confirm('Dokument löschen?')) { try { await deletePolicyDocument(doc.id); await deleteFileFromPublicUrl(doc.publicUrl); setPolicyDocs(prev=> ({...prev, [docsModalPolicy.id]: prev[docsModalPolicy.id].filter(x=>x.id!==doc.id)})); showToast?.('Dokument gelöscht','info'); } catch { showToast?.('Löschen fehlgeschlagen','error'); } }
          }}
          onResolvePublicUrl={async (doc)=>{
            try { const { data:pub } = (await import('../src/supabaseClient')).supabase!.storage.from('insurance').getPublicUrl(doc.storagePath!); if (pub?.publicUrl) { doc.publicUrl = pub.publicUrl; setPolicyDocs(prev=> ({...prev,[docsModalPolicy.id]: prev[docsModalPolicy.id].map(x=> x.id===doc.id? {...x, publicUrl: pub.publicUrl}: x)})); } else showToast?.('Keine öffentliche URL erzeugbar','info'); } catch { showToast?.('URL Fehler','error'); }
          }}
        />
      )}
      {alertsModalPolicy && (
        <PolicyAlertsModal
          ui={ui}
          policyName={alertsModalPolicy.name}
          alerts={policyAlerts[alertsModalPolicy.id]||[]}
          onClose={()=>setAlertsModalPolicy(null)}
          onResolved={(id)=> setPolicyAlerts(prev=> ({...prev, [alertsModalPolicy.id]: prev[alertsModalPolicy.id].filter(a=>a.id!==id)}))}
        />
      )}
      {/* Risiko Panel Beispiel für erste gefilterte Police */}
      {filteredPolicies[0] && (
  <RiskPanel
          policy={filteredPolicies[0]}
          apiKey={apiKey}
          allPolicies={policies}
          ui={ui}
          userId={userId}
          onPolicyRiskUpdate={(id, patch)=> setPolicies(prev=> prev.map(p=>p.id===id? {...p, ...patch}: p))}
          showToast={showToast}
        />
      )}

      {/* Gruppierte Übersicht nach Typ */}
      {policies.length>0 && (
        <div className="space-y-4">
          <h3 className={`text-lg font-bold ${ui.textPrimary}`}>Übersicht nach Typ</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {defaultTypes.map(t=> {
              const list = policies.filter(p=>p.type===t);
              if(!list.length) return null;
              const totalPremium = list.reduce((s,p)=> s + (p.premiumAmount||0),0);
              return (
                <div key={t} className={`${ui.card} ${ui.border} rounded-xl p-4 space-y-2`}> 
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{t}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-blue-600 text-white font-medium">{list.length}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400">Summe Prämien: {totalPremium? totalPremium.toLocaleString('de-DE')+' €':'–'}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {list.slice(0,5).map(p=> <button key={p.id} onClick={()=>openEdit(p)} className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600">{p.name.slice(0,18)}</button>)}
                    {list.length>5 && <span className="text-[10px] text-slate-400">+{list.length-5}</span>}
                  </div>
                  <button onClick={()=>{ setEditingPolicy(null); setShowPolicyForm(true); setTimeout(()=>{ const form=document.querySelector('form'); if(form){ const sel=form.querySelector('select[name="type"]') as HTMLSelectElement|null; if(sel){ sel.value=t; } } },20); }} className="mt-2 w-full text-[11px] px-2 py-1 rounded bg-emerald-600 text-white font-semibold hover:bg-emerald-700">Neue Police</button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default VersicherungenView;