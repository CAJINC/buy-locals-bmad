export type ServiceCategory = 'appointment' | 'consultation' | 'workshop' | 'rental' | 'dining' | 'event' | 'custom';

export interface ServiceTypeConfig {
  id: string;
  businessId: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  formFields: FormFieldConfig[];
  bookingRules: BookingRules;
  pricingModel: PricingModel;
  requirements: ServiceRequirements;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface FormFieldConfig {
  id: string;
  fieldName: string;
  displayLabel: string;
  fieldType: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  validation?: ValidationRule[];
  options?: SelectOption[];
  conditionalDisplay?: ConditionalLogic;
  order: number;
}

export type FormFieldType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'multiselect' 
  | 'radio'
  | 'checkbox'
  | 'number' 
  | 'date' 
  | 'time'
  | 'datetime'
  | 'email'
  | 'phone'
  | 'file' 
  | 'image';

export interface SelectOption {
  value: string;
  label: string;
  price?: number;
  disabled?: boolean;
  description?: string;
}

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'min' | 'max' | 'email' | 'phone' | 'custom';
  value?: string | number;
  message: string;
  customValidator?: string; // Reference to custom validation function
}

export interface ConditionalLogic {
  field: string;
  operator: 'equals' | 'notEquals' | 'contains' | 'greaterThan' | 'lessThan' | 'isEmpty' | 'isNotEmpty';
  value: unknown;
  action: 'show' | 'hide' | 'require' | 'optional';
}

export interface BookingRules {
  duration: number; // minutes
  bufferTime: number; // minutes before/after
  advanceBookingDays: number; // maximum days in advance
  minimumNotice: number; // minimum minutes before service
  maxDuration?: number; // maximum service duration
  allowMultiDay?: boolean;
  recurringAvailable?: boolean;
  cancellationPolicy: CancellationPolicy;
  modificationPolicy: ModificationPolicy;
  capacityLimits?: CapacityLimits;
}

export interface CancellationPolicy {
  allowCancellation: boolean;
  cancellationDeadline: number; // hours before service
  cancellationFee: number;
  refundPolicy: 'full' | 'partial' | 'none' | 'custom';
  customRefundRules?: RefundRule[];
}

export interface RefundRule {
  hoursBeforeService: number;
  refundPercentage: number;
  description: string;
}

export interface ModificationPolicy {
  allowModification: boolean;
  modificationDeadline: number; // hours before service
  modificationFee: number;
  allowedChanges: string[]; // array of field names that can be modified
  requiresApproval: boolean;
  maxModifications: number;
}

export interface CapacityLimits {
  maxConcurrentBookings: number;
  maxParticipants: number;
  minParticipants?: number;
  waitlistEnabled?: boolean;
}

export interface PricingModel {
  basePrice: number;
  currency: string;
  pricingType: 'fixed' | 'variable' | 'tiered' | 'time_based' | 'participant_based';
  priceModifiers?: PriceModifier[];
  packages?: ServicePackage[];
  addOns?: ServiceAddOn[];
  discountRules?: DiscountRule[];
}

export interface PriceModifier {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'multiplier';
  value: number;
  condition: PriceCondition;
  description?: string;
}

export interface PriceCondition {
  field: string;
  operator: string;
  value: unknown;
  timeWindow?: {
    start: string; // HH:MM format
    end: string;
    days?: string[]; // ['monday', 'tuesday', etc.]
  };
}

export interface ServicePackage {
  id: string;
  name: string;
  description?: string;
  services: string[]; // array of service type IDs
  price: number;
  savings: number;
  duration: number;
  validityPeriod?: number; // days
}

export interface ServiceAddOn {
  id: string;
  name: string;
  description?: string;
  price: number;
  optional: boolean;
  maxQuantity?: number;
  categories?: string[];
}

export interface DiscountRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  value: number;
  conditions: DiscountCondition[];
  validFrom?: Date;
  validUntil?: Date;
  usageLimit?: number;
  usageCount?: number;
}

