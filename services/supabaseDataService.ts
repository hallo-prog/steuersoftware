import { supabase } from '../src/supabaseClient';
import { Document, InvoiceType, Rule, InsurancePolicy, InsuranceClaim, UserProfile, InsuranceDocument, Liability, LiabilityDocument, Contact, Task, AuditEvent, Deadline } from '../types';
// Lazy KI Funktionen nur bei Bedarf laden (verhindert großes Initialbundle)
const lazyEmbed = async (...args:any[]) => (await import('./geminiLazy')).embedTexts(...args);

// Helper: map DB row -> Document
const mapDocument = (row: any): Document => ({
  id: row.id,
  name: row.name,
  date: new Date(row.date),
  year: row.year,
  quarter: row.quarter,
  source: row.source,
  status: row.status,
  fileUrl: row.file_url,
  storageProvider: row.storage_provider || (row.file_url ? 'supabase' : undefined),
  textContent: row.text_content || undefined,
  vendor: row.vendor || undefined,
  totalAmount: row.total_amount != null ? Number(row.total_amount) : undefined,
  vatAmount: row.vat_amount != null ? Number(row.vat_amount) : undefined,
  invoiceNumber: row.invoice_number || undefined,
  invoiceType: row.invoice_type as InvoiceType,
  taxCategory: row.tax_category || undefined,
  aiSuggestedTaxCategory: row.ai_suggested_tax_category || undefined,
  flags: row.flags || undefined,
  anomalyScore: row.anomaly_score || undefined,
  insurancePolicyId: row.insurance_policy_id || undefined,
  liabilityId: row.liability_id || undefined,
  lexoffice: row.lexoffice_status ? { status: row.lexoffice_status, sentAt: row.lexoffice_sent_at ? new Date(row.lexoffice_sent_at) : new Date() } : undefined,
  errorMessage: row.error_message || undefined,
});

export const fetchDocuments = async (userId: string): Promise<Document[]> => {
  const { data, error } = await supabase.from('documents').select('*').eq('user_id', userId).order('date',{ascending:false});
  if (error) throw error; return (data||[]).map(mapDocument);
};

export const insertDocument = async (userId: string, doc: Partial<Document>) => {
  const { data, error } = await supabase.from('documents').insert({
    user_id: userId,
    name: doc.name,
    date: (doc.date||new Date()).toISOString(),
    year: doc.year,
    quarter: doc.quarter,
    source: doc.source,
    status: doc.status,
  storage_provider: (doc as any).storageProvider,
    file_url: doc.fileUrl,
    text_content: doc.textContent,
    vendor: doc.vendor,
    total_amount: doc.totalAmount,
    vat_amount: doc.vatAmount,
    invoice_number: doc.invoiceNumber,
    invoice_type: doc.invoiceType,
    tax_category: doc.taxCategory,
    ai_suggested_tax_category: doc.aiSuggestedTaxCategory,
    flags: doc.flags,
    anomaly_score: doc.anomalyScore,
    insurance_policy_id: doc.insurancePolicyId,
  liability_id: (doc as any).liabilityId,
    lexoffice_status: doc.lexoffice?.status,
    lexoffice_sent_at: doc.lexoffice?.sentAt?.toISOString(),
    error_message: doc.errorMessage,
  }).select().single();
  if (error) throw error; return mapDocument(data);
};

export const updateDocument = async (id: string, patch: Partial<Document>) => {
  const upd: any = {
    name: patch.name,
    tax_category: patch.taxCategory,
    ai_suggested_tax_category: patch.aiSuggestedTaxCategory,
    flags: patch.flags,
    anomaly_score: patch.anomalyScore,
    insurance_policy_id: patch.insurancePolicyId,
    liability_id: (patch as any).liabilityId,
    status: patch.status,
    text_content: patch.textContent,
    vendor: patch.vendor,
    total_amount: patch.totalAmount,
    vat_amount: patch.vatAmount,
    invoice_number: patch.invoiceNumber,
    invoice_type: patch.invoiceType,
  storage_provider: (patch as any).storageProvider,
  };
  if (patch.date) {
    upd.date = patch.date.toISOString();
    upd.year = patch.date.getFullYear();
    upd.quarter = Math.floor((patch.date.getMonth()+3)/3);
  }
  const { data, error } = await supabase.from('documents').update(upd).eq('id', id).select().single();
  if (error) throw error; return mapDocument(data);
};

