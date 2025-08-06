import { BusinessFormData } from '../../../services/businessService';

export interface FormStep {
  id: string;
  title: string;
  description: string;
  isValid: (data: Partial<BusinessFormData>) => boolean;
  requiredFields: (keyof BusinessFormData)[];
}

export interface BusinessFormProps {
  initialData?: Partial<BusinessFormData>;
  onSubmit: (data: BusinessFormData) => Promise<void>;
  onCancel?: () => void;
  isEditing?: boolean;
  businessId?: string;
}

export interface FormFieldError {
  field: string;
  message: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: FormFieldError[];
}

export type FormStepId = 
  | 'basic-info'
  | 'location'
  | 'contact'
  | 'hours'
  | 'categories'
  | 'review';

export interface FormStepProps {
  data: Partial<BusinessFormData>;
  onDataChange: (updates: Partial<BusinessFormData>) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  errors: FormFieldError[];
  isLoading?: boolean;
}