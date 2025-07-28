/**
 * Goal Repository
 *
 * Implements repository pattern for Goal entity
 * with business logic and validation
 */

import { Goal, Prisma } from '@prisma/client';
import { BaseRepository } from './base-repository';
import prisma from '../prisma';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface CreateGoalInput {
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  deadline: Date;
  category?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface UpdateGoalInput {
  name?: string;
  description?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: Date;
  category?: string;
  priority?: 'HIGH' | 'MEDIUM' | 'LOW';
  status?: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'CANCELLED';
}

export interface GoalWithMetrics extends Goal {
  progressPercentage: number;
  daysRemaining: number | null;
  isOverdue: boolean;
  monthlyTarget?: number;
}

// ============================================================================
// REPOSITORY IMPLEMENTATION
// ============================================================================

export class GoalRepository extends BaseRepository<Goal, CreateGoalInput, UpdateGoalInput> {
  protected model = prisma.goal;
  protected modelName = 'Goal';

  // ========================================
  // CUSTOM METHODS
  // ========================================

  /**
   * Find active goals for a user
   */
  async findActiveGoals(userId: string): Promise<GoalWithMetrics[]> {
    const result = await this.findMany({
      userId,
      where: {
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }],
    });

    return result.data.map((goal) => this.calculateMetrics(goal));
  }

  /**
   * Find goals by category
   */
  async findByCategory(userId: string, category: string): Promise<GoalWithMetrics[]> {
    const result = await this.findMany({
      userId,
      where: { category },
    });

    return result.data.map((goal) => this.calculateMetrics(goal));
  }

  /**
   * Get goal statistics for a user
   */
  async getStatistics(userId: string): Promise<{
    total: number;
    active: number;
    completed: number;
    totalTargetAmount: number;
    totalCurrentAmount: number;
    overallProgress: number;
  }> {
    const stats = await this.aggregate(
      {
        where: { status: { in: ['ACTIVE', 'COMPLETED'] } },
        _count: true,
        _sum: {
          targetAmount: true,
          currentAmount: true,
        },
      },
      userId,
    );

    const activeCount = await this.count({ status: 'ACTIVE' }, userId);
    const completedCount = await this.count({ status: 'COMPLETED' }, userId);

    const totalTarget = stats._sum.targetAmount || 0;
    const totalCurrent = stats._sum.currentAmount || 0;
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    return {
      total: stats._count,
      active: activeCount,
      completed: completedCount,
      totalTargetAmount: totalTarget,
      totalCurrentAmount: totalCurrent,
      overallProgress: Math.min(100, Math.round(overallProgress * 100) / 100),
    };
  }

  /**
   * Update goal progress
   */
  async updateProgress(id: string, amount: number, userId: string): Promise<GoalWithMetrics> {
    const goal = await this.findById(id, userId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (amount > goal.targetAmount) {
      throw new Error('Amount cannot exceed target amount');
    }

    // Update with automatic status change if completed
    const updates: UpdateGoalInput = {
      currentAmount: amount,
      ...(amount >= goal.targetAmount && { status: 'COMPLETED' }),
    };

    const updated = await this.update(id, updates, userId);
    return this.calculateMetrics(updated);
  }

  /**
   * Add amount to goal progress
   */
  async addProgress(id: string, amount: number, userId: string): Promise<GoalWithMetrics> {
    const goal = await this.findById(id, userId);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const newAmount = goal.currentAmount + amount;
    return this.updateProgress(id, newAmount, userId);
  }

  // ========================================
  // VALIDATION OVERRIDES
  // ========================================

  protected async validateCreate(data: CreateGoalInput, userId: string): Promise<void> {
    // Validate target amount
    if (data.targetAmount <= 0) {
      throw new Error('Target amount must be greater than zero');
    }

    // Validate current amount
    if (data.currentAmount && data.currentAmount < 0) {
      throw new Error('Current amount cannot be negative');
    }

    if (data.currentAmount && data.currentAmount > data.targetAmount) {
      throw new Error('Current amount cannot exceed target amount');
    }

    // Validate deadline
    if (new Date(data.deadline) <= new Date()) {
      throw new Error('Deadline must be in the future');
    }

    // Check user's goal limit
    const activeCount = await this.count(
      {
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
      userId,
    );

    if (activeCount >= 50) {
      throw new Error('Maximum number of active goals reached (50)');
    }
  }

  protected async validateUpdate(id: string, data: UpdateGoalInput, userId: string): Promise<void> {
    const existing = await this.findById(id, userId);
    if (!existing) {
      throw new Error('Goal not found');
    }

    // Validate target amount if provided
    if (data.targetAmount !== undefined) {
      if (data.targetAmount <= 0) {
        throw new Error('Target amount must be greater than zero');
      }

      // Check against current amount
      const currentAmount = data.currentAmount ?? existing.currentAmount;
      if (currentAmount > data.targetAmount) {
        throw new Error('Target amount cannot be less than current amount');
      }
    }

    // Validate current amount if provided
    if (data.currentAmount !== undefined) {
      if (data.currentAmount < 0) {
        throw new Error('Current amount cannot be negative');
      }

      const targetAmount = data.targetAmount ?? existing.targetAmount;
      if (data.currentAmount > targetAmount) {
        throw new Error('Current amount cannot exceed target amount');
      }
    }

    // Validate deadline if provided
    if (data.deadline && new Date(data.deadline) <= new Date()) {
      throw new Error('Deadline must be in the future');
    }

    // Prevent editing completed goals
    if (existing.status === 'COMPLETED' && !data.status) {
      throw new Error('Cannot edit completed goals');
    }
  }

  // ========================================
  // DATA TRANSFORMATION OVERRIDES
  // ========================================

  protected async transformCreateData(data: CreateGoalInput, userId: string): Promise<any> {
    return {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim(),
      currentAmount: data.currentAmount || 0,
      category: data.category || 'GENERAL',
      priority: data.priority || 'MEDIUM',
      status: 'ACTIVE',
    };
  }

  protected async transformUpdateData(data: UpdateGoalInput, userId: string): Promise<any> {
    const transformed: any = { ...data };

    if (transformed.name) {
      transformed.name = transformed.name.trim();
    }

    if (transformed.description) {
      transformed.description = transformed.description.trim();
    }

    transformed.updatedAt = new Date();

    return transformed;
  }

  protected transformRecord(record: any): Goal {
    return {
      ...record,
      targetAmount: Number(record.targetAmount),
      currentAmount: Number(record.currentAmount),
    };
  }

  // ========================================
  // CONFIGURATION OVERRIDES
  // ========================================

  protected getDefaultOrderBy(): any {
    return [{ status: 'asc' }, { priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'desc' }];
  }

  protected getMaxRecordsPerUser(): number {
    return 50; // Maximum 50 active goals per user
  }

  protected async getUniquenessConstraint(data: CreateGoalInput): Promise<
    | {
        field: string;
        value: any;
        message: string;
      }
    | undefined
  > {
    // No unique constraints for goals
    return undefined;
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  private calculateMetrics(goal: Goal): GoalWithMetrics {
    const progressPercentage =
      goal.targetAmount > 0
        ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100 * 100) / 100)
        : 0;

    const daysRemaining = goal.deadline
      ? Math.max(
          0,
          Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        )
      : null;

    const isOverdue = goal.deadline
      ? new Date(goal.deadline) < new Date() && goal.status === 'ACTIVE'
      : false;

    // Calculate monthly target if deadline exists
    let monthlyTarget: number | undefined;
    if (goal.deadline && goal.status === 'ACTIVE') {
      const remainingAmount = goal.targetAmount - goal.currentAmount;
      const monthsRemaining = Math.max(1, Math.ceil(daysRemaining! / 30));
      monthlyTarget = remainingAmount / monthsRemaining;
    }

    return {
      ...goal,
      progressPercentage,
      daysRemaining,
      isOverdue,
      monthlyTarget,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const goalRepository = new GoalRepository();
