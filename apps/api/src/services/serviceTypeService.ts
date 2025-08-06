import { db } from '../utils/database';
import { logger } from '../utils/logger';
import type { 
  BookingRules, 
  CreateServiceTypeInput, 
  FormFieldConfig,
  PricingModel,
  SERVICE_TYPE_TEMPLATES,
  ServiceRequirements,
  ServiceTypeConfig,
  ServiceTypeTemplate,
  UpdateServiceTypeInput
} from '../types/ServiceType';

export class ServiceTypeService {
  private readonly redis = db.redis;

  /**
   * Create a new service type configuration
   */
  async createServiceType(input: CreateServiceTypeInput): Promise<ServiceTypeConfig> {
    try {
      const serviceTypeData = {
        business_id: input.businessId,
        name: input.name,
        category: input.category,
        description: input.description || '',
        form_config: JSON.stringify({
          formFields: input.formFields || []
        }),
        booking_rules: JSON.stringify(this.getDefaultBookingRules(input.bookingRules)),
        pricing_config: JSON.stringify(this.getDefaultPricingModel(input.pricingModel)),
        requirements: JSON.stringify(input.requirements || {}),
        is_active: true
      };

      const [serviceType] = await db('service_types')
        .insert(serviceTypeData)
        .returning('*');

      logger.info('Service type created', {
        serviceTypeId: serviceType.id,
        businessId: input.businessId,
        name: input.name,
        category: input.category
      });

      return this.transformToServiceTypeConfig(serviceType);
    } catch (error) {
      logger.error('Error creating service type', { error, input });
      throw new Error('Failed to create service type');
    }
  }

  /**
   * Create service type from template
   */
  async createFromTemplate(
    businessId: string, 
    templateId: string,
    customizations?: Partial<CreateServiceTypeInput>
  ): Promise<ServiceTypeConfig> {
    const template = SERVICE_TYPE_TEMPLATES[templateId];
    
    if (!template) {
      throw new Error(`Service type template '${templateId}' not found`);
    }

    const input: CreateServiceTypeInput = {
      businessId,
      name: customizations?.name || template.name,
      category: template.category,
      description: customizations?.description || template.description,
      formFields: this.mergeFormFields(template.defaultFormFields, customizations?.formFields),
      bookingRules: { ...template.defaultBookingRules, ...customizations?.bookingRules },
      pricingModel: { ...template.defaultPricingModel, ...customizations?.pricingModel },
      requirements: { ...template.defaultRequirements, ...customizations?.requirements }
    };

    return await this.createServiceType(input);
  }

  /**
   * Update service type configuration
   */
  async updateServiceType(
    serviceTypeId: string, 
    updates: UpdateServiceTypeInput
  ): Promise<ServiceTypeConfig> {
    try {
      const existing = await this.getServiceType(serviceTypeId);
      if (!existing) {
        throw new Error('Service type not found');
      }

      const updateData: Record<string, unknown> = {
        updated_at: new Date()
      };

      if (updates.name) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
      
      if (updates.formFields) {
        updateData.form_config = JSON.stringify({
          formFields: updates.formFields
        });
      }
      
      if (updates.bookingRules) {
        updateData.booking_rules = JSON.stringify({
          ...existing.bookingRules,
          ...updates.bookingRules
        });
      }
      
      if (updates.pricingModel) {
        updateData.pricing_config = JSON.stringify({
          ...existing.pricingModel,
          ...updates.pricingModel
        });
      }
      
      if (updates.requirements) {
        updateData.requirements = JSON.stringify({
          ...existing.requirements,
          ...updates.requirements
        });
      }

      await db('service_types')
        .where('id', serviceTypeId)
        .update(updateData);

      // Clear cache
      await this.clearServiceTypeCache(serviceTypeId);

      logger.info('Service type updated', {
        serviceTypeId,
        updates: Object.keys(updates)
      });

      return await this.getServiceType(serviceTypeId) as ServiceTypeConfig;
    } catch (error) {
      logger.error('Error updating service type', { error, serviceTypeId, updates });
      throw new Error('Failed to update service type');
    }
  }

