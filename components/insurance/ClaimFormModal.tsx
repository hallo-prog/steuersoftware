import React from 'react';

interface Props {
  ui: any;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

const ClaimFormModal: React.FC<Props> = ({ ui, onClose, onSubmit }) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <form onSubmit={onSubmit} className={`${ui.card} ${ui.border} max-w-lg w-full rounded-xl p-6 space-y-4`}>
        <h3 className="text-lg font-bold">Neuer Fall</h3>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Typ</label>
          <select name="type" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`}>
            <option value="Schadensfall">Schadensfall</option>
            <option value="Rechtsschutzfall">Rechtsschutzfall</option>
            <option value="Zahlungsfall">Zahlungsfall</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Titel</label>
          <input name="title" className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.input}`} required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Beschreibung</label>
          <textarea name="description" rows={4} className={`mt-1 w-full px-3 py-2 rounded-lg text-sm ${ui.textarea}`} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={`px-4 py-2 rounded-lg text-sm ${ui.buttonSecondary}`}>Abbrechen</button>
          <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm">Erstellen</button>
        </div>
      </form>
    </div>
  );
};

export default ClaimFormModal;
