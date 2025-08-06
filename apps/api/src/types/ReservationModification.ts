export interface ModificationPolicy {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  allowModification: boolean;
  modificationDeadline: number; // Hours before scheduled time
  modificationFee: number;
  allowedChanges: ModificationChangeType[];
  requiresApproval: boolean;
  maxModifications: number;
  autoApprovalRules?: AutoApprovalRule[];
  isActive: boolean;
  serviceTypeIds?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export type ModificationChangeType = 
  | 'date_time'
  | 'service_type'
  | 'duration'
  | 'customer_info'
  | 'requirements'
  | 'add_services'
  | 'remove_services'
  | 'party_size'
  | 'special_requests';

export interface AutoApprovalRule {
  id: string;
  name: string;
  conditions: AutoApprovalCondition[];
  action: 'approve' | 'reject' | 'review';
}

export interface AutoApprovalCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in_range';
  value: any;
}

export interface ModificationRequest {
  id: string;
  reservationId: string;
  businessId: string;
  requestedBy: 'customer' | 'business';
  requestedAt: Date;
  status: ModificationRequestStatus;
  type: ModificationChangeType;
  originalData: Record<string, any>;
  proposedChanges: Record<string, any>;
  reason?: string;
  customerMessage?: string;
  businessMessage?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  approvalDeadline?: Date;
  fee?: number;
  policyId: string;
  modificationCount: number;
  metadata: {
    impactAnalysis?: ModificationImpact;
    autoApprovalResult?: AutoApprovalResult;
    conflictChecks?: ConflictCheck[];
  };
  createdAt: Date;
  updatedAt: Date;
}

export type ModificationRequestStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'withdrawn'
  | 'review_required';

export interface ModificationImpact {
  availabilityImpact: {
    hasConflicts: boolean;
    conflictingReservations: string[];
    suggestedAlternatives?: Date[];
  };
  pricingImpact: {
    originalAmount: number;
    newAmount: number;
    difference: number;
    additionalFees: number;
    refundAmount?: number;
  };
  resourceImpact: {
    staffingChanges: boolean;
    equipmentChanges: boolean;
    inventoryChanges: boolean;
    affectedResources: string[];
  };
  customerImpact: {
    notificationRequired: boolean;
    confirmationRequired: boolean;
    compensationSuggested: boolean;
  };
}

export interface AutoApprovalResult {
  canAutoApprove: boolean;
  matchedRules: string[];
  action: 'approve' | 'reject' | 'review';
  reason: string;
  confidence: number; // 0-1
}

export interface ConflictCheck {
  type: 'scheduling' | 'resource' | 'policy' | 'business_rule';
  hasConflict: boolean;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'blocking';
  resolution?: string;
}

export interface ModificationWorkflow {
  id: string;
  businessId: string;
  name: string;
  steps: WorkflowStep[];
  triggers: WorkflowTrigger[];
  isActive: boolean;
  serviceTypeIds?: string[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  type: 'approval' | 'notification' | 'validation' | 'automation';
  order: number;
  configuration: WorkflowStepConfiguration;
  conditions?: WorkflowCondition[];
}

export interface WorkflowStepConfiguration {
  // Approval step
  approvers?: string[];
  approvalRequired?: boolean;
  timeoutHours?: number;
  
  // Notification step
  recipients?: string[];
  template?: string;
  channels?: ('email' | 'push' | 'sms')[];
  
  // Validation step
  validations?: ValidationRule[];
  
  // Automation step
  action?: string;
  parameters?: Record<string, any>;
}

export interface ValidationRule {
  field: string;
  rule: string;
  value: any;
  message: string;
}

export interface WorkflowCondition {
  field: string;
  operator: string;
  value: any;
}

export interface WorkflowTrigger {
  event: 'modification_requested' | 'approval_received' | 'timeout' | 'status_changed';
  conditions?: WorkflowCondition[];
}

export interface ModificationTemplate {
  id: string;
  businessId: string;
  name: string;
  description?: string;
  type: ModificationChangeType;
  template: {
    allowedFields: string[];
    requiredFields: string[];
    defaultValues?: Record<string, any>;
    validationRules: ValidationRule[];
    ui: {
      title: string;
      instructions?: string;
      formFields: FormFieldConfiguration[];
    };
  };
  isActive: boolean;
  serviceTypeIds?: string[];
}

export interface FormFieldConfiguration {
  field: string;
  type: 'text' | 'select' | 'date' | 'time' | 'datetime' | 'number' | 'textarea';
  label: string;
  required: boolean;
  options?: { value: string; label: string }[];
  validation?: string;
  defaultValue?: any;
  helpText?: string;
}

export interface ModificationHistory {
  reservationId: string;
  modifications: ModificationRecord[];
  totalModifications: number;
  lastModifiedAt?: Date;
  modificationLimit: number;
  remainingModifications: number;
}

export interface ModificationRecord {
  id: string;
  requestId: string;
  timestamp: Date;
  type: ModificationChangeType;
  changes: Record<string, { from: any; to: any }>;
  fee: number;
  approvedBy?: string;
  notes?: string;
}

// API Request/Response types
export interface CreateModificationRequestData {
  reservationId: string;
  type: ModificationChangeType;
  proposedChanges: Record<string, any>;
  reason?: string;
  customerMessage?: string;
}

export interface ReviewModificationRequestData {
  action: 'approve' | 'reject';
  businessMessage?: string;
  fee?: number;
  conditions?: string[];
}

export interface ModificationRequestResponse {
  request: ModificationRequest;
  impact: ModificationImpact;
  timeline: {
    submittedAt: Date;
    reviewDeadline: Date;
    implementationDeadline?: Date;
  };
  nextSteps: string[];
}

export interface ModificationPolicyConfiguration {
  businessId: string;
  defaultPolicy: Partial<ModificationPolicy>;
  serviceTypePolicies: Array<{
    serviceTypeId: string;
    policy: Partial<ModificationPolicy>;
  }>;
  workflows: ModificationWorkflow[];
  templates: ModificationTemplate[];
  settings: {
    enableCustomerSelfService: boolean;
    requireBusinessApproval: boolean;
    allowMultipleModifications: boolean;
    defaultModificationWindow: number; // hours
    defaultMaxModifications: number;
  };
}