  /**
   * Get service type by ID
   */
  async getServiceType(serviceTypeId: string): Promise<ServiceTypeConfig | null> {
    try {
      // Check cache first
      const cacheKey = `service_type:${serviceTypeId}`;
      const cached = await this.redis?.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const serviceType = await db('service_types')
        .where('id', serviceTypeId)
        .where('is_active', true)
        .first();

      if (!serviceType) {
        return null;
      }

      const result = this.transformToServiceTypeConfig(serviceType);

      // Cache for 30 minutes
      await this.redis?.setEx(cacheKey, 1800, JSON.stringify(result));

      return result;
    } catch (error) {
      logger.error('Error getting service type', { error, serviceTypeId });
      return null;
    }
  }

  /**
   * Get all service types for a business
   */
  async getBusinessServiceTypes(
    businessId: string,
    filters?: {
      category?: string;
      isActive?: boolean;
      includeInactive?: boolean;
    }
  ): Promise<ServiceTypeConfig[]> {
    try {
      let query = db('service_types')
        .where('business_id', businessId);

      if (filters?.category) {
        query = query.where('category', filters.category);
      }

      if (filters?.isActive !== undefined || !filters?.includeInactive) {
        query = query.where('is_active', filters?.isActive ?? true);
      }

      const serviceTypes = await query.orderBy('name');

      return serviceTypes.map(st => this.transformToServiceTypeConfig(st));
    } catch (error) {
      logger.error('Error getting business service types', { error, businessId, filters });
      return [];
    }
  }

