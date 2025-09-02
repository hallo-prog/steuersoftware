// Dynamische Wrapper für KI-Funktionen aus geminiService, um Code-Splitting zu forcieren.
// Jede Funktion lädt das Modul nur beim ersten Aufruf (Browser Caching + ESM Module Cache).

let _modPromise: Promise<any> | null = null;
const load = () => _modPromise ?? (_modPromise = import('./geminiService'));

export const analyzeDocument = async (...args: any[]) => (await load()).analyzeDocument(...args);
export const getDocumentStatusFromAnalysis = async (...args: any[]) => (await load()).getDocumentStatusFromAnalysis(...args);
export const createSuggestedFileName = async (...args: any[]) => (await load()).createSuggestedFileName(...args);
export const embedTexts = async (...args: any[]) => (await load()).embedTexts(...args);
export const extractContactsFromText = async (...args: any[]) => (await load()).extractContactsFromText(...args);
export const suggestTaxCategoryAndFlags = async (...args: any[]) => (await load()).suggestTaxCategoryAndFlags(...args);
export const summarizeDocumentsFinancially = async (...args: any[]) => (await load()).summarizeDocumentsFinancially(...args);
export const semanticSearchDocuments = async (...args: any[]) => (await load()).semanticSearchDocuments(...args);
export const getChatResponse = async (...args: any[]) => (await load()).getChatResponse(...args);
export const extractInsurancePolicyFromFiles = async (...args: any[]) => (await load()).extractInsurancePolicyFromFiles(...args);
export const summarizeInsuranceClaim = async (...args: any[]) => (await load()).summarizeInsuranceClaim(...args);
export const assessPolicyRisk = async (...args: any[]) => (await load()).assessPolicyRisk(...args);
export const analyzeLiability = async (...args: any[]) => (await load()).analyzeLiability(...args);
export const findFundingOpportunities = async (...args: any[]) => (await load()).findFundingOpportunities(...args);
export const createEmailFromTemplate = async (...args: any[]) => (await load()).createEmailFromTemplate(...args);
