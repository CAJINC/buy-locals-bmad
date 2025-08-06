import type { FormFieldConfig } from '../../../api/types/ServiceType';

export interface SelectOption {
  value: string;
  label: string;
  price?: number;
  disabled?: boolean;
  description?: string;
}

export interface DynamicFormFieldProps {
  config: FormFieldConfig;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  theme?: 'light' | 'dark';
  disabled?: boolean;
  allFormData?: Record<string, unknown>;
}

export interface FileSelection {
  uri: string;
  name: string;
  type: string;
  size?: number;
}