export interface DiscountCondition {
  field: string;
  operator: string;
  value: unknown;
}

export interface ServiceRequirements {
  preparationTime?: number; // minutes
  resourceRequirements?: string[];
  staffRequirements?: StaffRequirement[];
  equipmentNeeded?: string[];
  prerequisiteDocuments?: string[];
  prerequisiteServices?: string[];
  specialInstructions?: string;
  locationRequirements?: LocationRequirement[];
}

export interface StaffRequirement {
  role: string;
  count: number;
  skillsRequired?: string[];
  certificationRequired?: string[];
}

export interface LocationRequirement {
  type: 'indoor' | 'outdoor' | 'specific_room' | 'flexible';
  specifications?: Record<string, unknown>;
  accessibility?: string[];
}

export interface CreateServiceTypeInput {
  businessId: string;
  name: string;
  category: ServiceCategory;
  description?: string;
  bookingRules: Partial<BookingRules>;
  pricingModel: Partial<PricingModel>;
  requirements?: Partial<ServiceRequirements>;
  formFields?: Partial<FormFieldConfig>[];
}

export interface UpdateServiceTypeInput extends Partial<CreateServiceTypeInput> {
  isActive?: boolean;
}

// Predefined service type templates
export interface ServiceTypeTemplate {
  name: string;
  category: ServiceCategory;
  description: string;
  defaultFormFields: Omit<FormFieldConfig, 'id'>[];
  defaultBookingRules: BookingRules;
  defaultPricingModel: PricingModel;
  defaultRequirements: ServiceRequirements;
}

