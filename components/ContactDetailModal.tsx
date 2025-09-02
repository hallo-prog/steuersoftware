import React, { useEffect, useState } from 'react';
import { Contact, Document, Liability, InsurancePolicy } from '../types';
import { upsertContact } from '../services/supabaseDataService';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface Props {
  userId: string;
  contact: Contact;
  documents: Document[];
  liabilities: Liability[];
  policies: InsurancePolicy[];
  onClose: () => void;
  onUpdated?: (c: Contact) => void;
}

const ContactDetailModal: React.FC<Props> = ({ userId, contact, documents, liabilities, policies, onClose, onUpdated }) => {
  const [notes, setNotes] = useState(contact.notes||'');
  const [tags, setTags] = useState<string[]>((contact.tags||[]));
  const [saving, setSaving] = useState(false);
  const ui = useThemeClasses();

  const relatedDocs = documents.filter(d => (contact.sourceIds||[]).includes(d.id));
  const relatedLiabs = liabilities.filter(l => l.creditor && contact.name && l.creditor.toLowerCase().includes(contact.name.toLowerCase()));
  const relatedPolicies = policies.filter(p => (p.insurer && contact.name && p.insurer.toLowerCase().includes(contact.name.toLowerCase())) || (p.name && contact.name && p.name.toLowerCase().includes(contact.name.toLowerCase())));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await upsertContact(userId, { ...contact, notes, tags } as any);
      onUpdated?.(updated);
      window.dispatchEvent(new CustomEvent('contacts-updated'));
      onClose();
    } catch (e) { console.warn('Kontakt speichern fehlgeschlagen', e); alert('Speichern fehlgeschlagen'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`${ui.card} ${ui.border} rounded-xl w-full max-w-2xl p-6 space-y-5 shadow-xl`}>
        <div className="flex justify-between items-start gap-4">
          <div>
            <h3 className={`text-xl font-bold ${ui.textPrimary}`}>{contact.name}</h3>
            <p className={`text-xs mt-1 ${ui.textMuted}`}>Typ: {contact.type}</p>
            {contact.aiSummary && <p className="mt-2 text-[11px] whitespace-pre-line text-slate-600 dark:text-slate-300">{contact.aiSummary}</p>}
          </div>
          <button onClick={onClose} className={`px-3 py-1.5 rounded text-sm ${ui.buttonSecondary}`}>Schließen</button>
        </div>
        <div className="grid md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-3">
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Kontakt</h4>
              <div className={`text-[13px] space-y-1 ${ui.textSecondary}`}>
                {contact.email && <div>E-Mail: <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400 hover:underline">{contact.email}</a></div>}
                {contact.phone && <div>Tel: <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400 hover:underline">{contact.phone}</a></div>}
                {contact.lastDocumentDate && <div>Letztes Dokument: {new Date(contact.lastDocumentDate).toLocaleDateString('de-DE')}</div>}
              </div>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Tags</h4>
              <div className="flex flex-wrap gap-1 mb-2">
                {tags.map(t => <span key={t} className={`px-2 py-0.5 text-[10px] rounded ${ui.badge}`}>{t}</span>)}
                <button onClick={()=>{ const nv = prompt('Neuer Tag'); if(nv){ setTags(prev=> Array.from(new Set([...prev, nv.trim()])));} }} className="px-2 py-0.5 text-[10px] rounded bg-emerald-600 text-white">+</button>
              </div>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Notizen</h4>
              <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={5} className={`w-full px-3 py-2 rounded text-xs ${ui.textarea}`} placeholder="Freitext..." />
            </div>
            <div className="pt-1">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold">{saving? 'Speichert...' : 'Speichern'}</button>
            </div>
          </div>
          <div className="space-y-5">
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Verknüpfte Dokumente ({relatedDocs.length})</h4>
              <div className="max-h-40 overflow-y-auto space-y-1 pr-1 text-[11px]">
                {relatedDocs.length? relatedDocs.map(d => <div key={d.id} className={`flex justify-between gap-2 py-1 ${ui.divider.replace('border-b','border-b')}`}><span className="truncate" title={d.name}>{d.name}</span><span className="text-slate-500 dark:text-slate-400">{d.totalAmount!=null? d.totalAmount.toFixed(2)+'€':''}</span></div>) : <div className="text-slate-400 dark:text-slate-500">Keine</div>}
              </div>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Zugeordnete Verbindlichkeiten ({relatedLiabs.length})</h4>
              <div className="max-h-32 overflow-y-auto text-[11px] space-y-1 pr-1">
                {relatedLiabs.length? relatedLiabs.map(l => <div key={l.id} className={`flex justify-between gap-2 py-1 ${ui.divider.replace('border-b','border-b')}`}><span className="truncate" title={l.name}>{l.name}</span><span className="text-slate-500 dark:text-slate-400">{l.outstandingAmount!=null? l.outstandingAmount.toLocaleString('de-DE')+'€':''}</span></div>) : <div className="text-slate-400 dark:text-slate-500">Keine</div>}
              </div>
            </div>
            <div>
              <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${ui.textMuted}`}>Zugeordnete Policen ({relatedPolicies.length})</h4>
              <div className="max-h-32 overflow-y-auto text-[11px] space-y-1 pr-1">
                {relatedPolicies.length? relatedPolicies.map(p => <div key={p.id} className={`flex justify-between gap-2 py-1 ${ui.divider.replace('border-b','border-b')}`}><span className="truncate" title={p.name}>{p.name}</span><span className="text-slate-500 dark:text-slate-400">{p.premiumAmount!=null? p.premiumAmount.toLocaleString('de-DE')+'€':''}</span></div>) : <div className="text-slate-400 dark:text-slate-500">Keine</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactDetailModal;