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
  AUDIT = 'audit',
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
  folder?: DocumentFolder; // AI-assigned folder (FR-03)
  extractedDeadlines?: ExtractedDeadline[]; // AI-extracted deadlines (FR-07)
  generatedTasks?: string[]; // IDs of tasks generated from this document (FR-06)
  lexoffice?: {
    status: LexofficeStatus;
    sentAt: Date;
  };
  errorMessage?: string;
  needsManualReview?: boolean; // Flag for unclear OCR (FR-12)
  manualReviewNotes?: string;
}

// For deadlines extracted from document content (FR-07)
export interface ExtractedDeadline {
  id: string;
  type: string; // e.g., "Zahlungsfrist", "Einspruchsfrist", "Antragsstellung"
  description: string;
  dueDate: Date;
  isNotified?: boolean; // Track if 2-day notification was sent (FR-08)
  source: string; // Where in the document this was found
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
    // Enhanced analysis results (FR-03, FR-07)
    suggestedFolder?: DocumentFolder;
    extractedDeadlines?: {
        type: string;
        description: string;
        dueDate: string; // ISO 8601 format
        source: string;
    }[];
    taskSuggestions?: {
        title: string;
        description: string;
        priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
        canAiHandle: boolean;
        actionSuggestion?: string;
    }[];
    needsManualReview?: boolean;
    reviewReason?: string;
    confidence?: number; // 0-1 confidence score for the analysis
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

// Task management for document-generated tasks (FR-06)
export enum TaskStatus {
  PENDING = 'Offen',
  IN_PROGRESS = 'In Bearbeitung',
  COMPLETED = 'Abgeschlossen',
  CANCELLED = 'Abgebrochen',
}

export enum TaskPriority {
  LOW = 'Niedrig',
  MEDIUM = 'Mittel',
  HIGH = 'Hoch',
  URGENT = 'Dringend',
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date;
  documentId?: string; // Reference to document that generated this task
  contactId?: string; // Reference to relevant contact
  assignedTo?: string; // User assignment
  createdAt: Date;
  updatedAt: Date;
  createdBy: 'user' | 'ai'; // Track if AI created the task
  aiSuggestion?: string; // AI's reason for creating this task
  canAiHandle?: boolean; // Whether AI thinks it can handle this autonomously (FR-09)
  aiActionSuggestion?: string; // What autonomous action AI suggests (FR-10)
  tags?: string[];
}

// Document folders for better organization (FR-03)
export enum DocumentFolder {
  RECHNUNGEN = 'Rechnungen',
  MAHNUNGEN = 'Mahnungen',
  BEHÖRDENKOMMUNIKATION = 'Behördenkommunikation',
  VERTRÄGE = 'Verträge',
  STEUERUNTERLAGEN = 'Steuerunterlagen',
  SONSTIGE = 'Sonstige',
}

// Audit logging for AI actions (FR-13)
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  aiModel?: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
}

