import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { jest } from '@jest/globals';
import { AdaptiveReservationForm } from './AdaptiveReservationForm';
import type { BusinessType } from '../../../types/Business';
import type { ServiceTypeConfig } from '../../../types/Service';

// Mock dependencies
jest.mock('../../../hooks/useFormConfiguration');
jest.mock('react-hook-form');

const mockUseFormConfiguration = require('../../../hooks/useFormConfiguration').useFormConfiguration as jest.Mock;
const mockUseForm = require('react-hook-form').useForm as jest.Mock;

// Mock form control
const mockControl = {
  register: jest.fn(),
  setValue: jest.fn(),
  getValues: jest.fn(),
  formState: { errors: {} }
};

const mockHandleSubmit = jest.fn();
const mockWatch = jest.fn().mockReturnValue({});

describe('AdaptiveReservationForm', () => {
  const mockOnSubmit = jest.fn();
  
  const defaultServiceTypeConfig: ServiceTypeConfig = {
    type: 'appointment',
    formFields: [
      {
        fieldName: 'customerName',
        fieldType: 'text',
        required: true,
        validation: [{ type: 'minLength', value: 2 }]
      },
      {
        fieldName: 'serviceType',
        fieldType: 'select',
        required: true,
        options: [
          { value: 'consultation', label: 'Consultation' },
          { value: 'therapy', label: 'Therapy Session' }
        ]
      },
      {
        fieldName: 'specialRequests',
        fieldType: 'text',
        required: false
      }
    ],
    bookingRules: {
      advanceBookingDays: 14,
      minimumNotice: 24,
      maxDuration: 120
    },
    pricingModel: {
      basePrice: 100,
      currency: 'USD'
    },
    requirements: {
      preparationTime: 15
    }
  };

  const defaultProps = {
    businessType: 'healthcare' as BusinessType,
    serviceType: defaultServiceTypeConfig,
    onSubmit: mockOnSubmit,
    initialData: undefined
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseForm.mockReturnValue({
      control: mockControl,
      handleSubmit: mockHandleSubmit,
      watch: mockWatch,
      formState: { errors: {}, isValid: true },
      setValue: jest.fn(),
      getValues: jest.fn()
    });

    mockUseFormConfiguration.mockReturnValue({
      fields: defaultServiceTypeConfig.formFields,
      validationRules: {},
      conditionalLogic: {}
    });
  });

  describe('Form Rendering', () => {
    it('should render form with service type configuration fields', () => {
      render(<AdaptiveReservationForm {...defaultProps} />);

      expect(screen.getByText('Customer Name')).toBeTruthy();
      expect(screen.getByText('Service Type')).toBeTruthy();
      expect(screen.getByText('Special Requests')).toBeTruthy();
    });

    it('should render different fields for restaurant business type', () => {
      const restaurantServiceType: ServiceTypeConfig = {
        type: 'dining',
        formFields: [
          {
            fieldName: 'partySize',
            fieldType: 'number',
            required: true,
            validation: [{ type: 'min', value: 1 }, { type: 'max', value: 20 }]
          },
          {
            fieldName: 'seatingPreference',
            fieldType: 'select',
            required: false,
            options: [
              { value: 'indoor', label: 'Indoor' },
              { value: 'outdoor', label: 'Outdoor' },
              { value: 'bar', label: 'Bar Seating' }
            ]
          },
          {
            fieldName: 'dietaryRestrictions',
            fieldType: 'text',
            required: false
          }
        ],
        bookingRules: {
          advanceBookingDays: 30,
          minimumNotice: 2,
          maxDuration: 180
        },
        pricingModel: {
          basePrice: 0,
          currency: 'USD'
        },
        requirements: {}
      };

      mockUseFormConfiguration.mockReturnValue({
        fields: restaurantServiceType.formFields,
        validationRules: {},
        conditionalLogic: {}
      });

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          businessType="restaurant"
          serviceType={restaurantServiceType}
        />
      );

      expect(screen.getByText('Party Size')).toBeTruthy();
      expect(screen.getByText('Seating Preference')).toBeTruthy();
      expect(screen.getByText('Dietary Restrictions')).toBeTruthy();
    });

    it('should render required field indicators', () => {
      render(<AdaptiveReservationForm {...defaultProps} />);

      const requiredFields = screen.getAllByText('*');
      expect(requiredFields.length).toBeGreaterThan(0);
    });

    it('should handle fields with conditional display logic', () => {
      const configWithConditionalFields: ServiceTypeConfig = {
        ...defaultServiceTypeConfig,
        formFields: [
          {
            fieldName: 'serviceType',
            fieldType: 'select',
            required: true,
            options: [
              { value: 'basic', label: 'Basic Service' },
              { value: 'premium', label: 'Premium Service' }
            ]
          },
          {
            fieldName: 'premiumOptions',
            fieldType: 'select',
            required: false,
            options: [
              { value: 'addon1', label: 'Premium Add-on 1' },
              { value: 'addon2', label: 'Premium Add-on 2' }
            ],
            conditionalDisplay: {
              dependsOn: 'serviceType',
              showWhen: { equals: 'premium' }
            }
          }
        ]
      };

      mockUseFormConfiguration.mockReturnValue({
        fields: configWithConditionalFields.formFields,
        validationRules: {},
        conditionalLogic: {
          premiumOptions: {
            dependsOn: 'serviceType',
            showWhen: { equals: 'premium' }
          }
        }
      });

      // Mock watch to return premium service selection
      mockWatch.mockReturnValue({ serviceType: 'premium' });

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithConditionalFields}
        />
      );

      expect(screen.getByText('Premium Options')).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    it('should show validation errors for required fields', async () => {
      const formWithErrors = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: {
            customerName: { type: 'required', message: 'Customer name is required' },
            serviceType: { type: 'required', message: 'Service type is required' }
          },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithErrors);

      render(<AdaptiveReservationForm {...defaultProps} />);

      expect(screen.getByText('Customer name is required')).toBeTruthy();
      expect(screen.getByText('Service type is required')).toBeTruthy();
    });

    it('should validate field length requirements', async () => {
      const formWithLengthError = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: {
            customerName: { type: 'minLength', message: 'Name must be at least 2 characters' }
          },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithLengthError);

      render(<AdaptiveReservationForm {...defaultProps} />);

      expect(screen.getByText('Name must be at least 2 characters')).toBeTruthy();
    });

    it('should validate number field ranges', async () => {
      const partySize field with range validation
      const configWithNumberField: ServiceTypeConfig = {
        ...defaultServiceTypeConfig,
        formFields: [
          {
            fieldName: 'partySize',
            fieldType: 'number',
            required: true,
            validation: [
              { type: 'min', value: 1 },
              { type: 'max', value: 20 }
            ]
          }
        ]
      };

      const formWithRangeError = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: {
            partySize: { type: 'max', message: 'Party size cannot exceed 20 people' }
          },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithRangeError);
      mockUseFormConfiguration.mockReturnValue({
        fields: configWithNumberField.formFields,
        validationRules: {},
        conditionalLogic: {}
      });

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithNumberField}
        />
      );

      expect(screen.getByText('Party size cannot exceed 20 people')).toBeTruthy();
    });
  });

  describe('Form Submission', () => {
    it('should call onSubmit with form data when valid', async () => {
      const mockFormData = {
        customerName: 'John Doe',
        serviceType: 'consultation',
        specialRequests: 'First time visit'
      };

      mockHandleSubmit.mockImplementation((callback) => {
        return () => callback(mockFormData);
      });

      render(<AdaptiveReservationForm {...defaultProps} />);

      const submitButton = screen.getByText('Book Reservation');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith(mockFormData);
      });
    });

    it('should not submit when form has validation errors', async () => {
      const formWithErrors = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: { customerName: { type: 'required', message: 'Required' } },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithErrors);

      render(<AdaptiveReservationForm {...defaultProps} />);

      const submitButton = screen.getByText('Book Reservation');
      fireEvent.press(submitButton);

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it('should disable submit button while form is invalid', () => {
      const formWithErrors = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: { customerName: { type: 'required', message: 'Required' } },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithErrors);

      render(<AdaptiveReservationForm {...defaultProps} />);

      const submitButton = screen.getByText('Book Reservation');
      expect(submitButton.props.disabled).toBe(true);
    });
  });

  describe('File Upload Support', () => {
    it('should render file upload fields when configured', () => {
      const configWithFileField: ServiceTypeConfig = {
        ...defaultServiceTypeConfig,
        formFields: [
          {
            fieldName: 'medicalRecords',
            fieldType: 'file',
            required: false,
            validation: [
              { type: 'fileType', value: ['pdf', 'jpg', 'png'] },
              { type: 'maxSize', value: 5242880 } // 5MB
            ]
          }
        ]
      };

      mockUseFormConfiguration.mockReturnValue({
        fields: configWithFileField.formFields,
        validationRules: {},
        conditionalLogic: {}
      });

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithFileField}
        />
      );

      expect(screen.getByText('Medical Records')).toBeTruthy();
      expect(screen.getByText('Choose File')).toBeTruthy();
    });

    it('should validate file types and sizes', async () => {
      const formWithFileError = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: {
            medicalRecords: { 
              type: 'fileType', 
              message: 'Only PDF, JPG, and PNG files are allowed' 
            }
          },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithFileError);

      const configWithFileField: ServiceTypeConfig = {
        ...defaultServiceTypeConfig,
        formFields: [
          {
            fieldName: 'medicalRecords',
            fieldType: 'file',
            required: false,
            validation: [
              { type: 'fileType', value: ['pdf', 'jpg', 'png'] }
            ]
          }
        ]
      };

      mockUseFormConfiguration.mockReturnValue({
        fields: configWithFileField.formFields,
        validationRules: {},
        conditionalLogic: {}
      });

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithFileField}
        />
      );

      expect(screen.getByText('Only PDF, JPG, and PNG files are allowed')).toBeTruthy();
    });
  });

  describe('Form State Management', () => {
    it('should populate form with initial data when provided', () => {
      const initialData = {
        customerName: 'Jane Doe',
        serviceType: 'therapy',
        specialRequests: 'Recurring appointment'
      };

      const formWithInitialData = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch.mockReturnValue(initialData),
        formState: { errors: {}, isValid: true },
        setValue: jest.fn(),
        getValues: jest.fn().mockReturnValue(initialData)
      };

      mockUseForm.mockReturnValue(formWithInitialData);

      render(
        <AdaptiveReservationForm
          {...defaultProps}
          initialData={initialData}
        />
      );

      expect(mockUseForm).toHaveBeenCalledWith({
        defaultValues: initialData
      });
    });

    it('should support partial save capability', async () => {
      const mockSavePartial = jest.fn();
      
      render(
        <AdaptiveReservationForm
          {...defaultProps}
          onPartialSave={mockSavePartial}
        />
      );

      // Simulate user typing and then losing focus (auto-save trigger)
      const customerNameField = screen.getByLabelText('Customer Name');
      fireEvent.changeText(customerNameField, 'John');
      fireEvent(customerNameField, 'blur');

      await waitFor(() => {
        expect(mockSavePartial).toHaveBeenCalled();
      });
    });

    it('should handle form state changes for conditional fields', () => {
      // Mock watch to simulate service type change
      const mockWatchValue = jest.fn()
        .mockReturnValueOnce({ serviceType: 'basic' })
        .mockReturnValueOnce({ serviceType: 'premium' });

      const formWithWatch = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatchValue,
        formState: { errors: {}, isValid: true },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithWatch);

      const configWithConditionalField: ServiceTypeConfig = {
        ...defaultServiceTypeConfig,
        formFields: [
          {
            fieldName: 'serviceType',
            fieldType: 'select',
            required: true,
            options: [
              { value: 'basic', label: 'Basic' },
              { value: 'premium', label: 'Premium' }
            ]
          },
          {
            fieldName: 'premiumFeatures',
            fieldType: 'checkbox',
            required: false,
            conditionalDisplay: {
              dependsOn: 'serviceType',
              showWhen: { equals: 'premium' }
            }
          }
        ]
      };

      mockUseFormConfiguration.mockReturnValue({
        fields: configWithConditionalField.formFields,
        validationRules: {},
        conditionalLogic: {
          premiumFeatures: {
            dependsOn: 'serviceType',
            showWhen: { equals: 'premium' }
          }
        }
      });

      const { rerender } = render(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithConditionalField}
        />
      );

      // Initially, premium features should not be visible
      expect(screen.queryByText('Premium Features')).toBeFalsy();

      // Re-render with premium selection
      rerender(
        <AdaptiveReservationForm
          {...defaultProps}
          serviceType={configWithConditionalField}
        />
      );

      // Now premium features should be visible
      expect(screen.getByText('Premium Features')).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      render(<AdaptiveReservationForm {...defaultProps} />);

      expect(screen.getByLabelText('Customer Name')).toBeTruthy();
      expect(screen.getByLabelText('Service Type')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Book Reservation' })).toBeTruthy();
    });

    it('should announce form errors to screen readers', async () => {
      const formWithErrors = {
        control: mockControl,
        handleSubmit: mockHandleSubmit,
        watch: mockWatch,
        formState: {
          errors: {
            customerName: { type: 'required', message: 'Customer name is required' }
          },
          isValid: false
        },
        setValue: jest.fn(),
        getValues: jest.fn()
      };

      mockUseForm.mockReturnValue(formWithErrors);

      render(<AdaptiveReservationForm {...defaultProps} />);

      const errorMessage = screen.getByText('Customer name is required');
      expect(errorMessage.props.accessibilityRole).toBe('alert');
    });
  });
});