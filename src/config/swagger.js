const swaggerJsdoc = require('swagger-jsdoc');
const { API_EXAMPLES } = require('../docs/apiRequestExamples');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'MiraCore ESS Multi-Tenant API',
      version: '2.0.0',
      description: `
        MiraCore ESS Multi-Tenant Platform API — FSP onboarding, tenant management,
        API keys, tenant users, and loan processing (XML + JSON admin endpoints).
        
        ## Authentication
        - **JWT Bearer** for admin portal and onboarding APIs
        - **X-Tenant-Key** (+ optional X-Tenant-Secret) for system-to-system FSP integration
        
        ## Milestone 4 endpoints
        - Tenant CRUD and status lifecycle
        - Onboarding drafts, submit, review
        - Per-tenant MIFOS configuration
        - API key management (DELETE revoke — see release notes)
        - Tenant user management
      `,
      contact: {
        name: 'ESS API Support',
        email: 'support@ess-loans.tz'
      },
      license: {
        name: 'Proprietary',
        url: 'https://ess-loans.tz/license'
      }
    },
    servers: [
      {
        url: 'http://localhost:3008',
        description: 'Local development (default)'
      },
      {
        url: 'http://localhost:3002',
        description: 'Development server (legacy port)'
      },
      {
        url: 'http://135.181.33.13:3002',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token for admin authentication'
        },
        tenantApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Tenant-Key',
          description: 'Tenant API key for system-to-system auth'
        },
        digitalSignature: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Signature',
          description: 'Digital signature for XML message verification'
        }
      },
      schemas: {
        LoanMapping: {
          type: 'object',
          properties: {
            essApplicationNumber: {
              type: 'string',
              description: 'ESS Application Number (unique per loan)',
              example: 'ESS1766006882463'
            },
            essCheckNumber: {
              type: 'string',
              description: 'ESS Check Number (unique per CLIENT, not per loan)',
              example: 'CHK123456'
            },
            essLoanNumberAlias: {
              type: 'string',
              description: 'ESS Loan Number Alias (unique loan identifier)',
              example: 'LOAN202312210001'
            },
            fspReferenceNumber: {
              type: 'string',
              description: 'FSP Reference Number',
              example: 'FSP-2023-001'
            },
            mifosClientId: {
              type: 'integer',
              description: 'MIFOS Client ID',
              example: 123
            },
            mifosLoanId: {
              type: 'integer',
              description: 'MIFOS Loan ID',
              example: 456
            },
            productCode: {
              type: 'string',
              description: 'Loan Product Code',
              example: '17'
            },
            requestedAmount: {
              type: 'number',
              description: 'Requested loan amount in TZS',
              example: 5000000
            },
            tenure: {
              type: 'integer',
              description: 'Loan tenure in months',
              example: 24
            },
            status: {
              type: 'string',
              enum: [
                'INITIAL_OFFER',
                'INITIAL_APPROVAL_SENT',
                'APPROVED',
                'REJECTED',
                'CANCELLED',
                'FINAL_APPROVAL_RECEIVED',
                'CLIENT_CREATED',
                'LOAN_CREATED',
                'DISBURSED',
                'COMPLETED',
                'WAITING_FOR_LIQUIDATION',
                'DISBURSEMENT_FAILURE_NOTIFICATION_SENT',
                'FAILED',
                'OFFER_SUBMITTED'
              ],
              description: 'Current loan status'
            },
            originalMessageType: {
              type: 'string',
              enum: [
                'LOAN_OFFER_REQUEST',
                'TOP_UP_OFFER_REQUEST',
                'LOAN_TAKEOVER_OFFER_REQUEST',
                'LOAN_RESTRUCTURE_REQUEST'
              ],
              description: 'Original message type that initiated this loan'
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            message: {
              type: 'string',
              example: 'Error message description'
            },
            error: {
              type: 'string',
              example: 'Detailed error information'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully'
            },
            data: {
              type: 'object',
              description: 'Response data'
            }
          }
        },
        XMLLoanRequest: {
          type: 'object',
          description: 'XML structure for loan requests',
          example: {
            Document: {
              Data: {
                Header: {
                  Sender: 'ESS_UTUMISHI',
                  Receiver: 'ZE DONE',
                  FSPCode: 'FL8090',
                  MsgId: 'MSG123456789',
                  MessageType: 'LOAN_OFFER_REQUEST'
                },
                MessageDetails: {
                  ApplicationNumber: 'ESS1766006882463',
                  CheckNumber: 'CHK123456',
                  FirstName: 'John',
                  MiddleName: 'Doe',
                  LastName: 'Smith',
                  NIN: '19900101-12345-67890-12',
                  MobileNo: '255712345678',
                  RequestedAmount: 5000000,
                  Tenure: 24,
                  ProductCode: '17'
                }
              }
            }
          }
        },
        CircuitBreakerHealth: {
          type: 'object',
          description: 'Circuit breaker health status',
          properties: {
            enabled: {
              type: 'boolean',
              description: 'Whether the circuit breaker is enabled',
              example: true
            },
            state: {
              type: 'string',
              enum: ['OPEN', 'CLOSED', 'HALF_OPEN'],
              description: 'Current circuit breaker state',
              example: 'CLOSED'
            },
            name: {
              type: 'string',
              description: 'Circuit breaker name',
              example: 'MIFOS-Maker-post'
            },
            stats: {
              type: 'object',
              description: 'Circuit breaker statistics',
              properties: {
                fires: { type: 'integer', example: 1250 },
                successes: { type: 'integer', example: 1220 },
                failures: { type: 'integer', example: 25 },
                rejects: { type: 'integer', example: 5 },
                timeouts: { type: 'integer', example: 3 },
                fallbacks: { type: 'integer', example: 5 },
                errorRate: { type: 'string', example: '2.24%' },
                latencyMean: { type: 'number', example: 523.45 }
              }
            },
            options: {
              type: 'object',
              properties: {
                timeout: { type: 'integer', example: 30000 },
                errorThresholdPercentage: { type: 'integer', example: 50 },
                resetTimeout: { type: 'integer', example: 60000 },
                volumeThreshold: { type: 'integer', example: 5 }
              }
            }
          }
        },
        Address: {
          type: 'object',
          properties: {
            line1: { type: 'string', example: 'Plot 12, Samora Avenue' },
            line2: { type: 'string' },
            city: { type: 'string', example: 'Dar es Salaam' },
            region: { type: 'string', example: 'Dar es Salaam' },
            country: { type: 'string', example: 'TZ', default: 'TZ' }
          }
        },
        CreateTenantRequest: {
          type: 'object',
          required: ['tenantName', 'fspCode', 'fspName', 'contactPerson', 'contactEmail', 'contactPhone'],
          example: API_EXAMPLES.createTenant,
          properties: {
            tenantId: { type: 'string', example: 'acme-fsp', description: 'Optional; auto-generated from fspCode if omitted' },
            tenantName: { type: 'string', example: 'Acme Microfinance' },
            fspCode: { type: 'string', example: 'ACME01', description: '2-20 uppercase alphanumeric; unique' },
            fspName: { type: 'string', example: 'Acme Microfinance Ltd' },
            contactPerson: { type: 'string', example: 'Jane Doe' },
            contactEmail: { type: 'string', format: 'email', example: 'jane@acme.co.tz' },
            contactPhone: { type: 'string', example: '+255712345678' },
            organizationRegistrationNumber: { type: 'string' },
            address: { $ref: '#/components/schemas/Address' },
            subscription: {
              type: 'object',
              properties: {
                plan: { type: 'string', enum: ['trial', 'standard', 'enterprise'], default: 'standard' },
                monthlyLimit: { type: 'integer', example: 10000 }
              }
            }
          }
        },
        UpdateTenantRequest: {
          type: 'object',
          example: API_EXAMPLES.updateTenant,
          properties: {
            tenantName: { type: 'string' },
            fspCode: { type: 'string', description: 'Immutable after tenant is active' },
            fspName: { type: 'string' },
            contactPerson: { type: 'string' },
            contactEmail: { type: 'string', format: 'email' },
            contactPhone: { type: 'string' },
            organizationRegistrationNumber: { type: 'string' },
            address: { $ref: '#/components/schemas/Address' },
            subscription: {
              type: 'object',
              properties: {
                plan: { type: 'string', enum: ['trial', 'standard', 'enterprise'] },
                monthlyLimit: { type: 'integer' }
              }
            }
          }
        },
        PatchTenantStatusRequest: {
          type: 'object',
          required: ['status'],
          example: API_EXAMPLES.patchStatusApproved,
          properties: {
            status: {
              type: 'string',
              enum: ['draft', 'submitted', 'under_review', 'approved', 'active', 'rejected', 'suspended', 'disabled']
            },
            reason: { type: 'string', example: 'Suspended for compliance review' }
          }
        },
        MifosConfigRequest: {
          type: 'object',
          example: API_EXAMPLES.mifosConfigInherit,
          properties: {
            mode: { type: 'string', enum: ['inherit_default', 'override'], default: 'inherit_default' },
            baseUrl: { type: 'string', format: 'uri', example: 'https://fineract.example.com/fineract-provider/api' },
            tenantId: { type: 'string', example: 'zedone-uat', description: 'Fineract platform tenant id' },
            makerUsername: { type: 'string' },
            makerPassword: { type: 'string', format: 'password' },
            checkerUsername: { type: 'string' },
            checkerPassword: { type: 'string', format: 'password' },
            callbackUrl: { type: 'string', format: 'uri' },
            timeoutMs: { type: 'integer', example: 30000 }
          }
        },
        CreateOnboardingDraftRequest: {
          type: 'object',
          required: ['tenantName', 'fspCode', 'contactEmail'],
          example: API_EXAMPLES.createOnboardingDraft,
          properties: {
            tenantName: { type: 'string', example: 'Draft FSP' },
            fspCode: { type: 'string', example: 'DRAFT01' },
            contactEmail: { type: 'string', format: 'email', example: 'draft@fsp.co.tz' },
            tenantId: { type: 'string', example: 'draft-fsp' }
          }
        },
        UpdateOnboardingDraftRequest: {
          type: 'object',
          example: API_EXAMPLES.updateOnboardingDraft,
          properties: {
            companyInfo: { $ref: '#/components/schemas/CreateTenantRequest' },
            mifosConfig: { $ref: '#/components/schemas/MifosConfigRequest' },
            completedSteps: { type: 'array', items: { type: 'string' }, example: ['company', 'mifos'] }
          }
        },
        ValidateFspCodeRequest: {
          type: 'object',
          required: ['fspCode'],
          example: API_EXAMPLES.validateFspCode,
          properties: {
            fspCode: { type: 'string', example: 'NEWFSP01' }
          }
        },
        ReviewDecisionRequest: {
          type: 'object',
          required: ['decision'],
          example: API_EXAMPLES.reviewDecision,
          properties: {
            decision: { type: 'string', enum: ['approve', 'reject'] },
            reason: { type: 'string', example: 'Incomplete documentation' }
          }
        },
        CreateTenantUserRequest: {
          type: 'object',
          required: ['email', 'fullName', 'role'],
          example: API_EXAMPLES.createTenantUser,
          properties: {
            email: { type: 'string', format: 'email', example: 'officer@fsp.co.tz' },
            fullName: { type: 'string', example: 'Loan Officer' },
            role: {
              type: 'string',
              enum: ['tenant_admin', 'operations_manager', 'finance_officer', 'support_staff']
            },
            username: { type: 'string' },
            phone: { type: 'string' },
            permissions: { type: 'array', items: { type: 'string' } }
          }
        },
        UpdateTenantUserRequest: {
          type: 'object',
          example: API_EXAMPLES.updateTenantUser,
          properties: {
            role: { type: 'string', enum: ['tenant_admin', 'operations_manager', 'finance_officer', 'support_staff'] },
            permissions: { type: 'array', items: { type: 'string' } },
            isActive: { type: 'boolean' }
          }
        },
        CreateApiKeyRequest: {
          type: 'object',
          required: ['name'],
          example: API_EXAMPLES.createApiKey,
          properties: {
            name: { type: 'string', example: 'Production integration key' },
            permissions: { type: 'array', items: { type: 'string' } },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            ipWhitelist: { type: 'array', items: { type: 'string' } },
            rateLimit: {
              type: 'object',
              properties: {
                requestsPerMinute: { type: 'integer', example: 60 },
                requestsPerHour: { type: 'integer', example: 1000 }
              }
            },
            keyPrefix: { type: 'string', enum: ['mk_live', 'mk_test'], default: 'mk_live' }
          }
        },
        TenantPublic: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            tenantId: { type: 'string', example: 'acme-fsp' },
            tenantName: { type: 'string' },
            fspCode: { type: 'string', example: 'ACME01' },
            fspName: { type: 'string' },
            contactPerson: { type: 'string' },
            contactEmail: { type: 'string' },
            contactPhone: { type: 'string' },
            status: { type: 'string', example: 'draft' },
            mifosConfigured: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Validation failed' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'fspCode' },
                  message: { type: 'string' }
                }
              }
            }
          }
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', example: '9f373f09f62e9298b3f48406015dcb2a3d3c2df7606c4e7e89bef8146f23a7ecc9d520bbc6e4b015276019bb9b897d59d' }
          }
        },
        SelectTenantRequest: {
          type: 'object',
          required: ['tenantId'],
          properties: {
            tenantId: { type: 'string', example: 'legacy-zedone' }
          }
        },
        ApiKeyLoginRequest: {
          type: 'object',
          properties: {
            apiKey: { type: 'string', example: 'mk_live_abc123...' },
            apiSecret: { type: 'string', example: 'your-api-secret' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Loan Processing',
        description: 'Loan offer and processing endpoints'
      },
      {
        name: 'Balance & Charges',
        description: 'Balance inquiries and loan charges'
      },
      {
        name: 'Loan Actions',
        description: 'Loan approval, cancellation, and rejection'
      },
      {
        name: 'Authentication',
        description: 'User authentication and authorization'
      },
      {
        name: 'Admin',
        description: 'Administrative endpoints'
      },
      {
        name: 'Health & Monitoring',
        description: 'System health and monitoring'
      },
      {
        name: 'Tenants',
        description: 'FSP tenant CRUD and lifecycle'
      },
      {
        name: 'Onboarding',
        description: 'FSP onboarding workflow'
      },
      {
        name: 'API Keys',
        description: 'Tenant API key management'
      },
      {
        name: 'Tenant Users',
        description: 'Tenant user membership and roles'
      },
      {
        name: 'Audit',
        description: 'Tenant-scoped audit logs and statistics (M3)'
      },
      {
        name: 'Products',
        description: 'Tenant-scoped loan product management (M3)'
      },
      {
        name: 'Users',
        description: 'Platform user management (M3)'
      },
      {
        name: 'MIFOS Admin',
        description: 'MIFOS/CBS health, auth, and diagnostics (M3)'
      }
    ]
  },
  apis: [
    './server.js',
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
