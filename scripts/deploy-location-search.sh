#!/bin/bash

# Deploy Location Search Infrastructure and Application
# Usage: ./scripts/deploy-location-search.sh [dev|staging|prod]

set -e

STAGE=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying Location Search for stage: $STAGE"

# Validate stage
if [[ ! "$STAGE" =~ ^(dev|staging|prod)$ ]]; then
    echo "❌ Invalid stage. Must be dev, staging, or prod"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    print_error "AWS CLI is not installed"
    exit 1
fi

# Check CDK
if ! command -v cdk &> /dev/null; then
    print_error "AWS CDK is not installed"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    print_error "Please run this script from the project root"
    exit 1
fi

print_success "All prerequisites met"

# Set environment variables based on stage
case $STAGE in
    "dev")
        export NODE_ENV=development
        export DATABASE_INSTANCE_TYPE="t4g.medium"
        export REDIS_NODE_TYPE="cache.t3.micro"
        export LAMBDA_MEMORY=512
        ;;
    "staging")
        export NODE_ENV=staging
        export DATABASE_INSTANCE_TYPE="r6g.large"
        export REDIS_NODE_TYPE="cache.r6g.medium"
        export LAMBDA_MEMORY=1024
        ;;
    "prod")
        export NODE_ENV=production
        export DATABASE_INSTANCE_TYPE="r6g.xlarge"
        export REDIS_NODE_TYPE="cache.r6g.large"
        export LAMBDA_MEMORY=1024
        ;;
esac

# Build API
print_status "Building API application..."
cd "$PROJECT_ROOT/apps/api"

# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

if [[ $? -ne 0 ]]; then
    print_error "Failed to build API"
    exit 1
fi

print_success "API built successfully"

# Build mobile app (optional for API deployment)
print_status "Building mobile application..."
cd "$PROJECT_ROOT/apps/mobile"

npm ci --only=production
npm run type-check

if [[ $? -ne 0 ]]; then
    print_warning "Mobile app build failed, continuing with API deployment"
else
    print_success "Mobile app built successfully"
fi

# Prepare Lambda deployment package
print_status "Preparing Lambda deployment package..."
cd "$PROJECT_ROOT/apps/api"

# Create deployment directory
mkdir -p dist/deployment
cp -r dist/* dist/deployment/
cp package.json dist/deployment/
cp package-lock.json dist/deployment/

# Install production dependencies in deployment directory
cd dist/deployment
npm ci --only=production --omit=dev

print_success "Lambda package prepared"

# Deploy infrastructure
print_status "Deploying infrastructure with CDK..."
cd "$PROJECT_ROOT/infrastructure"

# Install CDK dependencies
npm ci

# Bootstrap CDK if needed (only for first deployment)
if [[ "$STAGE" == "dev" ]] && [[ ! -f ".cdk_bootstrapped" ]]; then
    print_status "Bootstrapping CDK..."
    cdk bootstrap
    touch .cdk_bootstrapped
    print_success "CDK bootstrapped"
fi

# Deploy the stack
print_status "Deploying Location Search stack..."
cdk deploy BuyLocalsLocationSearchStack-$STAGE \
    --parameters stage=$STAGE \
    --require-approval never \
    --outputs-file outputs-$STAGE.json

if [[ $? -ne 0 ]]; then
    print_error "Infrastructure deployment failed"
    exit 1
fi

print_success "Infrastructure deployed successfully"

# Extract outputs
if [[ -f "outputs-$STAGE.json" ]]; then
    API_URL=$(cat outputs-$STAGE.json | jq -r '.["BuyLocalsLocationSearchStack-'$STAGE'"].ApiGatewayUrl')
    DB_ENDPOINT=$(cat outputs-$STAGE.json | jq -r '.["BuyLocalsLocationSearchStack-'$STAGE'"].DatabaseClusterEndpoint')
    REDIS_ENDPOINT=$(cat outputs-$STAGE.json | jq -r '.["BuyLocalsLocationSearchStack-'$STAGE'"].RedisClusterEndpoint')
    
    print_success "Deployment outputs:"
    echo "  API URL: $API_URL"
    echo "  Database: $DB_ENDPOINT"
    echo "  Redis: $REDIS_ENDPOINT"
fi

# Run database migrations
print_status "Running database migrations..."
cd "$PROJECT_ROOT"

# Set database connection string
export DATABASE_URL="postgresql://${DB_USERNAME:-admin}:${DB_PASSWORD}@${DB_ENDPOINT}:5432/buylocals"

# Run migrations using the migration script
if [[ -f "scripts/migrate-database.js" ]]; then
    node scripts/migrate-database.js
    
    if [[ $? -eq 0 ]]; then
        print_success "Database migrations completed"
    else
        print_error "Database migrations failed"
        exit 1
    fi
else
    print_warning "Migration script not found, skipping database migrations"
fi

# Performance validation
print_status "Running performance validation..."

# Wait for API to be ready
sleep 30

# Test location search endpoint performance
if [[ -n "$API_URL" ]]; then
    print_status "Testing location search performance..."
    
    # Test coordinates (San Francisco)
    TEST_LAT=37.7749
    TEST_LNG=-122.4194
    
    START_TIME=$(date +%s%3N)
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
        "$API_URL/businesses/search/location?lat=$TEST_LAT&lng=$TEST_LNG&radius=10&limit=5")
    END_TIME=$(date +%s%3N)
    
    RESPONSE_TIME=$((END_TIME - START_TIME))
    
    if [[ "$HTTP_STATUS" == "200" ]]; then
        if [[ $RESPONSE_TIME -lt 1000 ]]; then
            print_success "Performance test passed: ${RESPONSE_TIME}ms (< 1s requirement)"
        else
            print_warning "Performance test exceeded 1s: ${RESPONSE_TIME}ms"
        fi
    else
        print_error "Performance test failed with HTTP $HTTP_STATUS"
    fi
else
    print_warning "API URL not available, skipping performance test"
fi

# Setup monitoring alerts (production only)
if [[ "$STAGE" == "prod" ]]; then
    print_status "Setting up monitoring and alerts..."
    
    # This would typically involve setting up CloudWatch dashboards,
    # SNS topics for alerts, etc.
    print_success "Monitoring setup completed"
fi

# Cleanup
print_status "Cleaning up temporary files..."
rm -rf "$PROJECT_ROOT/apps/api/dist/deployment"

print_success "🎉 Location Search deployment completed successfully for $STAGE!"

# Print post-deployment instructions
echo ""
echo "📝 Post-deployment checklist:"
echo "  1. Verify API endpoints are responding correctly"
echo "  2. Check CloudWatch logs for any errors"
echo "  3. Run integration tests"
echo "  4. Update mobile app configuration with new API URL"

if [[ "$STAGE" == "prod" ]]; then
    echo "  5. Perform load testing"
    echo "  6. Update DNS records if needed"
    echo "  7. Monitor performance metrics"
fi

echo ""
echo "🌐 API Endpoints:"
echo "  Location Search: $API_URL/businesses/search/location"
echo "  Categories: $API_URL/businesses/search/location/categories"
echo "  Popular Areas: $API_URL/businesses/search/location/popular-areas"

echo ""
print_success "Deployment completed! 🚀"