// Aktualisiert Text + berechnet automatisch neues Embedding, falls möglich
export const updateDocumentReembed = async (apiKey: string, id: string, patch: Partial<Document>) => {
  if (!patch.textContent) return updateDocument(id, patch);
  try { const [vec] = await lazyEmbed(apiKey, [patch.textContent.slice(0,4000)]); return updateDocument(id, { ...patch, /* embedding: vec */ } as any); } catch { return updateDocument(id, patch); }
};

export const deleteDocument = async (id: string) => {
  const { error } = await supabase.from('documents').delete().eq('id', id);
  if (error) throw error;
};

// Rules ---------------------------------------------------------------------
export const fetchRules = async (userId: string): Promise<Rule[]> => {
  const { data, error } = await supabase.from('rules').select('*').eq('user_id', userId).order('created_at',{ascending:true});
  if (error) throw error; return (data||[]).map(r => ({
    id: r.id,
    conditionType: r.condition_type,
    conditionValue: r.condition_value,
    invoiceType: r.invoice_type as InvoiceType,
    resultCategory: r.result_category,
  }));
};

export const insertRule = async (userId: string, rule: Omit<Rule,'id'>): Promise<Rule> => {
  const { data, error } = await supabase.from('rules').insert({ user_id: userId, condition_type: rule.conditionType, condition_value: rule.conditionValue, invoice_type: rule.invoiceType, result_category: rule.resultCategory }).select().single();
  if (error) throw error; return { id: data.id, ...rule };
};

export const deleteRule = async (id: string) => { await supabase.from('rules').delete().eq('id', id); };

export const updateRule = async (id:string, rule: Omit<Rule,'id'>): Promise<Rule> => {
  const { data, error } = await supabase.from('rules').update({ condition_type: rule.conditionType, condition_value: rule.conditionValue, invoice_type: rule.invoiceType, result_category: rule.resultCategory }).eq('id', id).select().single();
  if (error) throw error; return { id: data.id, ...rule };
};

