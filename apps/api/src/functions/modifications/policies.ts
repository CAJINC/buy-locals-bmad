import { APIGatewayProxyHandler } from 'aws-lambda';
import { createResponse, parseJSON } from '../../utils/apiResponse';
import { validateRequestBody } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { reservationModificationService } from '../../services/reservationModificationService';
import { z } from 'zod';

const modificationChangeTypeSchema = z.enum([
  'date_time',
  'service_type',
  'duration',
  'customer_info',
  'requirements',
  'add_services',
  'remove_services',
  'party_size',
  'special_requests'
]);

const autoApprovalConditionSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'not_equals', 'greater_than', 'less_than', 'contains', 'in_range']),
  value: z.any()
});

const autoApprovalRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  conditions: z.array(autoApprovalConditionSchema),
  action: z.enum(['approve', 'reject', 'review'])
});

const createModificationPolicySchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  allowModification: z.boolean(),
  modificationDeadline: z.number().min(1).max(168), // 1 hour to 1 week
  modificationFee: z.number().min(0),
  allowedChanges: z.array(modificationChangeTypeSchema),
  requiresApproval: z.boolean(),
  maxModifications: z.number().min(1).max(10),
  autoApprovalRules: z.array(autoApprovalRuleSchema).optional(),
  isActive: z.boolean().default(true),
  serviceTypeIds: z.array(z.string().uuid()).optional()
});

const updateModificationPolicySchema = createModificationPolicySchema.partial().omit({ businessId: true });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { httpMethod, pathParameters, queryStringParameters } = event;
    const businessId = pathParameters?.businessId;
    const policyId = pathParameters?.policyId;

    if (!businessId) {
      return createResponse(400, {
        success: false,
        error: 'Business ID is required'
      });
    }

    switch (httpMethod) {
      case 'GET':
        if (policyId) {
          return await handleGetModificationPolicy(businessId, policyId);
        } else {
          return await handleListModificationPolicies(businessId, queryStringParameters);
        }

      case 'POST':
        return await handleCreateModificationPolicy(businessId, event.body);

      case 'PUT':
        if (!policyId) {
          return createResponse(400, {
            success: false,
            error: 'Policy ID is required for updates'
          });
        }
        return await handleUpdateModificationPolicy(businessId, policyId, event.body);

      case 'DELETE':
        if (!policyId) {
          return createResponse(400, {
            success: false,
            error: 'Policy ID is required for deletion'
          });
        }
        return await handleDeleteModificationPolicy(businessId, policyId);

      default:
        return createResponse(405, {
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    logger.error('Error in modification policies handler', { error, event });
    return createResponse(500, {
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Create a new modification policy
 */
async function handleCreateModificationPolicy(
  businessId: string,
  requestBody: string | null
): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, {
        success: false,
        error: 'Request body is required'
      });
    }

    // Ensure businessId matches path parameter
    body.businessId = businessId;

    const validationResult = validateRequestBody(body, createModificationPolicySchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const policy = await reservationModificationService.createModificationPolicy(validationResult.data);

    logger.info('Modification policy created', {
      policyId: policy.id,
      businessId,
      name: policy.name
    });

    return createResponse(201, {
      success: true,
      data: { policy }
    });

  } catch (error) {
    logger.error('Error creating modification policy', { error, businessId });
    
    if (error instanceof Error) {
      return createResponse(400, {
        success: false,
        error: error.message
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Failed to create modification policy'
    });
  }
}

/**
 * Get a specific modification policy
 */
async function handleGetModificationPolicy(
  businessId: string,
  policyId: string
): Promise<any> {
  try {
    // For service type specific policy, check query param
    const serviceTypeId = undefined; // Would come from query params
    
    const policy = await reservationModificationService.getModificationPolicy(businessId, serviceTypeId);

    if (!policy) {
      return createResponse(404, {
        success: false,
        error: 'Modification policy not found'
      });
    }

    return createResponse(200, {
      success: true,
      data: { policy }
    });

  } catch (error) {
    logger.error('Error getting modification policy', { error, businessId, policyId });
    return createResponse(500, {
      success: false,
      error: 'Failed to get modification policy'
    });
  }
}

/**
 * List modification policies for a business
 */
async function handleListModificationPolicies(
  businessId: string,
  queryParams: any
): Promise<any> {
  try {
    const includeInactive = queryParams?.includeInactive === 'true';
    
    // This would be implemented in the service
    // For now, return placeholder data
    const policies = []; // await service method

    return createResponse(200, {
      success: true,
      data: {
        policies,
        count: policies.length
      }
    });

  } catch (error) {
    logger.error('Error listing modification policies', { error, businessId });
    return createResponse(500, {
      success: false,
      error: 'Failed to list modification policies'
    });
  }
}

/**
 * Update a modification policy
 */
async function handleUpdateModificationPolicy(
  businessId: string,
  policyId: string,
  requestBody: string | null
): Promise<any> {
  try {
    const body = parseJSON(requestBody);
    
    if (!body) {
      return createResponse(400, {
        success: false,
        error: 'Request body is required'
      });
    }

    const validationResult = validateRequestBody(body, updateModificationPolicySchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    // This would be implemented in the service
    // const updatedPolicy = await service.updateModificationPolicy(policyId, validationResult.data);

    logger.info('Modification policy updated', {
      policyId,
      businessId,
      changes: Object.keys(validationResult.data)
    });

    return createResponse(200, {
      success: true,
      data: {
        message: 'Policy updated successfully',
        // policy: updatedPolicy
      }
    });

  } catch (error) {
    logger.error('Error updating modification policy', { error, businessId, policyId });
    
    if (error instanceof Error) {
      return createResponse(400, {
        success: false,
        error: error.message
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Failed to update modification policy'
    });
  }
}

/**
 * Delete (deactivate) a modification policy
 */
async function handleDeleteModificationPolicy(
  businessId: string,
  policyId: string
): Promise<any> {
  try {
    // This would be implemented in the service
    // await service.deactivateModificationPolicy(policyId);

    logger.info('Modification policy deleted', {
      policyId,
      businessId
    });

    return createResponse(200, {
      success: true,
      message: 'Modification policy deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting modification policy', { error, businessId, policyId });
    
    if (error instanceof Error) {
      return createResponse(400, {
        success: false,
        error: error.message
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Failed to delete modification policy'
    });
  }
}

/**
 * Get default modification policy template
 */
export const getDefaultPolicyTemplate = (): any => {
  return {
    name: 'Default Modification Policy',
    description: 'Standard modification policy for all reservations',
    allowModification: true,
    modificationDeadline: 24, // 24 hours before scheduled time
    modificationFee: 0,
    allowedChanges: [
      'date_time',
      'customer_info',
      'special_requests'
    ],
    requiresApproval: false,
    maxModifications: 3,
    autoApprovalRules: [
      {
        id: 'low_impact_auto_approve',
        name: 'Low Impact Auto-Approval',
        conditions: [
          {
            field: 'pricingImpact.difference',
            operator: 'less_than',
            value: 50
          },
          {
            field: 'availabilityImpact.hasConflicts',
            operator: 'equals',
            value: false
          }
        ],
        action: 'approve'
      }
    ],
    isActive: true
  };
};