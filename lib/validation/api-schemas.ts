import { z } from 'zod';
import { commonSchemas } from '../middleware/validation';

/**
 * Authentication API Schemas
 */
export const authSchemas = {
  // Login
  login: {
    body: z.object({
      email: commonSchemas.email,
      password: z.string().min(1, 'Password is required'),
    }),
    response: z.union([
      // Success response
      z.object({
        success: z.literal(true),
        data: z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']),
          }),
          token: z.string().optional(),
        }),
        message: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        timestamp: z.string(),
        requestId: z.string().optional(),
      }),
      // Error response
      z.object({
        success: z.literal(false),
        error: z.object({
          message: z.string(),
          code: z.string(),
          details: z.unknown().optional(),
          field: z.string().optional(),
          stack: z.string().optional(),
        }),
        timestamp: z.string(),
        requestId: z.string().optional(),
      }),
    ]),
  },

  // Register
  register: {
    body: z.object({
      email: commonSchemas.email,
      password: commonSchemas.password,
      name: z.string()
        .min(2, 'Name must be at least 2 characters')
        .max(100, 'Name must be less than 100 characters')
        .trim()
        .regex(/^[a-zA-Z\s'-]+$/, 'Name can only contain letters, spaces, hyphens and apostrophes'),
      // Optional fields for future use
      phone: z.string().optional(),
      abn: z.string().optional(),
      acceptTerms: z.boolean().optional(),
    }).strict(), // Reject extra fields
    response: z.union([
      // Success response
      z.object({
        success: z.literal(true),
        data: z.object({
          user: z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            role: z.literal('USER'),
          }),
          message: z.string().optional(),
        }),
        message: z.string().optional(),
        metadata: z.record(z.unknown()).optional(),
        timestamp: z.string(),
        requestId: z.string().optional(),
      }),
      // Error response
      z.object({
        success: z.literal(false),
        error: z.object({
          message: z.string(),
          code: z.string(),
          details: z.unknown().optional(),
          field: z.string().optional(),
          stack: z.string().optional(),
        }),
        timestamp: z.string(),
        requestId: z.string().optional(),
      }),
    ]),
  },

  // Forgot Password
  forgotPassword: {
    body: z.object({
      email: commonSchemas.email,
    }),
    response: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },

  // Reset Password
  resetPassword: {
    body: z.object({
      token: z.string(),
      password: commonSchemas.password,
    }),
    response: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
  },

  // Profile
  profile: {
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
        role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']),
        createdAt: z.string().datetime(),
        emailVerified: z.boolean(),
      }),
    }),
  },
};

/**
 * Transaction API Schemas
 */
export const transactionSchemas = {
  // List transactions
  list: {
    query: z.object({
      ...commonSchemas.pagination.shape,
      ...commonSchemas.dateRange.shape,
      category: z.string().optional(),
      taxCategory: commonSchemas.taxCategory.optional(),
      isBusinessExpense: commonSchemas.booleanString.optional(),
      bankAccountId: z.string().uuid().optional(),
      search: z.string().optional(),
      sortBy: z.enum(['date', 'amount', 'category']).optional(),
      sortOrder: commonSchemas.sortOrder.optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        transactions: z.array(
          z.object({
            id: z.string().uuid(),
            description: z.string(),
            amount: z.number(),
            date: z.string().datetime(),
            type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
            category: z.string().nullable(),
            taxCategory: z.string().nullable(),
            isBusinessExpense: z.boolean(),
            gstAmount: z.number().nullable(),
            userId: z.string().uuid(),
            bankAccountId: z.string().uuid(),
            receiptId: z.string().uuid().nullable(),
          }),
        ),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          pages: z.number(),
          hasMore: z.boolean(),
        }),
        summary: z.object({
          totalIncome: z.number(),
          totalExpenses: z.number(),
          netCashFlow: z.number(),
          averageTransaction: z.number(),
          transactionCount: z.number(),
        }),
      }),
    }),
  },

  // Update transaction
  update: {
    body: z.object({
      transactionId: z.string().uuid(),
      category: z.string().optional(),
      taxCategory: commonSchemas.taxCategory.optional(),
      isBusinessExpense: z.boolean().optional(),
      notes: z.string().max(1000).optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        category: z.string().nullable(),
        taxCategory: z.string().nullable(),
        isBusinessExpense: z.boolean(),
        notes: z.string().nullable(),
        updatedAt: z.string().datetime(),
      }),
    }),
  },
};

