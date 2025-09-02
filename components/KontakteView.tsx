import React, { useEffect, useState } from 'react';
import { Contact, Document, InsurancePolicy, Liability } from '../types';
import { fetchContacts } from '../services/supabaseDataService';
import ShieldIcon from './icons/ShieldIcon';
import DebtIcon from './icons/DebtIcon';
import FolderIcon from './icons/FolderIcon';
import ContactDetailModal from './ContactDetailModal';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface Props { userId:string; apiKey:string; documents: Document[]; policies: InsurancePolicy[]; liabilities: Liability[]; }

const KontakteView: React.FC<Props> = ({ userId, apiKey, documents, policies, liabilities }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selected, setSelected] = useState<Contact|null>(null);
  const ui = useThemeClasses();

  const load = async () => { try { setIsLoading(true); const list = await fetchContacts(userId); setContacts(list); } catch {} finally { setIsLoading(false);} };
  useEffect(()=> { load(); },[userId]);
  useEffect(()=> {
    const handler = () => { load(); };
    window.addEventListener('contacts-updated', handler as any);
    return () => window.removeEventListener('contacts-updated', handler as any);
  },[]);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className={`text-3xl font-bold flex items-center gap-3 ${ui.textPrimary}`}>Kontakte</h2>
        <div className={`text-sm ${ui.textMuted}`}>Gesamt: {contacts.length}</div>
      </div>
      <div className={`${ui.card} ${ui.border} p-4 rounded-xl shadow-sm`}>
        {isLoading && <div className={`text-sm ${ui.textMuted}`}>Lade Kontakte...</div>}
        {!isLoading && contacts.length===0 && <div className={`text-sm py-12 text-center ${ui.textMuted}`}>Noch keine Kontakte erfasst.</div>}
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
          {contacts.map(c => (
            <button key={c.id} onClick={()=>setSelected(c)} className={`text-left p-4 rounded-lg shadow-sm text-sm flex flex-col gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 ${ui.card} ${ui.border} hover:border-blue-400`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className={`font-semibold text-sm ${ui.textPrimary}`}>{c.name}</h3>
                  <p className={`text-xs mt-0.5 ${ui.textMuted}`}>{c.type}</p>
                </div>
                <div className="flex gap-1">
                  {c.type==='Versicherung' && <ShieldIcon className="w-4 h-4 text-blue-500"/>}
                  {c.type==='Gläubiger' && <DebtIcon className="w-4 h-4 text-rose-500"/>}
                  {c.type==='Vendor' && <FolderIcon className="w-4 h-4 text-amber-500"/>}
                </div>
              </div>
              {(c.email || c.phone) && <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                {c.email && <div>E-Mail: {c.email}</div>}
                {c.phone && <div>Tel: {c.phone}</div>}
              </div>}
              {c.aiSummary && <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-3">{c.aiSummary}</div>}
              {c.tags && c.tags.length>0 && <div className="flex flex-wrap gap-1">{c.tags.slice(0,5).map(t=> <span key={t} className={`px-2 py-0.5 rounded text-[10px] ${ui.badge}`}>{t}</span>)}{c.tags.length>5 && <span className="text-slate-400 text-[10px]">+{c.tags.length-5}</span>}</div>}
            </button>
          ))}
        </div>
      </div>
      {selected && <ContactDetailModal userId={userId} contact={selected} documents={documents} liabilities={liabilities} policies={policies} onClose={()=>setSelected(null)} onUpdated={(upd)=> setContacts(prev=> prev.map(c=>c.id===upd.id? upd : c))} />}
    </div>
  );
};

export default KontakteView;
