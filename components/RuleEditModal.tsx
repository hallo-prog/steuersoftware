import React, { useState } from 'react';
import { Rule, InvoiceType } from '../types';
import { XIcon } from './icons/XIcon';

interface RuleEditModalProps {
    rule: Rule | null;
    onClose: () => void;
    onSave: (rule: Rule) => void;
}

const RuleEditModal: React.FC<RuleEditModalProps> = ({ rule, onClose, onSave }) => {
    const initialRuleState: Rule = rule || {
        id: '',
        conditionType: 'vendor',
        conditionValue: '',
        invoiceType: InvoiceType.INCOMING,
        resultCategory: ''
    };
    const [formData, setFormData] = useState<Rule>(initialRuleState);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.conditionValue && formData.resultCategory) {
            onSave(formData);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-slate-800">{rule ? 'Regel bearbeiten' : 'Neue Regel erstellen'}</h2>
                        <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><XIcon className="w-5 h-5 text-slate-500" /></button>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-slate-600">Legen Sie eine "Wenn-Dann"-Bedingung fest, um Belege automatisch zu kategorisieren.</p>
                        
                        <div>
                            <label htmlFor="conditionType" className="block text-sm font-medium text-slate-700 mb-1">Bedingung (WENN)</label>
                            <div className="flex space-x-2">
                                <select 
                                    name="conditionType" 
                                    id="conditionType" 
                                    value={formData.conditionType} 
                                    onChange={handleChange} 
                                    className="w-1/3 p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="vendor">Verkäufer</option>
                                    <option value="textContent">Textinhalt</option>
                                </select>
                                <input 
                                    type="text" 
                                    name="conditionValue" 
                                    value={formData.conditionValue}
                                    onChange={handleChange}
                                    placeholder="enthält Text..." 
                                    required
                                    className="w-2/3 p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-1 pl-1">Für mehrere Werte, mit Komma trennen (z.B. Benzin, Diesel).</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Aktion (DANN)</label>
                            <div className="flex space-x-2">
                                <select 
                                    name="invoiceType" 
                                    id="invoiceType" 
                                    value={formData.invoiceType}
                                    onChange={handleChange}
                                    className="w-1/3 p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value={InvoiceType.INCOMING}>Ausgabe</option>
                                    <option value={InvoiceType.OUTGOING}>Einnahme</option>
                                </select>
                                <input 
                                    type="text" 
                                    name="resultCategory"
                                    value={formData.resultCategory}
                                    onChange={handleChange}
                                    placeholder="Steuerkategorie zuweisen..." 
                                    required
                                    className="w-2/3 p-2 border border-slate-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500" 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 rounded-b-xl flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100">
                            Abbrechen
                        </button>
                        <button type="submit" className="py-2 px-4 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                            Regel speichern
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RuleEditModal;