/**
 * Goals API Schemas
 */
export const goalSchemas = {
  // List goals
  list: {
    query: z.object({
      status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']).optional(),
      category: z.string().optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        goals: z.array(
          z.object({
            id: z.string().uuid(),
            name: z.string(),
            description: z.string().nullable(),
            targetAmount: z.number(),
            currentAmount: z.number(),
            deadline: z.string().datetime().nullable(),
            status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']),
            category: z.string().nullable(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH']),
            progressPercentage: z.number(),
            userId: z.string().uuid(),
            createdAt: z.string().datetime(),
          }),
        ),
      }),
    }),
  },

  // Create goal
  create: {
    body: z.object({
      name: z.string().min(2).max(100).trim(),
      description: z.string().max(500).optional(),
      targetAmount: commonSchemas.amount,
      deadline: z.string().datetime(),
      category: z.string().optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        name: z.string(),
        targetAmount: z.number(),
        currentAmount: z.number(),
        status: z.literal('ACTIVE'),
        createdAt: z.string().datetime(),
      }),
    }),
  },

  // Update goal
  update: {
    params: z.object({
      id: commonSchemas.id,
    }),
    body: z.object({
      name: z.string().min(2).max(100).trim().optional(),
      description: z.string().max(500).optional(),
      targetAmount: commonSchemas.amount.optional(),
      currentAmount: commonSchemas.amount.optional(),
      deadline: z.string().datetime().optional(),
      status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']).optional(),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        name: z.string(),
        targetAmount: z.number(),
        currentAmount: z.number(),
        status: z.enum(['ACTIVE', 'COMPLETED', 'PAUSED']),
        updatedAt: z.string().datetime(),
      }),
    }),
  },
};

/**
 * Receipt API Schemas
 */
export const receiptSchemas = {
  // List receipts
  list: {
    query: z.object({
      ...commonSchemas.pagination.shape,
      status: z.enum(['PENDING', 'PROCESSED', 'FAILED']).optional(),
      category: z.string().optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        receipts: z.array(
          z.object({
            id: z.string().uuid(),
            fileName: z.string(),
            fileUrl: z.string(),
            status: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
            extractedData: z.object({
              merchant: z.string().nullable(),
              amount: z.number().nullable(),
              date: z.string().datetime().nullable(),
              category: z.string().nullable(),
              taxAmount: z.number().nullable(),
              items: z.array(
                z.object({
                  description: z.string(),
                  amount: z.number(),
                })
              ).nullable(),
              gstAmount: z.number().nullable(),
              receiptNumber: z.string().nullable(),
            }).nullable(),
            confidence: z.number().nullable(),
            error: z.string().nullable(),
            createdAt: z.string().datetime(),
          }),
        ),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          pages: z.number(),
          hasMore: z.boolean(),
        }),
        summary: z.object({
          totalAmount: z.number(),
          receiptCount: z.number(),
          categoryBreakdown: z.record(z.number()),
        }),
      }),
    }),
  },

  // Process receipt (multipart form data)
  process: {
    // Note: File validation happens in the handler
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        fileName: z.string(),
        status: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
        extractedData: z.object({
          merchant: z.string().nullable(),
          amount: z.number().nullable(),
          date: z.string().datetime().nullable(),
          category: z.string().nullable(),
          taxAmount: z.number().nullable(),
          items: z.array(
            z.object({
              description: z.string(),
              amount: z.number(),
            })
          ).nullable(),
          gstAmount: z.number().nullable(),
          receiptNumber: z.string().nullable(),
        }).nullable(),
        confidence: z.number().nullable(),
        error: z.string().nullable(),
      }),
    }),
  },

  // Update receipt
  update: {
    params: z.object({
      id: commonSchemas.id,
    }),
    body: z.object({
      extractedData: z
        .object({
          merchant: z.string().optional(),
          amount: z.number().optional(),
          date: z.string().datetime().optional(),
          category: z.string().optional(),
          taxAmount: z.number().optional(),
          items: z
            .array(
              z.object({
                description: z.string(),
                amount: z.number(),
              }),
            )
            .optional(),
        })
        .optional(),
      status: z.enum(['PENDING', 'PROCESSED', 'FAILED']).optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        extractedData: z.object({
          merchant: z.string().nullable(),
          amount: z.number().nullable(),
          date: z.string().datetime().nullable(),
          category: z.string().nullable(),
          taxAmount: z.number().nullable(),
          items: z.array(
            z.object({
              description: z.string(),
              amount: z.number(),
            })
          ).nullable(),
          gstAmount: z.number().nullable(),
          receiptNumber: z.string().nullable(),
        }),
        status: z.enum(['PENDING', 'PROCESSED', 'FAILED']),
        updatedAt: z.string().datetime(),
      }),
    }),
  },
};

