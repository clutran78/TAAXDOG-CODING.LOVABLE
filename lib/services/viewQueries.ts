import { PrismaClient } from '../../generated/prisma';

/**
 * Query functions for materialized views
 * These provide fast access to pre-aggregated data
 */

export interface MonthlySpending {
  userId: string;
  month: Date;
  category: string;
  totalAmount: number;
  transactionCount: number;
  avgAmount: number;
  deductibleAmount: number;
  deductibleCount: number;
}

export interface TaxCategorySummary {
  userId: string;
  taxYear: Date;
  category: string;
  deductibleTotal: number;
  deductibleCount: number;
  totalAmount: number;
  totalCount: number;
  lastTransactionDate: Date;
}

export interface GoalProgressAnalytics {
  goalId: string;
  userId: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  createdAt: Date;
  isActive: boolean;
  transactionCount: number;
  totalContributed: number;
  progressPercentage: number;
  daysRemaining: number | null;
  dailyTargetAmount: number;
}

export interface UserFinancialSummary {
  userId: string;
  email: string;
  name: string | null;
  totalTransactions: number;
  totalGoals: number;
  totalReceipts: number;
  activeBankConnections: number;
  lifetimeSpending: number;
  lifetimeDeductibles: number;
  avgTransactionAmount: number;
  lastTransactionDate: Date | null;
  lastBankSync: Date | null;
}

export class ViewQueries {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get monthly spending summary from materialized view
   */
  async getMonthlySpending(
    userId: string,
    startMonth?: Date,
    endMonth?: Date
  ): Promise<MonthlySpending[]> {
    let whereClause = `WHERE "userId" = $1`;
    const params: any[] = [userId];
    
    if (startMonth) {
      params.push(startMonth);
      whereClause += ` AND month >= $${params.length}`;
    }
    
    if (endMonth) {
      params.push(endMonth);
      whereClause += ` AND month <= $${params.length}`;
    }

    const result = await this.prisma.$queryRawUnsafe<MonthlySpending[]>(`
      SELECT 
        "userId",
        month,
        category,
        total_amount as "totalAmount",
        transaction_count as "transactionCount",
        avg_amount as "avgAmount",
        deductible_amount as "deductibleAmount",
        deductible_count as "deductibleCount"
      FROM monthly_spending_summary
      ${whereClause}
      ORDER BY month DESC, total_amount DESC
    `, ...params);

    return result;
  }

  /**
   * Get tax category summary from materialized view
   */
  async getTaxCategorySummary(
    userId: string,
    taxYear?: number
  ): Promise<TaxCategorySummary[]> {
    let whereClause = `WHERE "userId" = $1`;
    const params: any[] = [userId];
    
    if (taxYear) {
      const startDate = new Date(taxYear, 6, 1); // July 1 (Australian tax year)
      const endDate = new Date(taxYear + 1, 5, 30); // June 30
      params.push(startDate, endDate);
      whereClause += ` AND tax_year >= $2 AND tax_year <= $3`;
    }

    const result = await this.prisma.$queryRawUnsafe<TaxCategorySummary[]>(`
      SELECT 
        "userId",
        tax_year as "taxYear",
        category,
        deductible_total as "deductibleTotal",
        deductible_count as "deductibleCount",
        total_amount as "totalAmount",
        total_count as "totalCount",
        last_transaction_date as "lastTransactionDate"
      FROM tax_category_summary
      ${whereClause}
      ORDER BY tax_year DESC, deductible_total DESC
    `, ...params);

    return result;
  }

