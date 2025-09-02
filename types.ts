export enum View {
  DOCUMENTS = 'documents',
  SETTINGS = 'settings',
  ANALYSIS = 'analysis',
  RULES = 'rules',
  DEADLINES = 'deadlines',
  LEXOFFICE = 'lexoffice',
  PROFILE = 'profile',
  FÖRDERUNGEN = 'förderungen',
  VERSICHERUNGEN = 'versicherungen',
  VERBINDLICHKEITEN = 'verbindlichkeiten',
  KONTAKTE = 'kontakte',
  DATENBANKEN = 'datenbanken',
  TASKS = 'tasks',
}

export enum DocumentSource {
  MANUAL = 'Manuell',
  LOCAL = 'Lokaler PC',
  EMAIL = 'E-Mail',
  WHATSAPP = 'WhatsApp',
}

export enum DocumentStatus {
  OK = 'OK',
  MISSING_INVOICE = 'Rechnung fehlt',
  SCREENSHOT = 'Screenshot',
  ANALYZING = 'Analysiere...',
  POTENTIAL_DUPLICATE = 'Mögliches Duplikat',
  ARCHIVED = 'Archiviert',
  ERROR = 'Fehler',
}

export enum InvoiceType {
  INCOMING = 'Eingangsrechnung',
  OUTGOING = 'Ausgangsrechnung',
}

export enum LexofficeStatus {
    NOT_SENT = 'Nicht gesendet',
    SUCCESS = 'Erfolgreich',
    FAILED = 'Fehlgeschlagen',
}

export interface DocumentFilter {
  year: number;
  quarter?: number;
}

export interface Rule {
  id: string;
  conditionType: 'vendor' | 'textContent';
  conditionValue: string;
  invoiceType: InvoiceType;
  resultCategory: string;
}

export interface RuleSuggestion {
  vendor: string;
  taxCategory: string;
  invoiceType: InvoiceType;
}

export interface UserProfile {
  name: string;
  taxId: string;
  vatId: string;
  taxNumber: string;
  companyForm: string;
  profilePicture?: string;
  industry?: string;
  employees?: number;
  locationState?: string; // Bundesland
  foundingYear?: number;
}

export interface Document {
  id: string;
  name: string;
  date: Date;
  year: number;
  quarter: number;
  source: DocumentSource;
  status: DocumentStatus;
  fileUrl: string;
  file?: File;
  storageProvider?: 'supabase' | 'r2';
  textContent?: string;
  vendor?: string;
  totalAmount?: number;
  vatAmount?: number;
  invoiceNumber?: string;
  invoiceType: InvoiceType;
  taxCategory?: string;
  aiSuggestedTaxCategory?: string;
  flags?: string[];
  anomalyScore?: number;
  liabilityId?: string; // relation zu Verbindlichkeiten
  insurancePolicyId?: string; // relation zu Versicherungspolice
  lexoffice?: {
    status: LexofficeStatus;
    sentAt: Date;
  };
  errorMessage?: string;
}

export interface GeminiAnalysisResult {
    isInvoice: boolean;
    isOrderConfirmation: boolean;
    isEmailBody: boolean;
    documentDate: string; // ISO 8601 format
    textContent: string;
    vendor: string;
    totalAmount: number;
    vatAmount: number;
    invoiceNumber: string;
    invoiceType: InvoiceType;
    taxCategory: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
  rawContent?: string; // Original, unmodified text from the model
  documentId?: string;
}

export interface Deadline {
  id: string;
  title: string;
  dueDate: Date;
  remainingDays: number;
}

export interface NotificationSettings {
  notify14Days: boolean;
  notify1Day: boolean;
}

export interface FundingOpportunity {
  id: string;
  title: string;
  source: string;
  description: string;
  eligibilitySummary: string;
  link: string;
  // Optionale erweiterte Metadaten für intelligentere Suche/Aufbereitung
  relevanceScore?: number; // von KI berechneter Score 0-1
  fetchedAt?: string; // ISO Zeitstempel wann gefunden
  sourceUrls?: string[]; // Ursprüngliche Quell-URLs aus der Websuche
  level?: 'bund' | 'land' | 'eu' | 'other'; // Klassifikation Förder-Ebene
  land?: string; // Bundesland Name falls level === 'land'
  requires?: string[]; // Anforderungsliste (optional KI)
  coverageRatePercent?: number;
  grantAmountMin?: number;
  grantAmountMax?: number;
  validTo?: string;
}

