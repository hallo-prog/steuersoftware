import React from 'react';
import CoverageEditor from './CoverageEditor';
import { InsurancePolicy, InsuranceType } from '../../types';

interface Props {
  ui: any;
  defaultTypes: InsuranceType[];
  editingPolicy: InsurancePolicy | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PolicyFormModal: React.FC<Props> = ({ ui, defaultTypes, editingPolicy, isSaving, onClose, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={onSubmit} className={`${ui.card} ${ui.border} max-w-2xl w-full rounded-xl p-6 space-y-4 overflow-y-auto max-h-[90vh]`}>
        <h3 className="text-lg font-bold">{editingPolicy ? 'Police bearbeiten' : 'Neue Police'}</h3>
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Name</label>
            <input name="name" defaultValue={editingPolicy?.name||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Typ</label>
            <select name="type" defaultValue={editingPolicy?.type||'Sonstige'} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}>{defaultTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Versicherer</label>
            <input name="insurer" defaultValue={editingPolicy?.insurer||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Policennummer</label>
            <input name="policyNumber" defaultValue={editingPolicy?.policyNumber||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Beginn</label>
            <input type="date" name="startDate" defaultValue={editingPolicy?.startDate?.split('T')[0]||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Ende</label>
            <input type="date" name="endDate" defaultValue={editingPolicy?.endDate?.split('T')[0]||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Zahlintervall</label>
            <select name="paymentInterval" defaultValue={editingPolicy?.paymentInterval||'monatlich'} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}>
              <option value="monatlich">monatlich</option><option value="quartal">quartal</option><option value="jährlich">jährlich</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Prämie (€)</label>
            <input name="premiumAmount" type="number" step="0.01" defaultValue={editingPolicy?.premiumAmount ?? ''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Coverage Zusammenfassung</label>
            <textarea name="coverageSummary" defaultValue={editingPolicy?.coverageSummary||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.textarea}`} rows={2} />
          </div>
          {editingPolicy && (
            <div className="md:col-span-2">
              <CoverageEditor policyId={editingPolicy.id} ui={ui} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Kontakt Telefon</label>
            <input name="contactPhone" defaultValue={editingPolicy?.contactPhone||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Kontakt E-Mail</label>
            <input name="contactEmail" type="email" defaultValue={editingPolicy?.contactEmail||''} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={`px-4 py-2 rounded-lg text-sm ${ui.buttonSecondary}`}>Abbrechen</button>
          <button type="submit" disabled={isSaving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-sm">{isSaving? 'Speichert...' : 'Speichern'}</button>
        </div>
      </form>
    </div>
  );
};

export default PolicyFormModal;