  /**
   * Get goal progress analytics from materialized view
   */
  async getGoalProgressAnalytics(
    userId: string,
    activeOnly = true
  ): Promise<GoalProgressAnalytics[]> {
    let whereClause = `WHERE "userId" = $1`;
    const params: any[] = [userId];
    
    if (activeOnly) {
      params.push(true);
      whereClause += ` AND "isActive" = $2`;
    }

    const result = await this.prisma.$queryRawUnsafe<GoalProgressAnalytics[]>(`
      SELECT 
        goal_id as "goalId",
        "userId",
        goal_name as "goalName",
        "targetAmount",
        "currentAmount",
        "targetDate",
        "createdAt",
        "isActive",
        transaction_count as "transactionCount",
        total_contributed as "totalContributed",
        progress_percentage as "progressPercentage",
        days_remaining as "daysRemaining",
        daily_target_amount as "dailyTargetAmount"
      FROM goal_progress_analytics
      ${whereClause}
      ORDER BY "isActive" DESC, progress_percentage DESC
    `, ...params);

    return result;
  }

  /**
   * Get user financial summary from materialized view
   */
  async getUserFinancialSummary(userId: string): Promise<UserFinancialSummary | null> {
    const result = await this.prisma.$queryRaw<UserFinancialSummary[]>`
      SELECT 
        user_id as "userId",
        email,
        name,
        total_transactions as "totalTransactions",
        total_goals as "totalGoals",
        total_receipts as "totalReceipts",
        active_bank_connections as "activeBankConnections",
        lifetime_spending as "lifetimeSpending",
        lifetime_deductibles as "lifetimeDeductibles",
        avg_transaction_amount as "avgTransactionAmount",
        last_transaction_date as "lastTransactionDate",
        last_bank_sync as "lastBankSync"
      FROM user_financial_summary
      WHERE user_id = ${userId}
      LIMIT 1
    `;

    return result[0] || null;
  }

  /**
   * Refresh all materialized views
   */
  async refreshViews(): Promise<void> {
    await this.prisma.$executeRaw`SELECT refresh_analytics_views()`;
  }

  /**
   * Get spending trends by category over time
   */
  async getCategoryTrends(
    userId: string,
    category: string,
    months = 12
  ): Promise<MonthlySpending[]> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    return this.prisma.$queryRaw<MonthlySpending[]>`
      SELECT 
        "userId",
        month,
        category,
        total_amount as "totalAmount",
        transaction_count as "transactionCount",
        avg_amount as "avgAmount",
        deductible_amount as "deductibleAmount",
        deductible_count as "deductibleCount"
      FROM monthly_spending_summary
      WHERE "userId" = ${userId}
        AND category = ${category}
        AND month >= ${startDate}
      ORDER BY month ASC
    `;
  }

  /**
   * Get top spending categories for a user
   */
  async getTopCategories(
    userId: string,
    limit = 10,
    deductibleOnly = false
  ): Promise<{ category: string; totalAmount: number; percentage: number }[]> {
    // Use separate queries for deductible vs total to avoid SQL injection
    if (deductibleOnly) {
      const result = await this.prisma.$queryRaw<any[]>`
        WITH user_total AS (
          SELECT SUM(deductible_amount) as total
          FROM monthly_spending_summary
          WHERE "userId" = ${userId}
        )
        SELECT 
          category,
          SUM(deductible_amount) as "totalAmount",
          (SUM(deductible_amount) / ut.total * 100) as percentage
        FROM monthly_spending_summary mss, user_total ut
        WHERE mss."userId" = ${userId}
        GROUP BY category, ut.total
        ORDER BY "totalAmount" DESC
        LIMIT ${limit}
      `;
      return result;
    } else {
      const result = await this.prisma.$queryRaw<any[]>`
        WITH user_total AS (
          SELECT SUM(total_amount) as total
          FROM monthly_spending_summary
          WHERE "userId" = ${userId}
        )
        SELECT 
          category,
          SUM(total_amount) as "totalAmount",
          (SUM(total_amount) / ut.total * 100) as percentage
        FROM monthly_spending_summary mss, user_total ut
        WHERE mss."userId" = ${userId}
        GROUP BY category, ut.total
        ORDER BY "totalAmount" DESC
        LIMIT ${limit}
      `;
      return result;
    }
  }
}