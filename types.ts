export enum View {
  DOCUMENTS = 'documents',
  SETTINGS = 'settings',
  ANALYSIS = 'analysis',
  RULES = 'rules',
  DEADLINES = 'deadlines',
  LEXOFFICE = 'lexoffice',
  PROFILE = 'profile',
  FÖRDERUNGEN = 'förderungen',
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
  textContent?: string;
  vendor?: string;
  totalAmount?: number;
  vatAmount?: number;
  invoiceNumber?: string;
  invoiceType: InvoiceType;
  taxCategory?: string;
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
}
