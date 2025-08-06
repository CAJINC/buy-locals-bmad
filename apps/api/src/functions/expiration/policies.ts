import { APIGatewayProxyHandler } from 'aws-lambda';
import { createResponse, parseJSON } from '../../utils/apiResponse';
import { validateRequestBody } from '../../utils/validation';
import { logger } from '../../utils/logger';
import { ExpirationPolicy, reservationExpirationService } from '../../services/reservationExpirationService';
import { z } from 'zod';

const createExpirationPolicySchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(100),
  defaultTTLMinutes: z.number().min(5).max(10080), // 5 minutes to 7 days
  warningIntervals: z.array(z.number().min(1).max(1440)).min(0).max(5), // Up to 5 warning intervals
  gracePeriodMinutes: z.number().min(0).max(1440), // Up to 24 hours
  autoCleanup: z.boolean(),
  notificationSettings: z.object({
    sendWarnings: z.boolean(),
    sendExpiredNotices: z.boolean(),
    sendBusinessNotifications: z.boolean()
  }),
  serviceTypeIds: z.array(z.string().uuid()).optional(),
  isActive: z.boolean().default(true)
});

const updateExpirationPolicySchema = createExpirationPolicySchema.partial().omit({ businessId: true });

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { httpMethod, pathParameters, queryStringParameters } = event;
    const businessId = pathParameters?.businessId;

    if (!businessId) {
      return createResponse(400, { 
        success: false, 
        error: 'Business ID is required' 
      });
    }

    switch (httpMethod) {
      case 'GET':
        return await handleGetExpirationPolicies(businessId, queryStringParameters);
      
      case 'POST':
        return await handleCreateExpirationPolicy(businessId, event.body);
      
      case 'PUT':
        const policyId = pathParameters?.policyId;
        if (!policyId) {
          return createResponse(400, { 
            success: false, 
            error: 'Policy ID is required for updates' 
          });
        }
        return await handleUpdateExpirationPolicy(businessId, policyId, event.body);
      
      case 'DELETE':
        const deletePolicyId = pathParameters?.policyId;
        if (!deletePolicyId) {
          return createResponse(400, { 
            success: false, 
            error: 'Policy ID is required for deletion' 
          });
        }
        return await handleDeleteExpirationPolicy(businessId, deletePolicyId);

      default:
        return createResponse(405, { 
          success: false, 
          error: 'Method not allowed' 
        });
    }
  } catch (error) {
    logger.error('Error in expiration policies handler', { error, event });
    return createResponse(500, { 
      success: false, 
      error: 'Internal server error' 
    });
  }
};

/**
 * Get expiration policies for a business
 */
async function handleGetExpirationPolicies(
  businessId: string, 
  queryParams: any
): Promise<any> {
  try {
    const includeAnalytics = queryParams?.includeAnalytics === 'true';
    
    // Get all policies for the business
    const policies = await reservationExpirationService.getBusinessExpirationPolicies(businessId);
    
    const responseData: any = {
      success: true,
      data: {
        policies
      }
    };

    // Include analytics if requested
    if (includeAnalytics && policies.length > 0) {
      const analytics = await reservationExpirationService.getExpirationAnalytics(businessId);
      responseData.data.analytics = analytics;
    }

    return createResponse(200, responseData);
  } catch (error) {
    logger.error('Error getting expiration policies', { error, businessId });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to retrieve expiration policies' 
    });
  }
}

/**
 * Create new expiration policy
 */
