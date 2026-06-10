const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ESS Loan Management API',
      version: '1.0.0',
      description: `
        ESS (Employee Self-Service) Loan Management System API.
        
        This API handles loan processing between ESS UTUMISHI (Tanzania Government Employee Portal) 
        and FSP (Financial Service Provider) via XML message exchange with digital signatures.
        
        ## Features
        - Loan offer processing (new loans, top-ups, takeovers, restructures)
        - Balance inquiries
        - Final approval and disbursement
        - Payment notifications
        - Loan cancellations and rejections
        - MIFOS Core Banking System integration
        - Digital signature verification
        
        ## Authentication
        - Admin endpoints require JWT token authentication
        - Loan API endpoints use digital signature verification
        
        ## Message Format
        - All loan messages use XML with digital signatures
        - Responses include FSP digital signatures
        - Message types: LOAN_OFFER_REQUEST, TOP_UP_OFFER_REQUEST, etc.
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
        url: 'http://localhost:3002',
        description: 'Development server'
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
                fires: {
                  type: 'integer',
                  description: 'Total number of requests',
                  example: 1250
                },
                successes: {
                  type: 'integer',
                  description: 'Number of successful requests',
                  example: 1220
                },
                failures: {
                  type: 'integer',
                  description: 'Number of failed requests',
                  example: 25
                },
                rejects: {
                  type: 'integer',
                  description: 'Number of rejected requests (circuit open)',
                  example: 5
                },
                timeouts: {
                  type: 'integer',
                  description: 'Number of timeout failures',
                  example: 3
                },
                fallbacks: {
                  type: 'integer',
                  description: 'Number of fallback executions',
                  example: 5
                },
                errorRate: {
                  type: 'string',
                  description: 'Error rate percentage',
                  example: '2.24%'
                },
                latencyMean: {
                  type: 'number',
                  description: 'Mean request latency in milliseconds',
                  example: 523.45
                }
              }
            },
            options: {
              type: 'object',
              description: 'Circuit breaker configuration',
              properties: {
                timeout: {
                  type: 'integer',
                  description: 'Request timeout in milliseconds',
                  example: 30000
                },
                errorThresholdPercentage: {
                  type: 'integer',
                  description: 'Error threshold percentage to open circuit',
                  example: 50
                },
                resetTimeout: {
                  type: 'integer',
                  description: 'Time in milliseconds before attempting to close circuit',
                  example: 60000
                },
                volumeThreshold: {
                  type: 'integer',
                  description: 'Minimum requests before calculating error rate',
                  example: 5
                }
              }
            }
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
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js',
    './src/models/*.js'
  ]
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
