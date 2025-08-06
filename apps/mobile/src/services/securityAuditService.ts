import { BusinessInfo, WeeklyHours, SpecialHours } from '../../types/business';

export interface SecurityAuditResult {
  isSecure: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
}

export interface AuthenticationContext {
  userId: string;
  businessId: string;
  role: 'owner' | 'manager' | 'employee';
  permissions: string[];
  sessionExpiry: Date;
}

export interface DataValidationConfig {
  maxStringLength: number;
  maxArrayLength: number;
  allowedTimeFormats: string[];
  requiredPermissions: string[];
}

export class SecurityAuditService {
  private readonly MAX_STRING_LENGTH = 255;
  private readonly MAX_ARRAY_LENGTH = 100;
  private readonly DANGEROUS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
  ];

  /**
   * Validates business owner authentication and authorization
   */
  validateBusinessOwnerAccess(
    authContext: AuthenticationContext,
    businessId: string,
    operation: string
  ): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Check session validity
    if (new Date() > authContext.sessionExpiry) {
      errors.push('Authentication session has expired');
    }

    // Check business ownership
    if (authContext.businessId !== businessId) {
      errors.push('User does not have access to this business');
    }

    // Check role-based permissions
    if (authContext.role === 'employee' && operation === 'updateHours') {
      errors.push('Insufficient permissions: Only owners and managers can update hours');
    }

    // Check specific operation permissions
    const requiredPermission = this.getRequiredPermission(operation);
    if (!authContext.permissions.includes(requiredPermission)) {
      errors.push(`Missing required permission: ${requiredPermission}`);
    }

    // Session duration warnings
    const timeUntilExpiry = authContext.sessionExpiry.getTime() - new Date().getTime();
    if (timeUntilExpiry < 5 * 60 * 1000) { // Less than 5 minutes
      warnings.push('Authentication session expires soon');
    }

    // Security recommendations
    if (authContext.role === 'owner' && !authContext.permissions.includes('2fa_enabled')) {
      recommendations.push('Enable two-factor authentication for enhanced security');
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Validates hours data for security vulnerabilities
   */
  validateHoursDataSecurity(hours: WeeklyHours): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Check for XSS in time strings
    Object.entries(hours).forEach(([day, dayHours]) => {
      if (dayHours.open && this.containsDangerousContent(dayHours.open)) {
        errors.push(`Potential XSS attack in ${day} open time`);
      }
      if (dayHours.close && this.containsDangerousContent(dayHours.close)) {
        errors.push(`Potential XSS attack in ${day} close time`);
      }
    });

    // Validate time format consistency
    Object.entries(hours).forEach(([day, dayHours]) => {
      if (!dayHours.closed) {
        if (!this.isValidTimeFormat(dayHours.open)) {
          warnings.push(`${day}: Open time format may be invalid`);
        }
        if (!this.isValidTimeFormat(dayHours.close)) {
          warnings.push(`${day}: Close time format may be invalid`);
        }
      }
    });

    // Check for data size limits
    if (JSON.stringify(hours).length > 10000) {
      warnings.push('Hours data exceeds recommended size limit');
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Validates special hours data for security vulnerabilities
   */
  validateSpecialHoursDataSecurity(specialHours: SpecialHours[]): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    specialHours.forEach((item, index) => {
      // Check for XSS in name field
      if (this.containsDangerousContent(item.name)) {
        errors.push(`Potential XSS attack in special hours item ${index + 1} name`);
      }

      // Validate string lengths
      if (item.name && item.name.length > this.MAX_STRING_LENGTH) {
        warnings.push(`Special hours item ${index + 1} name exceeds maximum length`);
      }

      // Check date format
      if (!this.isValidDateFormat(item.date)) {
        warnings.push(`Special hours item ${index + 1} has invalid date format`);
      }

      // Validate hours if not closed
      if (!item.closed && item.hours) {
        if (item.hours.open && !this.isValidTimeFormat(item.hours.open)) {
          warnings.push(`Special hours item ${index + 1} has invalid open time format`);
        }
        if (item.hours.close && !this.isValidTimeFormat(item.hours.close)) {
          warnings.push(`Special hours item ${index + 1} has invalid close time format`);
        }
      }
    });

    // Check array size limits
    if (specialHours.length > this.MAX_ARRAY_LENGTH) {
      warnings.push('Special hours array exceeds recommended size limit');
    }

    // Check for duplicate entries (potential data integrity issue)
    const dates = specialHours.map(item => item.date);
    const duplicateDates = dates.filter((date, index) => dates.indexOf(date) !== index);
    if (duplicateDates.length > 0) {
      warnings.push(`Duplicate dates found: ${duplicateDates.join(', ')}`);
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Validates business information for security vulnerabilities
   */
  validateBusinessInfoSecurity(businessInfo: BusinessInfo): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // Check for XSS in text fields
    const textFields = ['name', 'description', 'category'];
    textFields.forEach(field => {
      const value = businessInfo[field as keyof BusinessInfo];
      if (typeof value === 'string' && this.containsDangerousContent(value)) {
        errors.push(`Potential XSS attack in business ${field}`);
      }
    });

    // Validate contact information
    if (businessInfo.contact) {
      const { email, phone, website } = businessInfo.contact;
      
      if (email && !this.isValidEmail(email)) {
        warnings.push('Invalid email format detected');
      }
      
      if (phone && !this.isValidPhone(phone)) {
        warnings.push('Invalid phone format detected');
      }
      
      if (website && !this.isValidURL(website)) {
        warnings.push('Invalid website URL detected');
      }
    }

    // Check for sensitive data exposure
    if (businessInfo.internalNotes && businessInfo.internalNotes.length > 0) {
      recommendations.push('Consider encrypting internal notes for enhanced privacy');
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Performs comprehensive security audit
   */
  performComprehensiveAudit(data: {
    authContext: AuthenticationContext;
    businessId: string;
    operation: string;
    businessInfo?: BusinessInfo;
    hours?: WeeklyHours;
    specialHours?: SpecialHours[];
  }): SecurityAuditResult {
    const results: SecurityAuditResult[] = [];

    // Authentication audit
    results.push(this.validateBusinessOwnerAccess(
      data.authContext,
      data.businessId,
      data.operation
    ));

    // Data validation audits
    if (data.businessInfo) {
      results.push(this.validateBusinessInfoSecurity(data.businessInfo));
    }

    if (data.hours) {
      results.push(this.validateHoursDataSecurity(data.hours));
    }

    if (data.specialHours) {
      results.push(this.validateSpecialHoursDataSecurity(data.specialHours));
    }

    // Combine all results
    const combinedResult: SecurityAuditResult = {
      isSecure: results.every(result => result.isSecure),
      warnings: results.flatMap(result => result.warnings),
      errors: results.flatMap(result => result.errors),
      recommendations: results.flatMap(result => result.recommendations),
    };

    return combinedResult;
  }

  /**
   * Sanitizes input data to prevent XSS attacks
   */
  sanitizeInput(input: unknown): unknown {
    if (typeof input === 'string') {
      return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/data:text\/html/gi, '')
        .replace(/vbscript:/gi, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object' && input !== null) {
      const sanitized: Record<string, unknown> = {};
      Object.keys(input).forEach(key => {
        sanitized[key] = this.sanitizeInput(input[key]);
      });
      return sanitized;
    }

    return input;
  }

  /**
   * Validates rate limiting for operations
   */
  validateRateLimit(
    userId: string,
    operation: string,
    maxOperationsPerHour: number = 100
  ): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    // This would typically check against a rate limiting store (Redis, etc.)
    // For now, we'll implement a basic check structure
    const operationCount = this.getOperationCount(userId, operation);
    
    if (operationCount > maxOperationsPerHour) {
      errors.push(`Rate limit exceeded for operation: ${operation}`);
    } else if (operationCount > maxOperationsPerHour * 0.8) {
      warnings.push(`Approaching rate limit for operation: ${operation}`);
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  /**
   * Validates IP address allowlist if configured
   */
  validateIPAccess(clientIP: string, allowedIPs?: string[]): SecurityAuditResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];

    if (allowedIPs && allowedIPs.length > 0) {
      if (!allowedIPs.includes(clientIP)) {
        errors.push('Access denied: IP address not in allowlist');
      }
    }

    // Check for suspicious IP patterns
    if (this.isSuspiciousIP(clientIP)) {
      warnings.push('Request from potentially suspicious IP address');
    }

    return {
      isSecure: errors.length === 0,
      warnings,
      errors,
      recommendations,
    };
  }

  // Private helper methods
  private containsDangerousContent(input: string): boolean {
    return this.DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
  }

  private isValidTimeFormat(time: string | undefined): boolean {
    if (!time) return false;
    return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  private isValidDateFormat(date: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private isValidPhone(phone: string): boolean {
    return /^[+]?[1-9][\d]{0,15}$/.test(phone.replace(/[\s\-()]/g, ''));
  }

  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private getRequiredPermission(operation: string): string {
    const permissionMap: Record<string, string> = {
      'updateHours': 'business_hours_write',
      'updateSpecialHours': 'special_hours_write',
      'updateBusinessInfo': 'business_info_write',
      'viewAnalytics': 'analytics_read',
      'manageUsers': 'user_management',
    };

    return permissionMap[operation] || 'basic_access';
  }

  private getOperationCount(_userId: string, _operation: string): number {
    // This would typically query a rate limiting store
    // For now, return a mock value
    return Math.floor(Math.random() * 50);
  }

  private isSuspiciousIP(ip: string): boolean {
    // Check for common suspicious patterns
    const suspiciousPatterns = [
      /^10\./, // Private IP trying to access externally
      /^192\.168\./, // Private IP trying to access externally
      /^127\./, // Localhost from external
    ];

    // This is a simplified check - real implementation would use threat intelligence
    return suspiciousPatterns.some(pattern => pattern.test(ip));
  }

  /**
   * Generates security audit report
   */
  generateAuditReport(auditResult: SecurityAuditResult): string {
    const report = [];
    
    report.push('=== SECURITY AUDIT REPORT ===');
    report.push(`Status: ${auditResult.isSecure ? 'SECURE' : 'SECURITY ISSUES FOUND'}`);
    report.push(`Timestamp: ${new Date().toISOString()}`);
    report.push('');
    
    if (auditResult.errors.length > 0) {
      report.push('🚨 CRITICAL SECURITY ISSUES:');
      auditResult.errors.forEach(error => report.push(`  - ${error}`));
      report.push('');
    }
    
    if (auditResult.warnings.length > 0) {
      report.push('⚠️  SECURITY WARNINGS:');
      auditResult.warnings.forEach(warning => report.push(`  - ${warning}`));
      report.push('');
    }
    
    if (auditResult.recommendations.length > 0) {
      report.push('💡 SECURITY RECOMMENDATIONS:');
      auditResult.recommendations.forEach(rec => report.push(`  - ${rec}`));
      report.push('');
    }
    
    report.push('=== END REPORT ===');
    
    return report.join('\n');
  }
}