async function handleCreateExpirationPolicy(
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

    // Validate request body
    const validationResult = validateRequestBody(body, createExpirationPolicySchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    const policyData = { ...validationResult.data, businessId };

    // Check for duplicate policy names
    const existingPolicies = await reservationExpirationService.getBusinessExpirationPolicies(businessId);
    const duplicateName = existingPolicies.find(p => 
      p.name.toLowerCase() === policyData.name.toLowerCase()
    );
    
    if (duplicateName) {
      return createResponse(409, {
        success: false,
        error: 'A policy with this name already exists'
      });
    }

    // Validate warning intervals
    if (policyData.warningIntervals.some(interval => interval >= policyData.defaultTTLMinutes)) {
      return createResponse(400, {
        success: false,
        error: 'Warning intervals must be less than the default TTL'
      });
    }

    // Create the policy
    const policy = await reservationExpirationService.createExpirationPolicy(policyData);

    logger.info('Expiration policy created', {
      policyId: policy.id,
      businessId,
      name: policy.name
    });

    return createResponse(201, {
      success: true,
      data: { policy }
    });
  } catch (error) {
    logger.error('Error creating expiration policy', { error, businessId });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to create expiration policy' 
    });
  }
}

/**
 * Update expiration policy
 */
async function handleUpdateExpirationPolicy(
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

    // Validate request body
    const validationResult = validateRequestBody(body, updateExpirationPolicySchema);
    if (!validationResult.success) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validationResult.errors
      });
    }

    // Check if policy exists and belongs to business
    const existingPolicy = await reservationExpirationService.getExpirationPolicy(policyId);
    if (!existingPolicy || existingPolicy.businessId !== businessId) {
      return createResponse(404, {
        success: false,
        error: 'Expiration policy not found'
      });
    }

    // Check for duplicate names if name is being updated
    if (validationResult.data.name && validationResult.data.name !== existingPolicy.name) {
      const policies = await reservationExpirationService.getBusinessExpirationPolicies(businessId);
      const duplicateName = policies.find(p => 
        p.id !== policyId && p.name.toLowerCase() === validationResult.data.name!.toLowerCase()
      );
      
      if (duplicateName) {
        return createResponse(409, {
          success: false,
          error: 'A policy with this name already exists'
        });
      }
    }

    // Validate warning intervals if provided
    const newTTL = validationResult.data.defaultTTLMinutes || existingPolicy.defaultTTLMinutes;
    const newIntervals = validationResult.data.warningIntervals || existingPolicy.warningIntervals;
    
    if (newIntervals.some(interval => interval >= newTTL)) {
      return createResponse(400, {
        success: false,
        error: 'Warning intervals must be less than the default TTL'
      });
    }

    // Update the policy
    const updatedPolicy = await reservationExpirationService.updateExpirationPolicy(
      policyId, 
      validationResult.data
    );

    logger.info('Expiration policy updated', {
      policyId,
      businessId,
      changes: Object.keys(validationResult.data)
    });

    return createResponse(200, {
      success: true,
      data: { policy: updatedPolicy }
    });
  } catch (error) {
    logger.error('Error updating expiration policy', { error, businessId, policyId });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to update expiration policy' 
    });
  }
}

/**
 * Delete (deactivate) expiration policy
 */
async function handleDeleteExpirationPolicy(
  businessId: string, 
  policyId: string
): Promise<any> {
  try {
    // Check if policy exists and belongs to business
    const existingPolicy = await reservationExpirationService.getExpirationPolicy(policyId);
    if (!existingPolicy || existingPolicy.businessId !== businessId) {
      return createResponse(404, {
        success: false,
        error: 'Expiration policy not found'
      });
    }

    // Check if policy is in use
    const policiesInUse = await reservationExpirationService.getPoliciesInUse(businessId);
    if (policiesInUse.includes(policyId)) {
      return createResponse(409, {
        success: false,
        error: 'Cannot delete policy that is currently in use by active reservations'
      });
    }

    // Deactivate the policy (soft delete)
    await reservationExpirationService.deactivateExpirationPolicy(policyId);

    logger.info('Expiration policy deleted', {
      policyId,
      businessId
    });

    return createResponse(200, {
      success: true,
      message: 'Expiration policy deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting expiration policy', { error, businessId, policyId });
    return createResponse(500, { 
      success: false, 
      error: 'Failed to delete expiration policy' 
    });
  }
}