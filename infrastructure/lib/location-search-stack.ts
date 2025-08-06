import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';

export interface LocationSearchStackProps extends cdk.StackProps {
  stage: 'dev' | 'staging' | 'prod';
  vpcId?: string;
  databaseClusterIdentifier?: string;
}

export class LocationSearchStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly databaseCluster: rds.DatabaseCluster;
  public readonly redisCluster: elasticache.CfnReplicationGroup;
  public readonly locationSearchFunction: lambda.Function;
  public readonly apiGateway: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: LocationSearchStackProps) {
    super(scope, id, props);

    const { stage } = props;

    // VPC Configuration
    this.vpc = props.vpcId 
      ? ec2.Vpc.fromLookup(this, 'ExistingVpc', { vpcId: props.vpcId })
      : new ec2.Vpc(this, 'LocationSearchVpc', {
          maxAzs: 3,
          natGateways: stage === 'prod' ? 3 : 1,
          subnetConfiguration: [
            {
              cidrMask: 24,
              name: 'Public',
              subnetType: ec2.SubnetType.PUBLIC,
            },
            {
              cidrMask: 24,
              name: 'Private',
              subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            {
              cidrMask: 28,
              name: 'Database',
              subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
            },
          ],
        });

    // Security Groups
    const databaseSecurityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for PostGIS database',
      allowAllOutbound: false,
    });

    const redisSecurityGroup = new ec2.SecurityGroup(this, 'RedisSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Redis cache cluster',
      allowAllOutbound: false,
    });

    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: this.vpc,
      description: 'Security group for Lambda functions',
    });

    // Allow Lambda to access database and Redis
    databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda access to PostgreSQL'
    );

    redisSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(6379),
      'Allow Lambda access to Redis'
    );

    // Database Subnet Group
    const dbSubnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: this.vpc,
      description: 'Subnet group for PostGIS database',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
    });

    // PostGIS Database Cluster (Aurora PostgreSQL)
    this.databaseCluster = new rds.DatabaseCluster(this, 'PostGISCluster', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      instanceProps: {
        instanceType: stage === 'prod' 
          ? ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.LARGE)
          : ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
        securityGroups: [databaseSecurityGroup],
      },
      instances: stage === 'prod' ? 2 : 1, // Multi-AZ for production
      defaultDatabaseName: 'buylocals',
      subnetGroup: dbSubnetGroup,
      backup: {
        retention: stage === 'prod' ? cdk.Duration.days(30) : cdk.Duration.days(7),
        preferredWindow: '03:00-04:00',
      },
      cloudwatchLogsExports: ['postgresql'],
      monitoringInterval: cdk.Duration.seconds(60),
      parameters: {
        // Optimize for spatial queries
        'shared_preload_libraries': 'postgis',
        'max_connections': stage === 'prod' ? '1000' : '200',
        'shared_buffers': stage === 'prod' ? '2GB' : '256MB',
        'effective_cache_size': stage === 'prod' ? '6GB' : '1GB',
        'work_mem': '16MB',
        'maintenance_work_mem': '256MB',
        'checkpoint_completion_target': '0.9',
        'wal_buffers': '16MB',
        'default_statistics_target': '100',
        'random_page_cost': '1.1',
        'effective_io_concurrency': '200',
        // PostGIS-specific optimizations
        'max_locks_per_transaction': '256',
      },
      scaling: stage === 'prod' ? {
        autoPause: cdk.Duration.minutes(10),
        minCapacity: rds.AuroraCapacityUnit.ACU_2,
        maxCapacity: rds.AuroraCapacityUnit.ACU_16,
      } : undefined,
    });

    // Redis Cache Subnet Group
    const cacheSubnetGroup = new elasticache.CfnSubnetGroup(this, 'CacheSubnetGroup', {
      description: 'Subnet group for Redis cache',
      subnetIds: this.vpc.privateSubnets.map(subnet => subnet.subnetId),
    });

    // Redis Replication Group for High Availability
    this.redisCluster = new elasticache.CfnReplicationGroup(this, 'RedisCluster', {
      description: 'Redis cluster for location search caching',
      replicationGroupDescription: 'High-performance caching for location-based queries',
      nodeType: stage === 'prod' ? 'cache.r6g.large' : 'cache.t3.micro',
      port: 6379,
      numCacheClusters: stage === 'prod' ? 3 : 1,
      engine: 'redis',
      engineVersion: '7.0',
      cacheSubnetGroupName: cacheSubnetGroup.ref,
      securityGroupIds: [redisSecurityGroup.securityGroupId],
      automaticFailoverEnabled: stage === 'prod',
      multiAzEnabled: stage === 'prod',
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      // Optimized for location search workload
      cacheParameterGroupName: this.createRedisParameterGroup().ref,
      preferredMaintenanceWindow: 'sun:03:00-sun:04:00',
      snapshotRetentionLimit: stage === 'prod' ? 7 : 1,
      snapshotWindow: '02:00-03:00',
      notificationTopicArn: undefined, // Add SNS topic if needed
    });

    // Lambda Layer for PostGIS and dependencies
    const postgisLayer = new lambda.LayerVersion(this, 'PostGISLayer', {
      code: lambda.Code.fromAsset('layers/postgis'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'PostGIS and geospatial libraries for Lambda',
    });

    // Location Search Lambda Function
    this.locationSearchFunction = new lambda.Function(this, 'LocationSearchFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'locationSearch.handler',
      code: lambda.Code.fromAsset('../apps/api/dist'),
      layers: [postgisLayer],
      vpc: this.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      timeout: cdk.Duration.seconds(30),
      memorySize: stage === 'prod' ? 1024 : 512,
      reservedConcurrentExecutions: stage === 'prod' ? 100 : 10,
      environment: {
        NODE_ENV: stage,
        DATABASE_URL: `postgresql://username:password@${this.databaseCluster.clusterEndpoint.hostname}:5432/buylocals`,
        REDIS_URL: `redis://${this.redisCluster.attrPrimaryEndPointAddress}:${this.redisCluster.attrPrimaryEndPointPort}`,
        CACHE_TTL: '300',
        MAX_SEARCH_RADIUS: '100',
        DEFAULT_SEARCH_LIMIT: '20',
      },
      logRetention: stage === 'prod' ? logs.RetentionDays.ONE_MONTH : logs.RetentionDays.ONE_WEEK,
      tracing: lambda.Tracing.ACTIVE,
      insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_229_0,
    });

    // API Gateway with performance optimizations
    this.apiGateway = new apigateway.RestApi(this, 'LocationSearchApi', {
      restApiName: `Buy Locals Location Search API - ${stage}`,
      description: 'High-performance location-based business search API',
      endpointConfiguration: {
        types: [apigateway.EndpointType.REGIONAL],
      },
      deployOptions: {
        stageName: stage,
        tracingEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.ERROR,
        dataTraceEnabled: false,
        metricsEnabled: true,
        cachingEnabled: stage === 'prod',
        cacheClusterEnabled: stage === 'prod',
        cacheClusterSize: stage === 'prod' ? '0.5' : undefined,
        cacheTtl: cdk.Duration.minutes(5),
        cacheKeyParameters: ['method.request.querystring.lat', 'method.request.querystring.lng'],
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // API Gateway Integration
    const locationSearchIntegration = new apigateway.LambdaIntegration(this.locationSearchFunction, {
      requestTemplates: { 'application/json': '{ "statusCode": "200" }' },
      proxy: true,
    });

    // Location search endpoint
    const businessesResource = this.apiGateway.root.addResource('businesses');
    const searchResource = businessesResource.addResource('search');
    const locationResource = searchResource.addResource('location');

    locationResource.addMethod('GET', locationSearchIntegration, {
      requestParameters: {
        'method.request.querystring.lat': true,
        'method.request.querystring.lng': true,
        'method.request.querystring.radius': false,
        'method.request.querystring.category': false,
      },
      methodResponses: [
        {
          statusCode: '200',
          responseParameters: {
            'method.response.header.X-Cache': true,
            'method.response.header.X-Execution-Time': true,
          },
        },
      ],
    });

    // Categories endpoint
    const categoriesResource = locationResource.addResource('categories');
    categoriesResource.addMethod('GET', locationSearchIntegration);

    // Popular areas endpoint
    const popularAreasResource = locationResource.addResource('popular-areas');
    popularAreasResource.addMethod('GET', locationSearchIntegration);

    // CloudWatch Alarms for Performance Monitoring
    this.createPerformanceAlarms(stage);

    // SSM Parameters for configuration
    this.createSSMParameters(stage);

    // Output important values
    new cdk.CfnOutput(this, 'DatabaseClusterEndpoint', {
      value: this.databaseCluster.clusterEndpoint.hostname,
      description: 'PostGIS database cluster endpoint',
    });

    new cdk.CfnOutput(this, 'RedisClusterEndpoint', {
      value: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis cluster primary endpoint',
    });

    new cdk.CfnOutput(this, 'ApiGatewayUrl', {
      value: this.apiGateway.url,
      description: 'API Gateway URL for location search',
    });

    new cdk.CfnOutput(this, 'LocationSearchFunctionArn', {
      value: this.locationSearchFunction.functionArn,
      description: 'Location search Lambda function ARN',
    });
  }

  private createRedisParameterGroup(): elasticache.CfnParameterGroup {
    return new elasticache.CfnParameterGroup(this, 'RedisParameterGroup', {
      cacheParameterGroupFamily: 'redis7.x',
      description: 'Parameter group optimized for location search caching',
      properties: {
        // Optimize for location search workload
        'maxmemory-policy': 'allkeys-lru',
        'timeout': '300',
        'tcp-keepalive': '60',
        'maxclients': '65000',
        // Enable Redis modules if needed
        'notify-keyspace-events': 'Ex',
      },
    });
  }

  private createPerformanceAlarms(stage: string): void {
    // Lambda performance alarms
    new cloudwatch.Alarm(this, 'LocationSearchLatencyAlarm', {
      metric: this.locationSearchFunction.metricDuration(),
      threshold: 1000, // 1 second threshold
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Location search function exceeding 1s response time',
    });

    new cloudwatch.Alarm(this, 'LocationSearchErrorAlarm', {
      metric: this.locationSearchFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Location search function error rate too high',
    });

    // Database performance alarms
    new cloudwatch.Alarm(this, 'DatabaseCPUAlarm', {
      metric: this.databaseCluster.metricCPUUtilization(),
      threshold: 80,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database CPU utilization too high',
    });

    new cloudwatch.Alarm(this, 'DatabaseConnectionsAlarm', {
      metric: this.databaseCluster.metricDatabaseConnections(),
      threshold: stage === 'prod' ? 800 : 160,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Database connection count too high',
    });

    // API Gateway performance alarms
    new cloudwatch.Alarm(this, 'ApiGateway4xxAlarm', {
      metric: this.apiGateway.metricClientError(),
      threshold: 10,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gateway 4xx error rate too high',
    });

    new cloudwatch.Alarm(this, 'ApiGateway5xxAlarm', {
      metric: this.apiGateway.metricServerError(),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'API Gateway 5xx error rate too high',
    });
  }

  private createSSMParameters(stage: string): void {
    new ssm.StringParameter(this, 'DatabaseEndpointParameter', {
      parameterName: `/buylocals/${stage}/database/endpoint`,
      stringValue: this.databaseCluster.clusterEndpoint.hostname,
      description: 'PostGIS database cluster endpoint',
    });

    new ssm.StringParameter(this, 'RedisEndpointParameter', {
      parameterName: `/buylocals/${stage}/redis/endpoint`,
      stringValue: this.redisCluster.attrPrimaryEndPointAddress,
      description: 'Redis cluster primary endpoint',
    });

    new ssm.StringParameter(this, 'ApiGatewayUrlParameter', {
      parameterName: `/buylocals/${stage}/api/url`,
      stringValue: this.apiGateway.url,
      description: 'API Gateway URL for location search',
    });
  }
}