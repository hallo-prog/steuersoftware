import { AuditLogEntry } from '../types';

// Audit logging service for AI actions and system events (FR-13)
export class AuditService {
  private logs: AuditLogEntry[] = [];
  private maxLogs = 10000; // Keep only the most recent 10,000 logs

  // Log an AI action or system event
  logAction(
    action: string,
    entityType: string,
    entityId: string,
    details: Record<string, any>,
    success: boolean = true,
    userId?: string,
    aiModel?: string,
    errorMessage?: string
  ): AuditLogEntry {
    const logEntry: AuditLogEntry = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      action,
      entityType,
      entityId,
      userId,
      aiModel,
      details,
      success,
      errorMessage,
    };

    this.logs.unshift(logEntry); // Add to beginning for chronological order
    
    // Trim logs if we exceed max limit
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs);
    }

    return logEntry;
  }

  // Get all logs
  getAllLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  // Get logs by entity
  getLogsByEntity(entityType: string, entityId: string): AuditLogEntry[] {
    return this.logs.filter(log => 
      log.entityType === entityType && log.entityId === entityId
    );
  }

  // Get logs by user
  getLogsByUser(userId: string): AuditLogEntry[] {
    return this.logs.filter(log => log.userId === userId);
  }

  // Get logs by AI model
  getLogsByAiModel(aiModel: string): AuditLogEntry[] {
    return this.logs.filter(log => log.aiModel === aiModel);
  }

  // Get failed actions
  getFailedActions(): AuditLogEntry[] {
    return this.logs.filter(log => !log.success);
  }

  // Get logs within date range
  getLogsByDateRange(startDate: Date, endDate: Date): AuditLogEntry[] {
    return this.logs.filter(log => 
      log.timestamp >= startDate && log.timestamp <= endDate
    );
  }

  // Search logs by action or details
  searchLogs(query: string): AuditLogEntry[] {
    const lowerQuery = query.toLowerCase();
    return this.logs.filter(log =>
      log.action.toLowerCase().includes(lowerQuery) ||
      JSON.stringify(log.details).toLowerCase().includes(lowerQuery) ||
      (log.errorMessage && log.errorMessage.toLowerCase().includes(lowerQuery))
    );
  }

  // Helper methods for common logging scenarios

  // Log document analysis
  logDocumentAnalysis(
    documentId: string,
    success: boolean,
    aiModel: string,
    analysisResults: any,
    errorMessage?: string
  ) {
    return this.logAction(
      'document_analysis',
      'document',
      documentId,
      { analysisResults },
      success,
      undefined,
      aiModel,
      errorMessage
    );
  }

  // Log task creation
  logTaskCreation(
    taskId: string,
    createdBy: 'user' | 'ai',
    documentId?: string,
    aiSuggestion?: string
  ) {
    return this.logAction(
      'task_created',
      'task',
      taskId,
      { createdBy, documentId, aiSuggestion },
      true,
      createdBy === 'user' ? 'current_user' : undefined,
      createdBy === 'ai' ? 'gemini' : undefined
    );
  }

  // Log autonomous AI action
  logAutonomousAction(
    actionType: string,
    entityId: string,
    actionDetails: any,
    success: boolean,
    aiModel: string = 'gemini',
    errorMessage?: string
  ) {
    return this.logAction(
      `autonomous_${actionType}`,
      'ai_action',
      entityId,
      actionDetails,
      success,
      undefined,
      aiModel,
      errorMessage
    );
  }

  // Log email sending
  logEmailSent(
    recipientEmail: string,
    subject: string,
    success: boolean,
    taskId?: string,
    errorMessage?: string
  ) {
    return this.logAction(
      'email_sent',
      'email',
      `email-${Date.now()}`,
      { recipientEmail, subject, taskId },
      success,
      'current_user',
      undefined,
      errorMessage
    );
  }

  // Log notification sending
  logNotificationSent(
    notificationType: string,
    recipientId: string,
    content: any,
    success: boolean,
    errorMessage?: string
  ) {
    return this.logAction(
      'notification_sent',
      'notification',
      `notification-${Date.now()}`,
      { notificationType, recipientId, content },
      success,
      undefined,
      undefined,
      errorMessage
    );
  }

  // Log contact creation from document
  logContactCreation(
    contactId: string,
    documentId: string,
    extractedData: any,
    success: boolean,
    aiModel: string = 'gemini'
  ) {
    return this.logAction(
      'contact_created_from_document',
      'contact',
      contactId,
      { documentId, extractedData },
      success,
      undefined,
      aiModel
    );
  }

  // Log deadline extraction
  logDeadlineExtraction(
    documentId: string,
    extractedDeadlines: any[],
    success: boolean,
    aiModel: string = 'gemini',
    errorMessage?: string
  ) {
    return this.logAction(
      'deadline_extraction',
      'document',
      documentId,
      { extractedDeadlines, count: extractedDeadlines.length },
      success,
      undefined,
      aiModel,
      errorMessage
    );
  }

  // Export logs as JSON
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  // Clear all logs (use with caution)
  clearLogs(): void {
    this.logs = [];
  }

  // Get statistics
  getStatistics() {
    const totalLogs = this.logs.length;
    const failedActions = this.logs.filter(log => !log.success).length;
    const successRate = totalLogs > 0 ? ((totalLogs - failedActions) / totalLogs * 100).toFixed(2) : '100';
    
    const actionTypes = {};
    const aiModels = {};
    
    this.logs.forEach(log => {
      // Count action types
      actionTypes[log.action] = (actionTypes[log.action] || 0) + 1;
      
      // Count AI model usage
      if (log.aiModel) {
        aiModels[log.aiModel] = (aiModels[log.aiModel] || 0) + 1;
      }
    });

    return {
      totalLogs,
      failedActions,
      successRate: `${successRate}%`,
      mostCommonActions: Object.entries(actionTypes)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5),
      aiModelUsage: aiModels,
    };
  }
}

// Singleton instance
export const auditService = new AuditService();