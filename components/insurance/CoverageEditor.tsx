import React, { useEffect, useState } from 'react';
import { fetchCoverageItems, upsertCoverageItem, deleteCoverageItem, fetchExclusions, upsertExclusion, deleteExclusion, CoverageItem, ExclusionItem } from '../../services/coverageService';

interface CoverageEditorProps {
  policyId: string;
  ui: any;
  editable?: boolean;
  showToast?: (m:string,t?:'success'|'error'|'info')=>void;
}

const CoverageEditor: React.FC<CoverageEditorProps> = ({ policyId, ui, editable = true, showToast }) => {
  const [items, setItems] = useState<CoverageItem[]>([]);
  const [exclusions, setExclusions] = useState<ExclusionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [limit, setLimit] = useState('');
  const [deductible, setDeductible] = useState('');
  const [exLabel, setExLabel] = useState('');

  useEffect(()=>{
    let active = true;
    (async()=>{
      try {
        const [ci, ex] = await Promise.all([
          fetchCoverageItems(policyId),
          fetchExclusions(policyId)
        ]);
        if(active){ setItems(ci); setExclusions(ex); }
      } catch(e) { showToast?.('Coverage Laden fehlgeschlagen','error'); }
      finally { if(active) setLoading(false); }
    })();
    return ()=>{ active=false; };
  },[policyId]);

  const addItem = async () => {
    if(!label) return;
    setAdding(true);
    try {
      const saved = await upsertCoverageItem(policyId, { label, limit_amount: limit?Number(limit):undefined, deductible_amount: deductible?Number(deductible):undefined });
      setItems(prev=>[...prev, saved]);
      setLabel(''); setLimit(''); setDeductible('');
      showToast?.('Coverage Item hinzugefügt','success');
    } catch { showToast?.('Hinzufügen fehlgeschlagen','error'); }
    finally { setAdding(false); }
  };

  const removeItem = async (id:string) => {
    if(!confirm('Coverage Item löschen?')) return;
    try { await deleteCoverageItem(id); setItems(prev=> prev.filter(i=>i.id!==id)); } catch { showToast?.('Löschen fehlgeschlagen','error'); }
  };

  const addExclusion = async () => {
    if(!exLabel) return;
    try { const saved = await upsertExclusion(policyId,{ label: exLabel }); setExclusions(prev=>[...prev,saved]); setExLabel(''); showToast?.('Ausschluss hinzugefügt','success'); } catch { showToast?.('Ausschluss fehlgeschlagen','error'); }
  };

  const removeExclusion = async (id:string) => {
    if(!confirm('Ausschluss löschen?')) return;
    try { await deleteExclusion(id); setExclusions(prev=> prev.filter(e=>e.id!==id)); } catch { showToast?.('Löschen fehlgeschlagen','error'); }
  };

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-semibold mb-2">Coverage Items</h4>
        {loading ? <div className="text-xs text-slate-500">Lade…</div> : (
          <div className="space-y-2">
            {items.length===0 && <div className="text-xs text-slate-500">Keine Items</div>}
            {items.map(i=> (
              <div key={i.id} className={`${ui.border} rounded px-2 py-1 text-[11px] flex items-center justify-between`}> 
                <div className="flex flex-col">
                  <span className="font-medium">{i.label}</span>
                  <span className="text-[10px] text-slate-500">Limit: {i.limit_amount ?? '-'} | SB: {i.deductible_amount ?? '-'}</span>
                </div>
                {editable && <button onClick={()=>removeItem(i.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white">X</button>}
              </div>
            ))}
            {editable && (
              <div className="flex flex-col gap-2 mt-2">
                <div className="grid grid-cols-4 gap-2">
                  <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label" className={`px-2 py-1 rounded text-xs ${ui.input}`} />
                  <input value={limit} onChange={e=>setLimit(e.target.value)} placeholder="Limit" className={`px-2 py-1 rounded text-xs ${ui.input}`} />
                  <input value={deductible} onChange={e=>setDeductible(e.target.value)} placeholder="Selbstb." className={`px-2 py-1 rounded text-xs ${ui.input}`} />
                  <button disabled={adding} onClick={addItem} className="text-xs px-2 py-1 rounded bg-emerald-600 text-white">{adding? '...':'Add'}</button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-2">Ausschlüsse</h4>
        <div className="space-y-2">
          {exclusions.length===0 && <div className="text-xs text-slate-500">Keine Ausschlüsse</div>}
          {exclusions.map(e=> (
            <div key={e.id} className={`${ui.border} rounded px-2 py-1 text-[11px] flex items-center justify-between`}> 
              <span>{e.label}</span>
              {editable && <button onClick={()=>removeExclusion(e.id)} className="text-[10px] px-2 py-0.5 rounded bg-red-500 text-white">X</button>}
            </div>
          ))}
        </div>
        {editable && (
          <div className="flex gap-2 mt-2">
            <input value={exLabel} onChange={e=>setExLabel(e.target.value)} placeholder="Ausschluss" className={`px-2 py-1 rounded text-xs ${ui.input}`} />
            <button onClick={addExclusion} className="text-xs px-2 py-1 rounded bg-blue-600 text-white">Add</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CoverageEditor;
