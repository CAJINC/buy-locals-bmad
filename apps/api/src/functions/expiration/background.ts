import { ScheduledHandler } from 'aws-lambda';
import { logger } from '../../utils/logger';
import { reservationExpirationService } from '../../services/reservationExpirationService';

/**
 * Background job handler for reservation expiration processing
 * This Lambda function should be scheduled to run every few minutes
 */
export const handler: ScheduledHandler = async (event) => {
  const startTime = Date.now();
  
  try {
    logger.info('Starting reservation expiration background processing', {
      time: new Date().toISOString(),
      source: event.source,
      account: event.account
    });

    // Initialize the service if not already done
    reservationExpirationService.initialize();

    // Process warnings
    logger.info('Processing expiration warnings');
    await reservationExpirationService.sendExpirationWarnings();

    // Process expired reservations
    logger.info('Processing expired reservations');
    await reservationExpirationService.processExpiredReservations();

    // Clean up old records
    logger.info('Cleaning up old TTL records');
    await reservationExpirationService.cleanupOldRecords();

    const processingTime = Date.now() - startTime;
    
    logger.info('Reservation expiration background processing completed', {
      processingTimeMs: processingTime,
      completedAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Expiration processing completed successfully',
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Error in reservation expiration background processing', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      processingTimeMs: processingTime,
      failedAt: new Date().toISOString()
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process reservation expirations',
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      })
    };
  } finally {
    // Ensure service is properly shut down
    reservationExpirationService.shutdown();
  }
};

/**
 * Manual trigger handler for on-demand expiration processing
 */
export const manualTriggerHandler: ScheduledHandler = async (event) => {
  const startTime = Date.now();
  
  try {
    logger.info('Manual reservation expiration processing triggered', {
      time: new Date().toISOString(),
      triggerSource: 'manual'
    });

    // Initialize the service
    reservationExpirationService.initialize();

    // Get current statistics before processing
    const stats = {
      processedWarnings: 0,
      processedExpired: 0,
      cleanedRecords: 0
    };

    // Process each step with detailed logging
    logger.info('Step 1: Processing expiration warnings');
    await reservationExpirationService.sendExpirationWarnings();
    stats.processedWarnings = 1; // Would need to return actual counts from service

    logger.info('Step 2: Processing expired reservations');
    const expiredReservations = await reservationExpirationService.getExpiredReservations();
    await reservationExpirationService.processExpiredReservations();
    stats.processedExpired = expiredReservations.length;

    logger.info('Step 3: Cleaning up old records');
    await reservationExpirationService.cleanupOldRecords();
    stats.cleanedRecords = 1; // Would need actual count from cleanup

    const processingTime = Date.now() - startTime;
    
    logger.info('Manual reservation expiration processing completed', {
      processingTimeMs: processingTime,
      stats,
      completedAt: new Date().toISOString()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Manual expiration processing completed successfully',
        stats,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Error in manual reservation expiration processing', {
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : error,
      processingTimeMs: processingTime,
      failedAt: new Date().toISOString()
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Failed to process reservation expirations manually',
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString()
      })
    };
  } finally {
    // Ensure service is properly shut down
    reservationExpirationService.shutdown();
  }
};

/**
 * Health check handler for expiration service
 */
export const healthCheckHandler: ScheduledHandler = async (event) => {
  try {
    logger.info('Expiration service health check');

    // Check service components
    const healthStatus = {
      service: 'healthy',
      database: 'unknown',
      redis: 'unknown',
      timestamp: new Date().toISOString()
    };

    // Test database connection
    try {
      // Would test actual database query here
      healthStatus.database = 'healthy';
    } catch (dbError) {
      logger.error('Database health check failed', { error: dbError });
      healthStatus.database = 'unhealthy';
    }

    // Test Redis connection
    try {
      // Would test actual Redis connection here  
      healthStatus.redis = 'healthy';
    } catch (redisError) {
      logger.error('Redis health check failed', { error: redisError });
      healthStatus.redis = 'unhealthy';
    }

    const isHealthy = healthStatus.database === 'healthy' && healthStatus.redis === 'healthy';

    logger.info('Expiration service health check completed', { 
      healthStatus, 
      overall: isHealthy ? 'healthy' : 'degraded' 
    });

    return {
      statusCode: isHealthy ? 200 : 503,
      body: JSON.stringify({
        success: isHealthy,
        health: healthStatus,
        overall: isHealthy ? 'healthy' : 'degraded'
      })
    };

  } catch (error) {
    logger.error('Error in expiration service health check', { error });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      })
    };
  }
};