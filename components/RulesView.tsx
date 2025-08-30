import React, { useState, useCallback } from 'react';
import { Rule } from '../types';
import RulesIcon from './icons/RulesIcon';
import RuleEditModal from './RuleEditModal';
import { PlusIcon } from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';

interface RulesViewProps {
    rules: Rule[];
    setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
}

const RuleItem: React.FC<{ rule: Rule; onEdit: (rule: Rule) => void; onDelete: (id: string) => void; }> = ({ rule, onEdit, onDelete }) => {
    const hasMultipleValues = rule.conditionValue.includes(',');
    const conditionText = rule.conditionType === 'vendor' ? 'Verkäufer' : 'Textinhalt';
    const verbText = hasMultipleValues ? 'einen der Werte' : 'den Wert';
    
    return (
        <div className="flex items-center p-4 bg-white rounded-lg border border-slate-200 hover:shadow-sm transition-shadow">
            <div className="flex-grow">
                <p className="font-medium text-slate-700 text-sm">
                    <span className="font-semibold text-blue-600">WENN</span> der <span className="font-bold">{conditionText}</span> {verbText} <span className="font-bold text-slate-800">"{rule.conditionValue}"</span> enthält
                </p>
                <p className="text-sm text-slate-500 mt-1">
                    <span className="font-semibold text-blue-600">DANN</span> Typ: <span className="font-bold">{rule.invoiceType}</span> & Kategorie: <span className="font-bold">{rule.resultCategory}</span>
                </p>
            </div>
            <div className="flex space-x-1 ml-4">
                <button onClick={() => onEdit(rule)} className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg" title="Regel bearbeiten">
                    <PencilIcon className="w-5 h-5" />
                </button>
                <button onClick={() => onDelete(rule.id)} className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-100 rounded-lg" title="Regel löschen">
                    <TrashIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}

const RulesView: React.FC<RulesViewProps> = ({ rules, setRules }) => {
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

  const handleSaveRule = (ruleToSave: Rule) => {
    if (ruleToSave.id) { // Editing existing rule
        setRules(prev => prev.map(r => r.id === ruleToSave.id ? ruleToSave : r));
    } else { // Adding new rule
        setRules(prev => [...prev, { ...ruleToSave, id: `rule-${Date.now()}` }]);
    }
    handleCloseModal();
  };
  
  const handleDeleteRule = useCallback((id: string) => {
    if (window.confirm("Möchten Sie diese Regel wirklich löschen?")) {
        setRules(prevRules => prevRules.filter(r => r.id !== id));
    }
  }, [setRules]);

  return (
    <div className="space-y-8">
        <div>
            <h2 className="text-3xl font-bold text-slate-800">Regelwerk des KI-Agenten</h2>
            <p className="text-slate-500 mt-1">Verwalten Sie hier die Regeln, die der KI-Agent zur automatischen Kategorisierung Ihrer Belege verwendet. Die Regeln werden von oben nach unten angewendet.</p>
        </div>
        
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">Aktive Regeln</h3>
                <button onClick={() => handleOpenModal()} className="flex items-center bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition duration-300 shadow-sm text-sm">
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
                    <p className="text-sm text-slate-500 text-center py-8">Sie haben noch keine Regeln erstellt.</p>
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