export type InsuranceType = 'Betriebshaftpflicht' | 'Hausrat' | 'Private Rechtsschutz' | 'Betriebliche Rechtsschutz' | 'KFZ' | 'Sonstige';
export type InsuranceClaimType = 'Schadensfall' | 'Rechtsschutzfall' | 'Zahlungsfall';

export interface InsuranceDocument {
  id: string;
  fileName: string;
  uploadedAt: string;
  textContent?: string;
  publicUrl?: string;
  // Neu: interner Storage-Pfad (wird gespeichert, um publicUrl nach Reload rekonstruieren zu können)
  storagePath?: string;
}

export interface InsurancePolicy {
  id: string;
  name: string;
  type?: InsuranceType | string;
  insurer?: string;
  policyNumber?: string;
  startDate?: string;
  endDate?: string;
  paymentInterval?: string;
  premiumAmount?: number;
  coverageSummary?: string;
  coverageItems?: string[];
  exclusions?: string[];
  contactPhone?: string;
  contactEmail?: string;
  documents?: InsuranceDocument[];
  riskScore?: number;
  riskGaps?: string[];
  riskRecommendation?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InsuranceClaim {
  id: string;
  policyId: string;
  type: InsuranceClaimType | string;
  title: string;
  description?: string;
  createdAt?: string;
  documents: InsuranceDocument[];
  aiSummary?: string;
  aiRecommendation?: string;
  status?: string;
}

export interface ClaimEvent {
  id?: string;
  claimId: string;
  eventType: string;
  payloadJson?: any;
  createdAt?: string;
}

export interface FeatureFlagsMap { [flag: string]: boolean; }

// Verbindlichkeiten (Liabilities / Schulden & Verträge)
export interface Liability {
  id: string;
  name: string; // Freier Name / Titel
  creditor?: string; // Gläubiger
  contractNumber?: string;
  startDate?: string;
  endDate?: string;
  paymentInterval?: string; // monatlich|quartal|jährlich|einmalig
  outstandingAmount?: number; // Offener Restbetrag
  originalAmount?: number; // Ursprünglicher Betrag / Kreditbetrag
  interestRatePercent?: number; // Effektiver Zinssatz
  category?: string; // z.B. Darlehen, Leasing, Lieferant, Sonstige
  notes?: string;
  tags?: string[];
  contactEmail?: string;
  contactPhone?: string;
  aiRiskScore?: number; // KI Bewertung (0-1)
  aiRecommendation?: string;
  aiSummary?: string; // Kurz-Zusammenfassung
  createdAt?: string;
  updatedAt?: string;
}

export interface LiabilityDocument {
  id: string;
  liabilityId: string;
  fileName: string;
  uploadedAt: string;
  textContent?: string;
  publicUrl?: string;
}

// Kontakte (aggregiert aus Policen, Verbindlichkeiten, Dokumenten Vendors)
export interface Contact {
  id: string; // stable hash oder zusammengesetzt
  name: string; // Firmenname oder Ansprechpartner
  type: 'Gläubiger' | 'Versicherung' | 'Vendor' | 'Sonstige';
  email?: string;
  phone?: string;
  sourceIds?: string[]; // referenzierte Entity IDs
  tags?: string[];
  lastDocumentDate?: string;
  notes?: string;
  aiSummary?: string; // optional KI Kurzzusammenfassung
}

// Aufgaben / Tasks
export interface Task {
  id: string;
  userId: string;
  documentId?: string;
  title: string;
  description?: string;
  priority: 'low'|'normal'|'high'|'critical';
  status: 'open'|'in_progress'|'done'|'cancelled'|'auto_executed';
  source: 'ai'|'user'|'system';
  dueDate?: string; // ISO
  autoAction?: { type: string; template?: string; suggested?: boolean; executedAt?: string; } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  userId: string;
  correlationId?: string;
  actorType: 'user'|'system'|'ai';
  eventType: string;
  payloadJson?: any;
  createdAt: string;
}

