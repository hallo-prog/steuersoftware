import React, { useState } from 'react';
import { Liability } from '../types';
import { createEmailFromTemplate } from '../services/geminiLazy';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface Props {
  apiKey: string;
  liability: Liability | null;
  onClose: () => void;
}

const templates = [
  { id: 'ratenzahlung', label: 'Ratenzahlungs-Vorschlag', fields: [ { name:'rate', label:'Monatliche Rate (€)', type:'number', placeholder:'500' }, { name:'start', label:'Start (YYYY-MM)', type:'text', placeholder:'2025-01' } ] },
  { id: 'zahlungspause', label: 'Zahlungspause', fields: [ { name:'dauer', label:'Monate Pause', type:'number', placeholder:'3' }, { name:'grund', label:'Begründung', type:'text', placeholder:'Vorübergehende Liquiditätsbelastung' } ] }
] as const;

const EmailComposerModal: React.FC<Props> = ({ apiKey, liability, onClose }) => {
  const [template, setTemplate] = useState<'ratenzahlung'|'zahlungspause'>('ratenzahlung');
  const [params, setParams] = useState<Record<string,string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  if (!liability) return null;
  const meta = templates.find(t=>t.id===template)!;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await createEmailFromTemplate(apiKey, { template, params, liability });
      setSubject(res.subject); setBody(res.body);
    } finally { setIsGenerating(false); }
  };

  const ui = useThemeClasses();
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className={`${ui.card} rounded-xl w-full max-w-2xl p-6 space-y-4 shadow-xl ${ui.border} transition-colors`}> 
        <div className="flex justify-between items-center">
      <h3 className={`text-lg font-bold ${ui.textPrimary}`}>E-Mail Assistent – {liability.name}</h3>
      <button onClick={onClose} className={`text-sm px-3 py-1 rounded ${ui.buttonSecondary}`}>Schließen</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs items-start">
          <div className="md:col-span-1 space-y-3">
            <div>
        <label className={`block font-semibold ${ui.textSecondary} mb-1`}>Vorlage</label>
        <select value={template} onChange={e=>{ setTemplate(e.target.value as any); setParams({}); setSubject(''); setBody(''); }} className={`w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}> 
                {templates.map(t=> <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              {meta.fields.map(f => (
                <div key={f.name}>
          <label className={`block text-[11px] font-medium ${ui.textSecondary}`}>{f.label}</label>
          <input type={f.type} placeholder={f.placeholder} value={params[f.name]||''} onChange={e=> setParams(p=>({...p, [f.name]: e.target.value }))} className={`mt-1 w-full px-2 py-1.5 rounded text-xs ${ui.input}`} />
                </div>
              ))}
            </div>
            <button onClick={handleGenerate} disabled={isGenerating} className="mt-2 w-full px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40">{isGenerating? 'Generiere…':'Vorlage erzeugen'}</button>
          </div>
          <div className="md:col-span-2 space-y-3">
            <div>
        <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Betreff</label>
        <input value={subject} onChange={e=>setSubject(e.target.value)} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} placeholder="Betreff" />
            </div>
            <div>
        <label className={`block text-xs font-semibold ${ui.textSecondary}`}>Text</label>
        <textarea value={body} onChange={e=>setBody(e.target.value)} rows={14} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm font-mono ${ui.textarea}`} placeholder="E-Mail Text" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ navigator.clipboard.writeText(`Betreff: ${subject}\n\n${body}`); }} disabled={!body} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40">In Zwischenablage</button>
        <button onClick={onClose} className={`px-3 py-2 rounded text-sm font-medium ${ui.buttonSecondary}`}>Fertig</button>
            </div>
      <div className={`text-[10px] ${ui.textMuted}`}>Senden erfolgt noch nicht automatisch – bitte Text kopieren und in Ihr Mailprogramm einfügen. (Server-SMTP Proxy erforderlich für Automatisierung)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailComposerModal;