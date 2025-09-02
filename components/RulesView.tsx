import React, { useState, useCallback } from 'react';
import { Rule } from '../types';
import RulesIcon from './icons/RulesIcon';
import RuleEditModal from './RuleEditModal';
import { PlusIcon } from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import { useThemeClasses } from '../hooks/useThemeClasses';

interface RulesViewProps {
    userId: string;
    rules: Rule[];
    setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
}

const RuleItem: React.FC<{ rule: Rule; onEdit: (rule: Rule) => void; onDelete: (id: string) => void; }> = ({ rule, onEdit, onDelete }) => {
    const ui = useThemeClasses();
    const hasMultipleValues = rule.conditionValue.includes(',');
    const conditionText = rule.conditionType === 'vendor' ? 'Verkäufer' : 'Textinhalt';
    const verbText = hasMultipleValues ? 'einen der Werte' : 'den Wert';
    
    return (
        <div className={`flex items-center p-4 rounded-lg transition-shadow ${ui.card} ${ui.border} hover:shadow-sm`}>
            <div className="flex-grow">
                <p className={`font-medium text-sm ${ui.textSecondary}`}>
                    <span className="font-semibold text-blue-600">WENN</span> der <span className="font-bold">{conditionText}</span> {verbText} <span className={`font-bold ${ui.textPrimary}`}>"{rule.conditionValue}"</span> enthält
                </p>
                <p className={`text-sm mt-1 ${ui.textMuted}`}>
                    <span className="font-semibold text-blue-600">DANN</span> Typ: <span className="font-bold">{rule.invoiceType}</span> & Kategorie: <span className="font-bold">{rule.resultCategory}</span>
                </p>
            </div>
            <div className="flex space-x-1 ml-4">
                <button onClick={() => onEdit(rule)} className={`p-2 rounded-lg ${ui.buttonGhost} hover:text-blue-600`} title="Regel bearbeiten">
                    <PencilIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onDelete(rule.id)} className={`p-2 rounded-lg ${ui.buttonGhost} hover:text-red-600`} title="Regel löschen">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

import { insertRule, updateRule, deleteRule } from '../services/supabaseDataService';

const RulesView: React.FC<RulesViewProps> = ({ userId, rules, setRules }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);

  const handleOpenModal = (rule: Rule | null = null) => {
    setEditingRule(rule);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingRule(null);
    setIsModalOpen(false);
  };

    const handleSaveRule = async (ruleToSave: Rule) => {
        try {
            if (ruleToSave.id && !ruleToSave.id.startsWith('sys-')) {
                // Update existing DB rule
                const updated = await updateRule(ruleToSave.id, {
                    conditionType: ruleToSave.conditionType,
                    conditionValue: ruleToSave.conditionValue,
                    invoiceType: ruleToSave.invoiceType,
                    resultCategory: ruleToSave.resultCategory,
                });
                setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
            } else {
                // Insert new rule (also when editing a system rule -> becomes user rule)
                const inserted = await insertRule(userId, {
                    conditionType: ruleToSave.conditionType,
                    conditionValue: ruleToSave.conditionValue,
                    invoiceType: ruleToSave.invoiceType,
                    resultCategory: ruleToSave.resultCategory,
                });
                setRules(prev => [...prev, inserted]);
            }
        } catch (e) { console.warn('Rule save failed', e); }
        handleCloseModal();
    };
  
    const handleDeleteRule = useCallback(async (id: string) => {
        if (id.startsWith('sys-')) { alert('Systemregeln können nicht gelöscht werden.'); return; }
        if (window.confirm("Möchten Sie diese Regel wirklich löschen?")) {
            try { await deleteRule(id); } catch (e) { console.warn('Delete rule failed', e); }
            setRules(prevRules => prevRules.filter(r => r.id !== id));
        }
    }, [setRules]);

    const ui = useThemeClasses();
    return (
        <div className="space-y-8">
        <div>
                        <h2 className={`text-3xl font-bold ${ui.textPrimary}`}>Regelwerk des KI-Agenten</h2>
                        <p className={`${ui.textMuted} mt-1`}>Verwalten Sie hier die Regeln, die der KI-Agent zur automatischen Kategorisierung Ihrer Belege verwendet. Die Regeln werden von oben nach unten angewendet.</p>
        </div>
        
                <div className={`p-4 sm:p-6 rounded-xl shadow-sm ${ui.card} ${ui.border}`}>
            <div className="flex justify-between items-center mb-4">
                                <h3 className={`text-lg font-semibold ${ui.textPrimary}`}>Aktive Regeln</h3>
                                <button onClick={() => handleOpenModal()} className={`flex items-center font-semibold py-2 px-4 rounded-lg transition duration-300 shadow-sm text-sm ${ui.buttonPrimary}`}>
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Neue Regel
                </button>
            </div>
            <div className="space-y-3">
                {rules.length > 0 ? (
                    rules.map(rule => (
                        <RuleItem key={rule.id} rule={rule} onEdit={handleOpenModal} onDelete={handleDeleteRule} />
                    ))
                ) : (
                                        <p className={`text-sm text-center py-8 ${ui.textMuted}`}>Sie haben noch keine Regeln erstellt.</p>
                )}
            </div>
        </div>

        {isModalOpen && (
            <RuleEditModal
                rule={editingRule}
                onClose={handleCloseModal}
                onSave={handleSaveRule}
            />
        )}
    </div>
  );
};

export default RulesView;