/**
 * Tax Calculation API Schemas
 */
export const taxSchemas = {
  // Calculate tax
  calculate: {
    body: z.discriminatedUnion('operation', [
      // PAYG Withholding
      z.object({
        operation: z.literal('PAYG_WITHHOLDING'),
        income: commonSchemas.amount,
        frequency: z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY']),
      }),
      // Deduction calculation
      z.object({
        operation: z.literal('DEDUCTION_CALCULATION'),
        category: commonSchemas.taxCategory.unwrap(),
        amount: commonSchemas.amount,
        businessUsePercentage: commonSchemas.percentage,
      }),
      // ABN validation
      z.object({
        operation: z.literal('ABN_VALIDATION'),
        abn: z.string(),
      }),
      // TFN validation
      z.object({
        operation: z.literal('TFN_VALIDATION'),
        tfn: z.string(),
      }),
    ]),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        operation: z.string(),
        result: z.union([
          // PAYG Withholding result
          z.object({
            withholdingAmount: z.number(),
            netIncome: z.number(),
            effectiveRate: z.number(),
          }),
          // Deduction calculation result
          z.object({
            deductibleAmount: z.number(),
            nonDeductibleAmount: z.number(),
            gstComponent: z.number(),
          }),
          // ABN validation result
          z.object({
            isValid: z.boolean(),
            entityName: z.string().optional(),
            entityType: z.string().optional(),
            status: z.string().optional(),
          }),
          // TFN validation result
          z.object({
            isValid: z.boolean(),
            checksum: z.boolean(),
          }),
        ]),
      }),
    }),
  },

  // GST calculation
  gstCalculate: {
    body: z.union([
      // Single calculation
      z.object({
        amount: commonSchemas.amount,
        gstInclusive: z.boolean().default(true),
        category: z.string(),
      }),
      // Bulk calculation
      z.object({
        transactions: z
          .array(
            z.object({
              amount: z.number(),
              category: z.string(),
            }),
          )
          .max(100),
      }),
    ]),
    response: z.object({
      success: z.boolean(),
      data: z.union([
        // Single calculation result
        z.object({
          amount: z.number(),
          gstAmount: z.number(),
          netAmount: z.number(),
          gstInclusive: z.boolean(),
          category: z.string(),
        }),
        // Bulk calculation result
        z.object({
          transactions: z.array(
            z.object({
              amount: z.number(),
              gstAmount: z.number(),
              netAmount: z.number(),
              category: z.string(),
            })
          ),
          summary: z.object({
            totalAmount: z.number(),
            totalGst: z.number(),
            totalNet: z.number(),
          }),
        }),
      ]),
    }),
  },

  // BAS report
  basReport: {
    query: z.object({
      taxPeriod: z.string().regex(/^\d{4}Q[1-4]$/, 'Invalid tax period format (e.g., 2024Q1)'),
      includeDetails: commonSchemas.booleanString.optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        taxPeriod: z.string(),
        summary: z.object({
          totalSales: z.number(),
          totalPurchases: z.number(),
          gstCollected: z.number(),
          gstPaid: z.number(),
          netGST: z.number(),
        }),
        fields: z.record(z.union([z.string(), z.number()])),
        salesDetails: z.array(
          z.object({
            date: z.string().datetime(),
            description: z.string(),
            amount: z.number(),
            gst: z.number(),
            category: z.string(),
            reference: z.string().optional(),
          })
        ).optional(),
        purchaseDetails: z.array(
          z.object({
            date: z.string().datetime(),
            description: z.string(),
            amount: z.number(),
            gst: z.number(),
            category: z.string(),
            reference: z.string().optional(),
            supplier: z.string().optional(),
          })
        ).optional(),
      }),
    }),
  },
};

/**
 * Admin API Schemas
 */
