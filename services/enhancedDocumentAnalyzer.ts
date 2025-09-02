import { Document, DocumentFolder, ExtractedDeadline, Task, TaskPriority, GeminiAnalysisResult } from '../types';
import { auditService } from './auditService';
import { taskService } from './taskService';

// Enhanced document analysis service that integrates with Gemini AI (FR-02, FR-03, FR-07)
export class EnhancedDocumentAnalyzer {
  
  // Analyze document with enhanced features
  async analyzeDocumentEnhanced(
    file: File,
    originalAnalysisResult: GeminiAnalysisResult,
    apiKey: string
  ): Promise<{
    folder: DocumentFolder;
    extractedDeadlines: ExtractedDeadline[];
    taskSuggestions: Partial<Task>[];
    needsManualReview: boolean;
    confidence: number;
  }> {
    try {
      // Log the analysis start
      auditService.logAction(
        'enhanced_document_analysis_start',
        'document',
        file.name,
        { fileSize: file.size, fileType: file.type },
        true,
        undefined,
        'gemini'
      );

      const enhancedAnalysis = await this.performEnhancedAnalysis(file, originalAnalysisResult, apiKey);
      
      // Log successful analysis
      auditService.logDocumentAnalysis(
        file.name,
        true,
        'gemini',
        enhancedAnalysis
      );

      return enhancedAnalysis;
    } catch (error) {
      // Log failed analysis
      auditService.logDocumentAnalysis(
        file.name,
        false,
        'gemini',
        {},
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      // Return fallback analysis
      return this.getFallbackAnalysis(originalAnalysisResult);
    }
  }

  // Perform enhanced analysis using AI
  private async performEnhancedAnalysis(
    file: File,
    originalResult: GeminiAnalysisResult,
    apiKey: string
  ): Promise<{
    folder: DocumentFolder;
    extractedDeadlines: ExtractedDeadline[];
    taskSuggestions: Partial<Task>[];
    needsManualReview: boolean;
    confidence: number;
  }> {
    // For now, implement rule-based analysis
    // In a full implementation, this would make another AI call for enhanced analysis
    
    const folder = this.suggestDocumentFolder(originalResult);
    const extractedDeadlines = this.extractDeadlinesFromText(originalResult.textContent);
    const taskSuggestions = this.generateTaskSuggestions(originalResult, extractedDeadlines);
    const needsManualReview = this.determineManualReviewNeed(originalResult);
    const confidence = this.calculateConfidenceScore(originalResult);

    return {
      folder,
      extractedDeadlines,
      taskSuggestions,
      needsManualReview,
      confidence
    };
  }

  // Suggest appropriate folder based on document content (FR-03)
  private suggestDocumentFolder(analysisResult: GeminiAnalysisResult): DocumentFolder {
    const textContent = analysisResult.textContent.toLowerCase();
    
    // Check for government/authority communications
    if (this.isGovernmentDocument(textContent)) {
      return DocumentFolder.BEHÖRDENKOMMUNIKATION;
    }
    
    // Check for reminders/demands
    if (this.isDemandLetter(textContent)) {
      return DocumentFolder.MAHNUNGEN;
    }
    
    // Check for contracts
    if (this.isContract(textContent)) {
      return DocumentFolder.VERTRÄGE;
    }
    
    // Check for tax documents
    if (this.isTaxDocument(textContent)) {
      return DocumentFolder.STEUERUNTERLAGEN;
    }
    
    // Default to invoices if it's an invoice, otherwise misc
    if (analysisResult.isInvoice) {
      return DocumentFolder.RECHNUNGEN;
    }
    
    return DocumentFolder.SONSTIGE;
  }

  // Helper methods for document type detection
  private isGovernmentDocument(text: string): boolean {
    const governmentKeywords = [
      'agentur für arbeit', 'arbeitsagentur', 'jobcenter',
      'finanzamt', 'steuerbescheid', 'steuererklärung',
      'sozialversicherung', 'krankenkasse', 'rentenversicherung',
      'gemeinde', 'stadtverwaltung', 'landkreis',
      'bundesamt', 'landesamt', 'gewerbeamt'
    ];
    return governmentKeywords.some(keyword => text.includes(keyword));
  }

  private isDemandLetter(text: string): boolean {
    const demandKeywords = [
      'mahnung', 'zahlungserinnerung', 'letzte mahnung',
      'säumniszuschlag', 'inkasso', 'vollstreckung',
      'zahlungsverzug', 'offener betrag'
    ];
    return demandKeywords.some(keyword => text.includes(keyword));
  }

  private isContract(text: string): boolean {
    const contractKeywords = [
      'vertrag', 'vereinbarung', 'kontrakt', 'rahmenvertrag',
      'mietvertrag', 'kaufvertrag', 'dienstleistungsvertrag',
      'lizenzvertrag', 'laufzeit', 'kündigung'
    ];
    return contractKeywords.some(keyword => text.includes(keyword));
  }

  private isTaxDocument(text: string): boolean {
    const taxKeywords = [
      'umsatzsteuer', 'einkommensteuer', 'gewerbesteuer',
      'steuerliche', 'steuernummer', 'ustid',
      'jahresabschluss', 'bilanz', 'gewinn- und verlustrechnung'
    ];
    return taxKeywords.some(keyword => text.includes(keyword));
  }

  // Extract deadlines from document text (FR-07)
  private extractDeadlinesFromText(textContent: string): ExtractedDeadline[] {
    const deadlines: ExtractedDeadline[] = [];
    const text = textContent.toLowerCase();
    
    // Common deadline patterns in German documents
    const deadlinePatterns = [
      {
        pattern: /zahlbar bis (\d{1,2})\.(\d{1,2})\.(\d{4})/g,
        type: 'Zahlungsfrist',
        description: 'Zahlungsfrist'
      },
      {
        pattern: /fällig am (\d{1,2})\.(\d{1,2})\.(\d{4})/g,
        type: 'Fälligkeitsdatum',
        description: 'Fälligkeitsdatum'
      },
      {
        pattern: /einspruch.*?bis.*?(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
        type: 'Einspruchsfrist',
        description: 'Einspruchsfrist'
      },
      {
        pattern: /antrag.*?bis.*?(\d{1,2})\.(\d{1,2})\.(\d{4})/g,
        type: 'Antragsfrist',
        description: 'Antragstellung'
      },
      {
        pattern: /binnen (\d+) tagen/g,
        type: 'Relative Frist',
        description: 'Frist läuft ab'
      }
    ];

    deadlinePatterns.forEach(({ pattern, type, description }) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let dueDate: Date;
        
        if (type === 'Relative Frist') {
          // Calculate date based on relative days
          const days = parseInt(match[1]);
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + days);
        } else {
          // Parse absolute date
          const day = parseInt(match[1]);
          const month = parseInt(match[2]) - 1; // JS months are 0-indexed
          const year = parseInt(match[3]);
          dueDate = new Date(year, month, day);
        }

        deadlines.push({
          id: `deadline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type,
          description: `${description} - ${match[0]}`,
          dueDate,
          isNotified: false,
          source: match[0]
        });
      }
    });

    return deadlines;
  }

  // Generate task suggestions based on document analysis (FR-06)
  private generateTaskSuggestions(
    analysisResult: GeminiAnalysisResult,
    extractedDeadlines: ExtractedDeadline[]
  ): Partial<Task>[] {
    const suggestions: Partial<Task>[] = [];

    // Invoice payment task
    if (analysisResult.isInvoice && analysisResult.totalAmount > 0) {
      suggestions.push({
        title: `Rechnung bezahlen: ${analysisResult.vendor}`,
        description: `Rechnung über ${analysisResult.totalAmount.toFixed(2)}€ bezahlen`,
        priority: analysisResult.totalAmount > 1000 ? TaskPriority.HIGH : TaskPriority.MEDIUM,
        createdBy: 'ai',
        aiSuggestion: 'Rechnung zur Zahlung vormerken',
        canAiHandle: false,
        tags: ['payment', 'invoice']
      });
    }

    // Deadline-based tasks
    extractedDeadlines.forEach(deadline => {
      suggestions.push({
        title: `Frist beachten: ${deadline.type}`,
        description: deadline.description,
        priority: this.calculateDeadlinePriority(deadline.dueDate),
        dueDate: deadline.dueDate,
        createdBy: 'ai',
        aiSuggestion: `Automatisch erkannte Frist: ${deadline.type}`,
        canAiHandle: this.canAiHandleDeadline(deadline.type),
        aiActionSuggestion: this.getAiActionSuggestion(deadline.type),
        tags: ['deadline', deadline.type.toLowerCase().replace(/\s+/g, '_')]
      });
    });

    // Document filing task
    suggestions.push({
      title: 'Dokument ablegen',
      description: `Dokument "${analysisResult.vendor}" in entsprechendem Ordner ablegen`,
      priority: TaskPriority.LOW,
      createdBy: 'ai',
      aiSuggestion: 'Dokument ordnungsgemäß archivieren',
      canAiHandle: true,
      aiActionSuggestion: 'Dokument automatisch in entsprechenden Ordner verschieben',
      tags: ['filing', 'organization']
    });

    return suggestions;
  }

  // Calculate task priority based on deadline
  private calculateDeadlinePriority(dueDate: Date): TaskPriority {
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 1) return TaskPriority.URGENT;
    if (daysUntilDue <= 7) return TaskPriority.HIGH;
    if (daysUntilDue <= 30) return TaskPriority.MEDIUM;
    return TaskPriority.LOW;
  }

  // Determine if AI can handle a deadline autonomously (FR-09)
  private canAiHandleDeadline(deadlineType: string): boolean {
    const aiCapableDeadlines = [
      'zahlungsbestätigung',
      'empfangsbestätigung',
      'rückfrage',
      'terminerinnerung'
    ];
    
    return aiCapableDeadlines.some(type => 
      deadlineType.toLowerCase().includes(type)
    );
  }

  // Get AI action suggestion for deadline (FR-10)
  private getAiActionSuggestion(deadlineType: string): string | undefined {
    const actionSuggestions = {
      'zahlungsfrist': 'Zahlungsbestätigung per E-Mail senden',
      'einspruchsfrist': 'Rechtsberatung kontaktieren',
      'antragsfrist': 'Antrag vorbereiten und einreichen',
      'kündigungsfrist': 'Kündigung vorbereiten oder Vertragsverlängerung prüfen'
    };

    for (const [key, suggestion] of Object.entries(actionSuggestions)) {
      if (deadlineType.toLowerCase().includes(key)) {
        return suggestion;
      }
    }

    return 'Entsprechende Maßnahmen einleiten';
  }

  // Determine if document needs manual review (FR-12)
  private determineManualReviewNeed(analysisResult: GeminiAnalysisResult): boolean {
    // Check for low confidence indicators
    if (!analysisResult.vendor || analysisResult.vendor.trim().length < 3) return true;
    if (analysisResult.totalAmount === 0 && analysisResult.isInvoice) return true;
    if (!analysisResult.textContent || analysisResult.textContent.length < 50) return true;
    
    // Check for complex document types
    const complexKeywords = ['rechtliches', 'gerichtlich', 'anwalt', 'notar', 'vollstreckung'];
    if (complexKeywords.some(keyword => 
      analysisResult.textContent.toLowerCase().includes(keyword)
    )) {
      return true;
    }

    return false;
  }

  // Calculate confidence score for the analysis
  private calculateConfidenceScore(analysisResult: GeminiAnalysisResult): number {
    let confidence = 1.0;

    // Reduce confidence for missing or unclear data
    if (!analysisResult.vendor || analysisResult.vendor.trim().length < 3) {
      confidence -= 0.2;
    }
    
    if (analysisResult.isInvoice && analysisResult.totalAmount === 0) {
      confidence -= 0.3;
    }
    
    if (!analysisResult.textContent || analysisResult.textContent.length < 100) {
      confidence -= 0.2;
    }
    
    if (analysisResult.taxCategory === 'Sonstiges') {
      confidence -= 0.1;
    }

    return Math.max(0, confidence);
  }

  // Get fallback analysis when AI fails
  private getFallbackAnalysis(originalResult: GeminiAnalysisResult): {
    folder: DocumentFolder;
    extractedDeadlines: ExtractedDeadline[];
    taskSuggestions: Partial<Task>[];
    needsManualReview: boolean;
    confidence: number;
  } {
    return {
      folder: originalResult.isInvoice ? DocumentFolder.RECHNUNGEN : DocumentFolder.SONSTIGE,
      extractedDeadlines: [],
      taskSuggestions: [{
        title: 'Dokument prüfen',
        description: 'Dokument wurde nicht vollständig analysiert und benötigt manuelle Überprüfung',
        priority: TaskPriority.MEDIUM,
        createdBy: 'ai',
        aiSuggestion: 'Manuelle Überprüfung erforderlich',
        canAiHandle: false,
        tags: ['manual_review', 'fallback']
      }],
      needsManualReview: true,
      confidence: 0.3
    };
  }
}

// Singleton instance
export const enhancedDocumentAnalyzer = new EnhancedDocumentAnalyzer();