export const SERVICE_TYPE_TEMPLATES: Record<string, ServiceTypeTemplate> = {
  restaurant_table: {
    name: 'Table Reservation',
    category: 'dining',
    description: 'Restaurant table reservations with party size and preferences',
    defaultFormFields: [
      {
        fieldName: 'partySize',
        displayLabel: 'Party Size',
        fieldType: 'number',
        required: true,
        placeholder: 'Number of guests',
        validation: [
          { type: 'required', message: 'Party size is required' },
          { type: 'min', value: 1, message: 'Minimum 1 guest' },
          { type: 'max', value: 20, message: 'Maximum 20 guests for online booking' }
        ],
        order: 1
      },
      {
        fieldName: 'seatingPreference',
        displayLabel: 'Seating Preference',
        fieldType: 'select',
        required: false,
        options: [
          { value: 'indoor', label: 'Indoor seating' },
          { value: 'outdoor', label: 'Outdoor seating (weather permitting)' },
          { value: 'bar', label: 'Bar seating' },
          { value: 'private', label: 'Private dining room', price: 50 }
        ],
        order: 2
      },
      {
        fieldName: 'occasion',
        displayLabel: 'Special Occasion',
        fieldType: 'select',
        required: false,
        options: [
          { value: 'birthday', label: 'Birthday' },
          { value: 'anniversary', label: 'Anniversary' },
          { value: 'business', label: 'Business meeting' },
          { value: 'date', label: 'Date night' },
          { value: 'other', label: 'Other celebration' }
        ],
        order: 3
      },
      {
        fieldName: 'dietaryRestrictions',
        displayLabel: 'Dietary Restrictions/Allergies',
        fieldType: 'textarea',
        required: false,
        placeholder: 'Please let us know about any dietary restrictions or allergies',
        order: 4
      }
    ],
    defaultBookingRules: {
      duration: 120, // 2 hours default
      bufferTime: 15,
      advanceBookingDays: 60,
      minimumNotice: 120, // 2 hours
      maxDuration: 180, // 3 hours max
      allowMultiDay: false,
      recurringAvailable: false,
      cancellationPolicy: {
        allowCancellation: true,
        cancellationDeadline: 4, // 4 hours before
        cancellationFee: 0,
        refundPolicy: 'full'
      },
      modificationPolicy: {
        allowModification: true,
        modificationDeadline: 2, // 2 hours before
        modificationFee: 0,
        allowedChanges: ['partySize', 'seatingPreference', 'dietaryRestrictions'],
        requiresApproval: false,
        maxModifications: 3
      }
    },
    defaultPricingModel: {
      basePrice: 0,
      currency: 'USD',
      pricingType: 'fixed'
    },
    defaultRequirements: {
      preparationTime: 15,
      resourceRequirements: ['table', 'chairs'],
      staffRequirements: [
        {
          role: 'server',
          count: 1
        }
      ]
    }
  },

  hair_appointment: {
    name: 'Hair Appointment',
    category: 'appointment',
    description: 'Hair salon appointments with service selection',
    defaultFormFields: [
      {
        fieldName: 'serviceType',
        displayLabel: 'Service Type',
        fieldType: 'select',
        required: true,
        options: [
          { value: 'cut', label: 'Haircut', price: 45 },
          { value: 'cut_color', label: 'Cut & Color', price: 85 },
          { value: 'color_only', label: 'Color Only', price: 65 },
          { value: 'highlights', label: 'Highlights', price: 95 },
          { value: 'perm', label: 'Perm', price: 120 },
          { value: 'blowout', label: 'Blowout', price: 35 }
        ],
        order: 1
      },
      {
        fieldName: 'hairLength',
        displayLabel: 'Current Hair Length',
        fieldType: 'select',
        required: true,
        options: [
          { value: 'short', label: 'Short (above shoulders)' },
          { value: 'medium', label: 'Medium (shoulder to mid-back)' },
          { value: 'long', label: 'Long (below mid-back)' }
        ],
        order: 2
      },
      {
        fieldName: 'colorHistory',
        displayLabel: 'Recent Color History',
        fieldType: 'textarea',
        required: false,
        placeholder: 'Please describe any recent color treatments, when they were done, and by whom',
        conditionalDisplay: {
          field: 'serviceType',
          operator: 'contains',
          value: 'color',
          action: 'show'
        },
        order: 3
      },
      {
        fieldName: 'specialRequests',
        displayLabel: 'Special Requests',
        fieldType: 'textarea',
        required: false,
        placeholder: 'Any specific requests or concerns?',
        order: 4
      }
    ],
    defaultBookingRules: {
      duration: 60,
      bufferTime: 15,
      advanceBookingDays: 30,
      minimumNotice: 240, // 4 hours
      maxDuration: 240, // 4 hours for complex services
      allowMultiDay: false,
      recurringAvailable: true,
      cancellationPolicy: {
        allowCancellation: true,
        cancellationDeadline: 24, // 24 hours before
        cancellationFee: 25,
        refundPolicy: 'partial',
        customRefundRules: [
          { hoursBeforeService: 48, refundPercentage: 100, description: 'Full refund' },
          { hoursBeforeService: 24, refundPercentage: 50, description: '50% refund' },
          { hoursBeforeService: 0, refundPercentage: 0, description: 'No refund' }
        ]
      },
      modificationPolicy: {
        allowModification: true,
        modificationDeadline: 12, // 12 hours before
        modificationFee: 10,
        allowedChanges: ['serviceType', 'specialRequests'],
        requiresApproval: true,
        maxModifications: 2
      }
    },
    defaultPricingModel: {
      basePrice: 45,
      currency: 'USD',
      pricingType: 'variable',
      priceModifiers: [
        {
          id: 'length_modifier',
          name: 'Hair Length Surcharge',
          type: 'percentage',
          value: 20,
          condition: {
            field: 'hairLength',
            operator: 'equals',
            value: 'long'
          },
          description: '20% surcharge for long hair'
        }
      ]
    },
    defaultRequirements: {
      preparationTime: 10,
      resourceRequirements: ['styling_chair', 'wash_station'],
      staffRequirements: [
        {
          role: 'stylist',
          count: 1,
          skillsRequired: ['cutting', 'coloring'],
          certificationRequired: ['cosmetology_license']
        }
      ],
      equipmentNeeded: ['scissors', 'blow_dryer', 'color_supplies']
    }
  }
};