  /**
   * Delete service type (soft delete)
   */
  async deleteServiceType(serviceTypeId: string): Promise<boolean> {
    try {
      const updated = await db('service_types')
        .where('id', serviceTypeId)
        .update({
          is_active: false,
          updated_at: new Date()
        });

      if (updated > 0) {
        await this.clearServiceTypeCache(serviceTypeId);
        logger.info('Service type deleted (soft)', { serviceTypeId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error deleting service type', { error, serviceTypeId });
      return false;
    }
  }

  /**
   * Get available service type templates
   */
  getAvailableTemplates(): Record<string, ServiceTypeTemplate> {
    return SERVICE_TYPE_TEMPLATES;
  }

  /**
   * Calculate service price based on configuration and inputs
   */
  async calculateServicePrice(
    serviceTypeId: string, 
    formData: Record<string, unknown>
  ): Promise<{
    basePrice: number;
    modifiers: Array<{ name: string; amount: number; type: string }>;
    addOns: Array<{ name: string; price: number; quantity: number }>;
    discounts: Array<{ name: string; amount: number; type: string }>;
    totalPrice: number;
  }> {
    const serviceType = await this.getServiceType(serviceTypeId);
    
    if (!serviceType) {
      throw new Error('Service type not found');
    }

    const pricing = serviceType.pricingModel;
    let totalPrice = pricing.basePrice;
    const appliedModifiers: Array<{ name: string; amount: number; type: string }> = [];
    const appliedAddOns: Array<{ name: string; price: number; quantity: number }> = [];
    const appliedDiscounts: Array<{ name: string; amount: number; type: string }> = [];

    // Apply price modifiers
    if (pricing.priceModifiers) {
      for (const modifier of pricing.priceModifiers) {
        if (this.evaluatePriceCondition(modifier.condition, formData)) {
          let modifierAmount = 0;
          
          switch (modifier.type) {
            case 'percentage':
              modifierAmount = (totalPrice * modifier.value) / 100;
              break;
            case 'fixed':
              modifierAmount = modifier.value;
              break;
            case 'multiplier':
              modifierAmount = totalPrice * modifier.value - totalPrice;
              break;
          }

          totalPrice += modifierAmount;
          appliedModifiers.push({
            name: modifier.name,
            amount: modifierAmount,
            type: modifier.type
          });
        }
      }
    }

    // Apply add-ons
    if (pricing.addOns) {
      for (const addOn of pricing.addOns) {
        const addOnQuantity = formData[`addon_${addOn.id}`] as number;
        if (addOnQuantity && addOnQuantity > 0) {
          const addOnTotal = addOn.price * addOnQuantity;
          totalPrice += addOnTotal;
          appliedAddOns.push({
            name: addOn.name,
            price: addOn.price,
            quantity: addOnQuantity
          });
        }
      }
    }

    // Apply discounts
    if (pricing.discountRules) {
      for (const discount of pricing.discountRules) {
        if (this.evaluateDiscountConditions(discount.conditions, formData)) {
          let discountAmount = 0;
          
          switch (discount.type) {
            case 'percentage':
              discountAmount = (totalPrice * discount.value) / 100;
              break;
            case 'fixed':
              discountAmount = discount.value;
              break;
          }

          totalPrice -= discountAmount;
          appliedDiscounts.push({
            name: discount.name,
            amount: discountAmount,
            type: discount.type
          });
        }
      }
    }

    // Ensure price doesn't go below 0
    totalPrice = Math.max(0, totalPrice);

    return {
      basePrice: pricing.basePrice,
      modifiers: appliedModifiers,
      addOns: appliedAddOns,
      discounts: appliedDiscounts,
      totalPrice
    };
  }

  private transformToServiceTypeConfig(dbRecord: any): ServiceTypeConfig {
    const formConfig = dbRecord.form_config ? JSON.parse(dbRecord.form_config) : { formFields: [] };
    const bookingRules = dbRecord.booking_rules ? JSON.parse(dbRecord.booking_rules) : {};
    const pricingConfig = dbRecord.pricing_config ? JSON.parse(dbRecord.pricing_config) : {};
    const requirements = dbRecord.requirements ? JSON.parse(dbRecord.requirements) : {};

    return {
      id: dbRecord.id,
      businessId: dbRecord.business_id,
      name: dbRecord.name,
      category: dbRecord.category,
      description: dbRecord.description,
      formFields: formConfig.formFields || [],
      bookingRules,
      pricingModel: pricingConfig,
      requirements,
      isActive: dbRecord.is_active,
      createdAt: new Date(dbRecord.created_at),
      updatedAt: new Date(dbRecord.updated_at)
    };
  }

  private getDefaultBookingRules(rules?: Partial<BookingRules>): BookingRules {
    return {
      duration: 60,
      bufferTime: 15,
      advanceBookingDays: 30,
      minimumNotice: 120,
      allowMultiDay: false,
      recurringAvailable: false,
      cancellationPolicy: {
        allowCancellation: true,
        cancellationDeadline: 24,
        cancellationFee: 0,
        refundPolicy: 'full'
      },
      modificationPolicy: {
        allowModification: true,
        modificationDeadline: 12,
        modificationFee: 0,
        allowedChanges: [],
        requiresApproval: false,
        maxModifications: 3
      },
      ...rules
    };
  }

  private getDefaultPricingModel(pricing?: Partial<PricingModel>): PricingModel {
    return {
      basePrice: 0,
      currency: 'USD',
      pricingType: 'fixed',
      ...pricing
    };
  }

  private mergeFormFields(
    templateFields: Omit<FormFieldConfig, 'id'>[],
    customFields?: Partial<FormFieldConfig>[]
  ): FormFieldConfig[] {
    const result: FormFieldConfig[] = templateFields.map((field, index) => ({
      ...field,
      id: `field_${index + 1}`
    }));

    if (customFields) {
      customFields.forEach((customField, index) => {
        if (customField.fieldName) {
          const existingIndex = result.findIndex(f => f.fieldName === customField.fieldName);
          if (existingIndex >= 0) {
            result[existingIndex] = { ...result[existingIndex], ...customField } as FormFieldConfig;
          } else {
            result.push({
              ...customField,
              id: customField.id || `custom_${index + 1}`
            } as FormFieldConfig);
          }
        }
      });
    }

    return result.sort((a, b) => a.order - b.order);
  }

  private evaluatePriceCondition(condition: any, formData: Record<string, unknown>): boolean {
    const fieldValue = formData[condition.field];
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'contains':
        return String(fieldValue).includes(String(condition.value));
      case 'greaterThan':
        return Number(fieldValue) > Number(condition.value);
      case 'lessThan':
        return Number(fieldValue) < Number(condition.value);
      default:
        return false;
    }
  }

  private evaluateDiscountConditions(conditions: any[], formData: Record<string, unknown>): boolean {
    return conditions.every(condition => this.evaluatePriceCondition(condition, formData));
  }

  private async clearServiceTypeCache(serviceTypeId: string): Promise<void> {
    const cacheKey = `service_type:${serviceTypeId}`;
    await this.redis?.del(cacheKey);
  }
}

export const serviceTypeService = new ServiceTypeService();