export const adminSchemas = {
  // List users
  users: {
    query: z.object({
      ...commonSchemas.pagination.shape,
      role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']).optional(),
      status: z.enum(['active', 'suspended', 'deleted']).optional(),
      search: z.string().optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        users: z.array(
          z.object({
            id: z.string().uuid(),
            email: z.string().email(),
            name: z.string(),
            role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']),
            suspended: z.boolean(),
            createdAt: z.string().datetime(),
            lastLogin: z.string().datetime().nullable(),
          }),
        ),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          pages: z.number(),
          hasMore: z.boolean(),
        }),
      }),
    }),
  },

  // Update user
  updateUser: {
    params: z.object({
      id: commonSchemas.id,
    }),
    body: z.object({
      role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']).optional(),
      suspended: z.boolean().optional(),
      name: z.string().min(2).max(100).optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
        role: z.enum(['USER', 'ADMIN', 'ACCOUNTANT', 'SUPPORT']),
        suspended: z.boolean(),
        updatedAt: z.string().datetime(),
      }),
    }),
  },

  // Audit logs
  auditLogs: {
    query: z.object({
      ...commonSchemas.pagination.shape,
      ...commonSchemas.dateRange.shape,
      userId: z.string().uuid().optional(),
      event: z.string().optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        logs: z.array(
          z.object({
            id: z.string().uuid(),
            event: z.string(),
            userId: z.string().uuid(),
            ipAddress: z.string(),
            userAgent: z.string(),
            metadata: z.record(z.unknown()).nullable(),
            createdAt: z.string().datetime(),
          }),
        ),
        pagination: z.object({
          page: z.number(),
          limit: z.number(),
          total: z.number(),
          pages: z.number(),
          hasMore: z.boolean(),
        }),
      }),
    }),
  },

  // Performance metrics
  performance: {
    query: z.object({
      includeAI: commonSchemas.booleanString.optional(),
      includeDatabase: commonSchemas.booleanString.optional(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        database: z.object({
          activeConnections: z.number(),
          queryTime: z.number(),
          poolSize: z.number(),
        }),
        application: z.object({
          uptime: z.number(),
          memoryUsage: z.object({
            heapUsed: z.number(),
            heapTotal: z.number(),
            external: z.number(),
            rss: z.number(),
          }),
          cpuUsage: z.number(),
        }),
        requests: z.object({
          total: z.number(),
          errors: z.number(),
          avgResponseTime: z.number(),
        }),
        aiServices: z
          .object({
            totalRequests: z.number(),
            tokenUsage: z.number(),
            cacheHitRate: z.number(),
            providerBreakdown: z.record(z.number()),
          })
          .optional(),
      }),
    }),
  },
};

/**
 * Compliance API Schemas
 */
export const complianceSchemas = {
  // GST calculation
  gstCalculate: {
    body: z.object({
      amount: commonSchemas.amount,
      isInclusive: z.boolean().default(true),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        amount: z.number(),
        gstAmount: z.number(),
        netAmount: z.number(),
        isInclusive: z.boolean(),
      }),
    }),
  },

  // ABN validation
  abnValidate: {
    body: z.object({
      abn: z.string().regex(/^\d{11}$/, 'ABN must be 11 digits'),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        isValid: z.boolean(),
        formattedAbn: z.string().optional(),
        message: z.string().optional(),
      }),
    }),
  },

  // BAS report
  basReport: {
    query: z.object({
      period: z.string(),
      year: z.number().min(2020).max(2030),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        period: z.string(),
        year: z.number(),
        totalSales: z.number(),
        totalPurchases: z.number(),
        gstCollected: z.number(),
        gstPaid: z.number(),
        netGst: z.number(),
      }),
    }),
  },

  // Comprehensive report
  comprehensiveReport: {
    query: z.object({
      startDate: z.string(),
      endDate: z.string(),
    }),
    response: z.object({
      success: z.boolean(),
      data: z.object({
        period: z.object({
          start: z.string(),
          end: z.string(),
        }),
        income: z.object({
          total: z.number(),
          taxable: z.number(),
          nonTaxable: z.number(),
        }),
        expenses: z.object({
          total: z.number(),
          deductible: z.number(),
          nonDeductible: z.number(),
        }),
        gst: z.object({
          collected: z.number(),
          paid: z.number(),
          net: z.number(),
        }),
      }),
    }),
  },
};