// Insurance Policies / Claims ----------------------------------------------
const mapPolicy = (row:any): InsurancePolicy => ({
  id: row.id,
  name: row.name,
  type: row.type,
  insurer: row.insurer||undefined,
  policyNumber: row.policy_number||undefined,
  startDate: row.start_date||undefined,
  endDate: row.end_date||undefined,
  paymentInterval: row.payment_interval||undefined,
  premiumAmount: row.premium_amount!=null?Number(row.premium_amount):undefined,
  coverageSummary: row.coverage_summary||undefined,
  coverageItems: row.coverage_items||[],
  exclusions: row.exclusions||[],
  contactPhone: row.contact_phone||undefined,
  contactEmail: row.contact_email||undefined,
  documents: [],
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const fetchPolicies = async (userId: string): Promise<InsurancePolicy[]> => {
  const { data, error } = await supabase.from('insurance_policies').select('*').eq('user_id', userId).order('created_at',{ascending:false});
  if (error) throw error; return (data||[]).map(mapPolicy);
};

export const upsertPolicy = async (userId: string, policy: Partial<InsurancePolicy>): Promise<InsurancePolicy> => {
  const insertObj:any = {
    user_id: userId,
    name: policy.name,
    type: policy.type,
    insurer: policy.insurer,
    policy_number: policy.policyNumber,
    start_date: policy.startDate,
    end_date: policy.endDate,
    payment_interval: policy.paymentInterval,
    premium_amount: policy.premiumAmount,
    coverage_summary: policy.coverageSummary,
    coverage_items: policy.coverageItems,
    exclusions: policy.exclusions,
    contact_phone: policy.contactPhone,
    contact_email: policy.contactEmail,
  risk_score: (policy as any).riskScore,
  risk_gaps: (policy as any).riskGaps,
  risk_recommendation: (policy as any).riskRecommendation,
  };
  let query = supabase.from('insurance_policies');
  if (policy.id) {
    const { data, error } = await query.update(insertObj).eq('id', policy.id).select().single();
    if (error) throw error; return mapPolicy(data);
  } else {
    const { data, error } = await query.insert(insertObj).select().single();
    if (error) throw error; return mapPolicy(data);
  }
};

export const deletePolicyDB = async (id:string) => { await supabase.from('insurance_policies').delete().eq('id', id); };

const mapClaim = (row:any): InsuranceClaim => ({
  id: row.id,
  policyId: row.policy_id,
  type: row.type,
  title: row.title,
  description: row.description||undefined,
  createdAt: row.created_at,
  documents: [],
  aiSummary: row.ai_summary||undefined,
  aiRecommendation: row.ai_recommendation||undefined,
  status: row.status||undefined,
});

export const fetchClaims = async (userId:string): Promise<InsuranceClaim[]> => {
  const { data, error } = await supabase.from('insurance_claims').select('*').eq('user_id', userId).order('created_at',{ascending:false});
  if (error) throw error; return (data||[]).map(mapClaim);
};

export const upsertClaim = async (userId:string, claim: Partial<InsuranceClaim>): Promise<InsuranceClaim> => {
  const base:any = { user_id: userId, policy_id: claim.policyId, type: claim.type, title: claim.title, description: claim.description, ai_summary: claim.aiSummary, ai_recommendation: claim.aiRecommendation, status: claim.status };
  if (claim.id) {
    const { data, error } = await supabase.from('insurance_claims').update(base).eq('id', claim.id).select().single();
    if (error) throw error; return mapClaim(data);
  } else {
    const { data, error } = await supabase.from('insurance_claims').insert(base).select().single();
    if (error) throw error; return mapClaim(data);
  }
};

export const deleteClaimDB = async (id:string) => { await supabase.from('insurance_claims').delete().eq('id', id); };

// Profile -------------------------------------------------------------------
export const fetchOrCreateProfile = async (userId: string, email?:string): Promise<UserProfile> => {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') throw error; // not found code
  if (!data) {
    const insert = { id: userId, name: email||'Benutzer' };
    const { data:created, error:err2 } = await supabase.from('profiles').insert(insert).select().single();
    if (err2) throw err2;
    return { name: created.name, taxId:'', vatId:'', taxNumber:'', companyForm:'', profilePicture: undefined };
  }
  return {
  name: data.name||'', taxId: data.tax_id||'', vatId: data.vat_id||'', taxNumber: data.tax_number||'', companyForm: data.company_form||'', profilePicture: undefined, employees: data.employees||undefined, locationState: data.location_state||undefined, industry: data.industry||undefined, foundingYear: data.founding_year||undefined
  };
};

export const updateProfile = async (userId:string, patch: Partial<UserProfile>) => {
  const { error } = await supabase.from('profiles').update({
    name: patch.name,
    tax_id: patch.taxId,
    vat_id: patch.vatId,
    tax_number: patch.taxNumber,
    company_form: patch.companyForm,
    employees: patch.employees,
  location_state: (patch as any).locationState,
    industry: patch.industry,
    founding_year: patch.foundingYear,
  }).eq('id', userId);
  if (error) throw error;
};

// Storage Upload ------------------------------------------------------------
export interface UploadOptions { signal?: AbortSignal; maxRetries?: number; retryDelayMs?: number; }
const isTransientStorageError = (code?: string|number, status?: number, message?: string) => {
  if (!status && typeof code === 'string') {
    if (/425|500|502|503|504/.test(code)) return true;
  }
  return status ? [425,500,502,503,504].includes(status) : false || (message? /(timeout|network)/i.test(message): false);
};

export const uploadFileToBucket = async (bucket: string, path: string, file: File, opts: UploadOptions = {}): Promise<string> => {
  if (!supabase) throw new Error('Supabase nicht konfiguriert – Upload nicht möglich');
  const { signal, maxRetries = 3, retryDelayMs = 400 } = opts;
  let attempt = 0;
  let lastErr: any;
  while (attempt < maxRetries) {
    if (signal?.aborted) throw new DOMException('Aborted','AbortError');
    try {
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (e:any) {
      lastErr = e;
      const status = e?.status || e?.__isAuthError ? undefined : e?.status;
      if (!isTransientStorageError(e?.code, status, e?.message) || attempt === maxRetries - 1) {
        throw e;
      }
      // Exponentielles Backoff mit Jitter
      const base = retryDelayMs * Math.pow(2, attempt);
      const sleep = base + Math.random()*150;
      await new Promise((r,rej)=> {
        const to = setTimeout(()=> r(null), sleep);
        if (signal) {
          signal.addEventListener('abort', ()=> { clearTimeout(to); rej(new DOMException('Aborted','AbortError')); }, { once:true });
        }
      });
      attempt++; continue;
    }
  }
  throw lastErr || new Error('Upload fehlgeschlagen');
};

export const deleteFileFromPublicUrl = async (publicUrl?: string) => {
  if (!publicUrl) return;
  // Erwartetes Format: https://<proj>.supabase.co/storage/v1/object/public/<bucket>/<path>
  try {
    const marker = '/object/public/';
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;
    const rest = publicUrl.substring(idx + marker.length); // bucket/path
    const firstSlash = rest.indexOf('/');
    if (firstSlash === -1) return;
    const bucket = rest.substring(0, firstSlash);
    const path = rest.substring(firstSlash + 1);
    await supabase.storage.from(bucket).remove([path]);
  } catch (e) {
    console.warn('Storage cleanup failed', e);
  }
};

// Insurance Policy / Claim Documents ---------------------------------------
const mapPolicyDoc = (row:any): InsuranceDocument => ({
  id: row.id,
  fileName: row.file_name,
  uploadedAt: row.uploaded_at,
  textContent: row.text_content || undefined,
  storagePath: row.storage_path || undefined,
  // publicUrl wird dynamisch aus Bucket + storagePath abgeleitet falls vorhanden
});

export const fetchPolicyDocuments = async (policyId: string): Promise<InsuranceDocument[]> => {
  const { data, error } = await supabase.from('insurance_policy_documents').select('*').eq('policy_id', policyId).order('uploaded_at',{ascending:false});
  if (error) throw error;
  const list = (data||[]).map(mapPolicyDoc);
  // Rekonstruiere public Url wenn storagePath vorhanden & Bucket bekannt
  return list.map(d => {
    if (!d.publicUrl && d.storagePath) {
      try {
        const { data:pub } = supabase.storage.from('insurance').getPublicUrl(d.storagePath);
        if (pub?.publicUrl) d.publicUrl = pub.publicUrl;
      } catch {}
    }
    return d;
  });
};

export const insertPolicyDocument = async (policyId: string, fileName: string, textContent?: string, storagePath?: string): Promise<InsuranceDocument> => {
  const { data, error } = await supabase.from('insurance_policy_documents').insert({ policy_id: policyId, file_name: fileName, text_content: textContent, storage_path: storagePath }).select().single();
  if (error) throw error; return mapPolicyDoc(data);
};

export const deletePolicyDocument = async (id: string) => { await supabase.from('insurance_policy_documents').delete().eq('id', id); };

export const uploadPolicyDocument = async (userId:string, policyId: string, file: File, textContent?: string, opts?: UploadOptions): Promise<InsuranceDocument & { publicUrl: string }> => {
  const path = `${userId}/policies/${policyId}/${Date.now()}-${encodeURIComponent(file.name)}`;
  const publicUrl = await uploadFileToBucket('insurance', path, file, opts);
  const doc = await insertPolicyDocument(policyId, file.name, textContent, path);
  return { ...doc, publicUrl };
};

// ---------------------- Liabilities ---------------------------------------
const mapLiability = (row:any): Liability => ({
  id: row.id,
  name: row.name,
  creditor: row.creditor||undefined,
  contractNumber: row.contract_number||undefined,
  startDate: row.start_date||undefined,
  endDate: row.end_date||undefined,
  paymentInterval: row.payment_interval||undefined,
  outstandingAmount: row.outstanding_amount!=null? Number(row.outstanding_amount):undefined,
  originalAmount: row.original_amount!=null? Number(row.original_amount):undefined,
  interestRatePercent: row.interest_rate_percent!=null? Number(row.interest_rate_percent):undefined,
  category: row.category||undefined,
  notes: row.notes||undefined,
  tags: row.tags||[],
  contactEmail: row.contact_email||undefined,
  contactPhone: row.contact_phone||undefined,
  aiRiskScore: row.ai_risk_score||undefined,
  aiRecommendation: row.ai_recommendation||undefined,
  aiSummary: row.ai_summary||undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchLiabilities = async (userId:string): Promise<Liability[]> => {
  const { data, error } = await supabase.from('liabilities').select('*').eq('user_id', userId).order('created_at',{ascending:false});
  if (error) throw error; return (data||[]).map(mapLiability);
};

export const upsertLiability = async (userId:string, liab: Partial<Liability>): Promise<Liability> => {
  const base:any = {
    user_id: userId,
    name: liab.name,
    creditor: liab.creditor,
    contract_number: liab.contractNumber,
    start_date: liab.startDate,
    end_date: liab.endDate,
    payment_interval: liab.paymentInterval,
    outstanding_amount: liab.outstandingAmount,
    original_amount: liab.originalAmount,
    interest_rate_percent: liab.interestRatePercent,
    category: liab.category,
    notes: liab.notes,
    tags: liab.tags,
    contact_email: liab.contactEmail,
    contact_phone: liab.contactPhone,
    ai_risk_score: liab.aiRiskScore,
    ai_recommendation: liab.aiRecommendation,
    ai_summary: liab.aiSummary,
  };
  if (liab.id) {
    const { data, error } = await supabase.from('liabilities').update(base).eq('id', liab.id).select().single();
    if (error) throw error; return mapLiability(data);
  } else {
    const { data, error } = await supabase.from('liabilities').insert(base).select().single();
    if (error) throw error; return mapLiability(data);
  }
};

export const deleteLiability = async (id:string) => { await supabase.from('liabilities').delete().eq('id', id); };

const mapLiabilityDoc = (row:any): LiabilityDocument => ({ id: row.id, liabilityId: row.liability_id, fileName: row.file_name, uploadedAt: row.uploaded_at, textContent: row.text_content });

export const fetchLiabilityDocuments = async (liabilityId:string): Promise<LiabilityDocument[]> => {
  const { data, error } = await supabase.from('liability_documents').select('*').eq('liability_id', liabilityId).order('uploaded_at',{ascending:false});
  if (error) throw error; return (data||[]).map(mapLiabilityDoc);
};

export const insertLiabilityDocument = async (liabilityId:string, fileName:string, textContent?:string): Promise<LiabilityDocument> => {
  const { data, error } = await supabase.from('liability_documents').insert({ liability_id: liabilityId, file_name: fileName, text_content: textContent }).select().single();
  if (error) throw error; return mapLiabilityDoc(data);
};

export const uploadLiabilityDocument = async (userId:string, liabilityId:string, file:File, textContent?:string, opts?: UploadOptions): Promise<LiabilityDocument & { publicUrl:string }> => {
  const path = `${userId}/liabilities/${liabilityId}/${Date.now()}-${encodeURIComponent(file.name)}`;
  const publicUrl = await uploadFileToBucket('liabilities', path, file, opts);
  const doc = await insertLiabilityDocument(liabilityId, file.name, textContent);
  return { ...doc, publicUrl };
};

export const deleteLiabilityDocument = async (id:string) => { await supabase.from('liability_documents').delete().eq('id', id); };

// ---------------------- Contacts -----------------------------------------
const mapContact = (row:any): Contact => ({ id: row.id, name: row.name, type: row.type, email: row.email||undefined, phone: row.phone||undefined, sourceIds: row.source_ids||[], tags: row.tags||[], lastDocumentDate: row.last_document_date||undefined, notes: row.notes||undefined, aiSummary: row.ai_summary||undefined });

export const fetchContacts = async (userId:string): Promise<Contact[]> => {
  const { data, error } = await supabase.from('contacts').select('*').eq('user_id', userId).order('name');
  if (error) throw error; return (data||[]).map(mapContact);
};

export const upsertContact = async (userId:string, c: Partial<Contact>): Promise<Contact> => {
  const base:any = { user_id: userId, name: c.name, type: c.type, email: c.email, phone: c.phone, source_ids: c.sourceIds, tags: c.tags, last_document_date: c.lastDocumentDate, notes: c.notes, ai_summary: c.aiSummary };
  if (c.id) { const { data, error } = await supabase.from('contacts').update(base).eq('id', c.id).select().single(); if (error) throw error; return mapContact(data); }
  const { data, error } = await supabase.from('contacts').insert(base).select().single(); if (error) throw error; return mapContact(data);
};

export const deleteContact = async (id:string) => { await supabase.from('contacts').delete().eq('id', id); };

// ---------------------- Tasks ---------------------------------------------
const mapTask = (row:any): Task => ({
  id: row.id,
  userId: row.user_id,
  documentId: row.document_id || undefined,
  title: row.title,
  description: row.description || undefined,
  priority: row.priority,
  status: row.status,
  source: row.source,
  dueDate: row.due_date || undefined,
  autoAction: row.auto_action || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const fetchTasks = async (userId: string): Promise<Task[]> => {
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { ascending: true }).order('created_at',{ascending:false});
  if (error) throw error; return (data||[]).map(mapTask);
};

export const insertTask = async (userId: string, task: Partial<Task>): Promise<Task> => {
  const { data, error } = await supabase.from('tasks').insert({
    user_id: userId,
    document_id: task.documentId,
    title: task.title,
    description: task.description,
    priority: task.priority || 'normal',
    status: task.status || 'open',
    source: task.source || 'ai',
    due_date: task.dueDate,
    auto_action: task.autoAction as any,
  }).select().single();
  if (error) throw error; return mapTask(data);
};

export const updateTask = async (id:string, patch: Partial<Task>): Promise<Task> => {
  const upd:any = {
    title: patch.title,
    description: patch.description,
    priority: patch.priority,
    status: patch.status,
    due_date: patch.dueDate,
    auto_action: patch.autoAction as any,
  };
  const { data, error } = await supabase.from('tasks').update(upd).eq('id', id).select().single();
  if (error) throw error; return mapTask(data);
};

export const deleteTask = async (id:string) => { const { error } = await supabase.from('tasks').delete().eq('id', id); if (error) throw error; };

// ---------------------- Audit Events --------------------------------------
const mapAudit = (row:any): AuditEvent => ({ id: row.id, userId: row.user_id, correlationId: row.correlation_id||undefined, actorType: row.actor_type, eventType: row.event_type, payloadJson: row.payload_json||undefined, createdAt: row.created_at });

export const insertAuditEvent = async (userId:string, event: Omit<AuditEvent,'id'|'userId'|'createdAt'>): Promise<AuditEvent> => {
  const { data, error } = await supabase.from('audit_events').insert({ user_id: userId, correlation_id: event.correlationId, actor_type: event.actorType, event_type: event.eventType, payload_json: event.payloadJson }).select().single();
  if (error) throw error; return mapAudit(data);
};

export const fetchAuditEvents = async (userId:string, limit=100): Promise<AuditEvent[]> => {
  const { data, error } = await supabase.from('audit_events').select('*').eq('user_id', userId).order('created_at',{ascending:false}).limit(limit);
  if (error) throw error; return (data||[]).map(mapAudit);
};

// ---------------------- Deadlines (DB) ------------------------------------
const mapDeadlineDB = (row:any): Deadline => ({ id: row.id, title: row.title, dueDate: new Date(row.due_date), remainingDays: Math.round((new Date(row.due_date).getTime() - Date.now())/(1000*60*60*24)) });

export const fetchDeadlinesDB = async (userId:string): Promise<Deadline[]> => {
  const { data, error } = await supabase.from('deadlines').select('*').eq('user_id', userId).order('due_date',{ascending:true});
  if (error) throw error; return (data||[]).map(mapDeadlineDB);
};

export const insertDeadlineDB = async (userId:string, title:string, dueDate:string): Promise<Deadline> => {
  const { data, error } = await supabase.from('deadlines').insert({ user_id: userId, title, due_date: dueDate }).select().single();
  if (error) throw error; return mapDeadlineDB(data);
};

export const fetchOpenTasksCount = async (userId:string): Promise<number> => {
  const { count, error } = await supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status','open');
  if (error) throw error; return count||0;
};

// ---------------------- Chat History -------------------------------------
export interface ChatThreadRow { id: string; user_id: string; title: string; created_at: string; updated_at: string; summary?: string|null }
export interface ChatMessageRow { id: string; thread_id: string; role: 'user'|'model'; content: string; raw_content?: string|null; created_at: string; }

export const fetchChatThreads = async (userId: string): Promise<ChatThreadRow[]> => {
  const { data, error } = await supabase.from('chat_threads').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
  if (error) throw error; return data as ChatThreadRow[];
};

export const createChatThread = async (userId: string, title: string): Promise<ChatThreadRow> => {
  const { data, error } = await supabase.from('chat_threads').insert({ user_id: userId, title }).select().single();
  if (error) throw error; return data as ChatThreadRow;
};

export const renameChatThread = async (threadId: string, title: string): Promise<void> => {
  const { error } = await supabase.from('chat_threads').update({ title }).eq('id', threadId);
  if (error) throw error;
};

export const deleteChatThread = async (threadId: string): Promise<void> => {
  const { error } = await supabase.from('chat_threads').delete().eq('id', threadId);
  if (error) throw error;
};

export const fetchChatMessages = async (threadId: string): Promise<ChatMessageRow[]> => {
  const { data, error } = await supabase.from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error; return data as ChatMessageRow[];
};

export const appendChatMessage = async (threadId: string, role: 'user'|'model', content: string, raw_content?: string): Promise<ChatMessageRow> => {
  const { data, error } = await supabase.from('chat_messages').insert({ thread_id: threadId, role, content, raw_content }).select().single();
  if (error) throw error; return data as ChatMessageRow;
};

export const updateChatThreadSummary = async (threadId: string, summary: string): Promise<void> => {
  const { error } = await supabase.from('chat_threads').update({ summary }).eq('id', threadId);
  if (error) throw error;
};

// Hilfsfunktion: Holt letzte N Nachrichten + Summary (für Kontextfenster)
export const getCondensedChatContext = async (threadId: string, maxMessages: number): Promise<{ summary?: string; messages: ChatMessageRow[] }> => {
  const { data, error } = await supabase.from('chat_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
  if (error) throw error;
  if (!data || data.length <= maxMessages) return { messages: data as ChatMessageRow[] };
  const slice = data.slice(-maxMessages) as ChatMessageRow[];
  // Summary liegt in thread row (holen)
  const { data: thread } = await supabase.from('chat_threads').select('summary').eq('id', threadId).single();
  return { summary: thread?.summary || undefined, messages: slice };
};

// Rolling Summarization: erstellt bzw. erweitert summary wenn Nachrichten > threshold
export const maybeSummarizeThread = async (
  apiKey: string,
  threadId: string,
  allMessages: ChatMessageRow[],
  threshold = 30,
  summaryMaxChars = 900
): Promise<void> => {
  if (allMessages.length < threshold) return;
  try {
    const preservedTail = 10;
    const toSummarizeMessages = allMessages.slice(0, -preservedTail);
    if (!toSummarizeMessages.length) return;
    const toSummarize = toSummarizeMessages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.replace(/\n+/g,' ').trim()}`)
      .join('\n');
    let summary = '';
    if (!apiKey) {
      summary = toSummarize.slice(0, summaryMaxChars);
    } else {
      const prompt = `Du bist ein Assistent, der lange Chatverläufe für einen Steuer-/Finanz-Assistant verdichtet. Ziel: Kontext erhalten, Redundanz entfernen, Zahlen beibehalten.\n\nFORMAT:\nThemen:\n- <max 4 Kernthemen>\nOffene Fragen:\n- <falls vorhanden>\nSchlüsselzahlen:\n- <nur relevante Beträge / Jahre>\n\nMax ${summaryMaxChars} Zeichen. Deutsche Sprache. Keine Höflichkeitsfloskeln.\n\nCHAT BEGINN:\n${toSummarize}\nCHAT ENDE.`;
      const { getChatResponse } = await import('./geminiLazy');
      const raw = await getChatResponse(apiKey, [{ role: 'user', content: prompt } as any], [], [], { name: '' } as any, prompt, '');
      summary = raw.slice(0, summaryMaxChars);
    }
    await updateChatThreadSummary(threadId, summary);
  } catch (e) {
    console.warn('Summarize thread failed', e);
  }
};
