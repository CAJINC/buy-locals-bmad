# BuyLocals

Community-driven local business discovery and reservation platform.

## Project Structure

This is a monorepo containing:

- **apps/mobile/** - React Native mobile application
- **apps/web/** - React.js web dashboard
- **apps/api/** - Node.js/Express serverless API
- **packages/shared/** - Shared TypeScript types and utilities
- **packages/ui/** - Shared UI components (future)
- **packages/config/** - Shared configurations (ESLint, Prettier, TypeScript)
- **infrastructure/** - AWS CDK infrastructure definitions
- **scripts/** - Build and deployment scripts

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL (for local development)
- Redis (for local development)

### Installation

```bash
# Install dependencies
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start all development servers
npm run dev

# Run specific app
cd apps/mobile && npm run dev
cd apps/web && npm run dev
cd apps/api && npm run dev
```

### Database Setup

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/buylocals"
export REDIS_URL="redis://localhost:6379"

# Run migrations
cd scripts && node migrate-database.js
```

### Testing

```bash
# Run all tests
npm run test

# Run linting
npm run lint

# Run type checking
npm run type-check

# Format code
npm run format
```

### Deployment

```bash
# Deploy infrastructure
cd infrastructure && npm run deploy:staging

# Deploy API
cd apps/api && npm run deploy:staging

# Deploy web (handled by CI/CD to Vercel)
```

## Tech Stack

- **Language:** TypeScript 5.3+
- **Mobile:** React Native 0.73+ with NativeBase
- **Web:** React.js with Vite
- **Backend:** Node.js 20 with Express.js
- **Database:** PostgreSQL 15+ with Redis 7.0+
- **Infrastructure:** AWS CDK
- **CI/CD:** GitHub Actions

## Development Workflow

1. Create feature branch from `develop`
2. Make changes and commit with conventional commits
3. Push branch - CI runs tests and builds
4. Create PR to `develop` - triggers staging deployment
5. Merge to `main` - triggers production deployment

## Environment Variables

### Required for API

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (required in production)
- `REDIS_URL` - Redis connection string (optional)
- `CORS_ORIGIN` - CORS allowed origin

### Optional

- `STAGE` - Deployment stage (dev/staging/prod)
- `AWS_REGION` - AWS region (default: us-east-1)

## Scripts

- `npm run build` - Build all packages
- `npm run dev` - Start development servers
- `npm run test` - Run all tests
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler
- `npm run format` - Format code with Prettier
- `npm run clean` - Clean all build artifacts

## Package Dependencies

Each app/package has its own `package.json` with specific dependencies. The root `package.json` manages shared development dependencies and workspace configuration.

## Contributing

1. Follow the coding standards defined in `docs/architecture/coding-standards.md`
2. Write tests for new features
3. Ensure CI passes before requesting review
4. Use conventional commit messages

## Architecture

See the `docs/architecture/` directory for detailed architecture documentation including:

- High-level architecture
- Database schema
- API specifications
- Security and performance guidelines
- Testing strategy

## Support

For questions about the codebase, see the documentation in `docs/` or reach out to the development team.