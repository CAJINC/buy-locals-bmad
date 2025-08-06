# Unified Project Structure

```
buy-locals/
├── .github/                    # CI/CD workflows
│   └── workflows/
│       ├── ci.yaml
│       ├── deploy-staging.yaml
│       └── deploy-production.yaml
├── apps/                       # Application packages
│   ├── mobile/                 # React Native mobile app
│   │   ├── src/
│   │   │   ├── components/     # Reusable UI components
│   │   │   ├── screens/        # Screen components
│   │   │   ├── navigation/     # Navigation configuration
│   │   │   ├── services/       # API client services
│   │   │   ├── stores/         # Zustand state stores
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── utils/          # Mobile-specific utilities
│   │   │   └── types/          # Mobile-specific types
│   │   ├── android/            # Android native code
│   │   ├── ios/                # iOS native code
│   │   ├── assets/             # Static assets
│   │   ├── __tests__/          # Mobile app tests
│   │   ├── metro.config.js     # Metro bundler config
│   │   └── package.json
│   ├── web/                    # React.js web dashboard
│   │   ├── src/
│   │   │   ├── components/     # Web UI components
│   │   │   ├── pages/          # Page components
│   │   │   ├── hooks/          # Custom React hooks
│   │   │   ├── services/       # API client services
│   │   │   ├── stores/         # Zustand state stores
│   │   │   ├── styles/         # Global styles/themes
│   │   │   └── utils/          # Web-specific utilities
│   │   ├── public/             # Static assets
│   │   ├── tests/              # Web app tests
│   │   ├── vite.config.ts      # Vite configuration
│   │   └── package.json
│   └── api/                    # Backend serverless functions
│       ├── src/
│       │   ├── functions/      # Lambda functions organized by domain
│       │   │   ├── auth/
│       │   │   ├── business/
│       │   │   ├── booking/
│       │   │   ├── payment/
│       │   │   ├── review/
│       │   │   └── notification/
│       │   ├── services/       # Business logic services
│       │   ├── repositories/   # Data access layer
│       │   ├── middleware/     # Express/Lambda middleware
│       │   ├── schemas/        # Validation schemas
│       │   ├── utils/          # Backend utilities
│       │   └── types/          # Backend-specific types
│       ├── tests/              # Backend tests
│       ├── serverless.yml      # Serverless Framework config
│       └── package.json
├── packages/                   # Shared packages
│   ├── shared/                 # Shared types/utilities
│   │   ├── src/
│   │   │   ├── types/          # TypeScript interfaces
│   │   │   │   ├── user.ts
│   │   │   │   ├── business.ts
│   │   │   │   ├── booking.ts
│   │   │   │   ├── review.ts
│   │   │   │   └── transaction.ts
│   │   │   ├── constants/      # Shared constants
│   │   │   ├── utils/          # Shared utilities
│   │   │   └── schemas/        # Validation schemas
│   │   └── package.json
│   ├── ui/                     # Shared UI components
│   │   ├── src/
│   │   │   ├── components/     # Cross-platform components
│   │   │   ├── themes/         # Design system tokens
│   │   │   └── styles/         # Shared styles
│   │   └── package.json
│   └── config/                 # Shared configuration
│       ├── eslint/
│       │   └── .eslintrc.js
│       ├── typescript/
│       │   └── tsconfig.json
│       └── jest/
│           └── jest.config.js
├── infrastructure/             # AWS CDK definitions
│   ├── lib/
│   │   ├── database-stack.ts
│   │   ├── api-stack.ts
│   │   ├── storage-stack.ts
│   │   └── monitoring-stack.ts
│   ├── bin/
│   │   └── infrastructure.ts
│   ├── cdk.json
│   └── package.json
├── scripts/                    # Build/deploy scripts
│   ├── build.sh
│   ├── deploy.sh
│   ├── setup-local.sh
│   └── seed-data.sql
├── docs/                       # Documentation
│   ├── prd.md
│   ├── brief.md
│   ├── architecture.md
│   ├── api-docs/
│   └── deployment-guide.md
├── .env.example                # Environment template
├── .gitignore
├── package.json                # Root package.json
├── turbo.json                  # Turborepo configuration
├── README.md
└── LICENSE
```
