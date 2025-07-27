import { prisma } from '../prisma';
import { Goal, Prisma } from '@prisma/client';
import {
  withTransaction,
  createSecure,
  updateSecure,
  softDeleteSecure,
  validateUserOwnership,
  handleDatabaseError,
} from '../db/query-patterns';

// Types
export enum GoalStatus {
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  PAUSED = 'PAUSED',
  CANCELLED = 'CANCELLED',
}

export enum GoalCategory {
  SAVINGS = 'SAVINGS',
  INVESTMENT = 'INVESTMENT',
  PURCHASE = 'PURCHASE',
  DEBT_PAYOFF = 'DEBT_PAYOFF',
  EMERGENCY_FUND = 'EMERGENCY_FUND',
  VACATION = 'VACATION',
  EDUCATION = 'EDUCATION',
  RETIREMENT = 'RETIREMENT',
  GENERAL = 'GENERAL',
}

export interface CreateGoalData {
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  deadline: Date;
  category?: GoalCategory | string;
}

export interface UpdateGoalData {
  name?: string;
  description?: string;
  targetAmount?: number;
  currentAmount?: number;
  deadline?: Date;
  category?: GoalCategory | string;
  status?: GoalStatus;
}

export interface GoalWithProgress extends Goal {
  progress: number;
  daysRemaining: number | null;
  isOverdue: boolean;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates progress metrics for a goal
 * @param goal - The goal to calculate metrics for
 * @returns Goal with progress percentage, days remaining, and overdue status
 */
function calculateGoalMetrics(goal: Goal): GoalWithProgress {
  // Calculate progress percentage (0-100)
  const progressPercentage = calculateProgressPercentage(goal.currentAmount, goal.targetAmount);

  // Calculate days until deadline
  const daysRemaining = calculateDaysRemaining(goal.deadline);

  // Check if goal is overdue
  const isOverdue = isGoalOverdue(goal.deadline);

  return {
    ...goal,
    progress: progressPercentage,
    daysRemaining,
    isOverdue,
  };
}

/**
 * Calculates progress as a percentage
 */
function calculateProgressPercentage(current: number, target: number): number {
  if (target <= 0) {
    return 0;
  }

  const rawPercentage = (current / target) * 100;
  const clampedPercentage = Math.min(100, rawPercentage);

  // Round to 2 decimal places
  return Math.round(clampedPercentage * 100) / 100;
}

/**
 * Calculates days remaining until deadline
 */
function calculateDaysRemaining(deadline: Date | null): number | null {
  if (!deadline) {
    return null;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const deadlineTime = new Date(deadline).getTime();
  const currentTime = Date.now();
  const daysDifference = (deadlineTime - currentTime) / millisecondsPerDay;

  // Return 0 if deadline has passed, otherwise ceil the days
  return Math.max(0, Math.ceil(daysDifference));
}

/**
 * Checks if a goal is overdue
 */
function isGoalOverdue(deadline: Date | null): boolean {
  if (!deadline) {
    return false;
  }

  return new Date(deadline) < new Date();
}

/**
 * Validates that a user owns a specific goal
 * @param goalId - The ID of the goal to validate
 * @param userId - The ID of the user claiming ownership
 * @returns The goal if ownership is valid
 * @throws Error if goal not found or user doesn't own it
 */
async function validateGoalOwnership(goalId: string, userId: string): Promise<Goal> {
  const goal = await prisma.goal.findFirst({
    where: {
      id: goalId,
      userId: userId,
      deletedAt: null,
    },
  });

  if (!goal) {
    throw new Error('Goal not found or access denied');
  }

  return goal;
}

// Main functions
/**
 * Fetches goals for a user with optional filtering
 * @param userId - The ID of the user whose goals to fetch
 * @param options - Optional filters for status, category, pagination
 * @returns Array of goals with progress metrics and total count
 */
export async function fetchGoals(
  userId: string,
  options?: {
    status?: GoalStatus;
    category?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ goals: GoalWithProgress[]; total: number }> {
  // Build query filters
  const queryFilters = buildGoalQueryFilters(userId, options);

  // Set pagination defaults
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Fetch goals and count in parallel for efficiency
  const [goals, total] = await Promise.all([
    prisma.goal.findMany({
      where: queryFilters,
      orderBy: [
        { status: 'asc' }, // Active goals first
        { deadline: 'asc' }, // Nearest deadlines first
        { createdAt: 'desc' }, // Newest first
      ],
      take: limit,
      skip: offset,
    }),
    prisma.goal.count({ where: queryFilters }),
  ]);

  // Add progress metrics to each goal
  const goalsWithProgress = goals.map(calculateGoalMetrics);

  return {
    goals: goalsWithProgress,
    total,
  };
}

/**
 * Builds query filters for goal searches
 */
function buildGoalQueryFilters(
  userId: string,
  options?: { status?: GoalStatus; category?: string },
): Prisma.GoalWhereInput {
  const filters: Prisma.GoalWhereInput = {
    userId: userId,
    deletedAt: null, // Exclude soft-deleted goals
  };

  if (options?.status) {
    filters.status = options.status;
  }

  if (options?.category) {
    filters.category = options.category;
  }

  return filters;
}

/**
 * Creates a new financial goal for a user
 * @param userId - The ID of the user creating the goal
 * @param goalData - The goal details
 * @returns The created goal with progress metrics
 * @throws Error if validation fails or user has too many goals
 */
export async function createGoal(
  userId: string,
  goalData: CreateGoalData,
): Promise<GoalWithProgress> {
  try {
    // Step 1: Validate goal data
    validateGoalData(goalData);

    // Step 2: Create goal within a transaction for consistency
    const goal = await withTransaction(async (tx) => {
      // Check if user has reached goal limit
      await checkUserGoalLimit(tx, userId);

      // Prepare goal data
      const preparedData = prepareGoalData(goalData);

      // Create the goal with audit logging
      return await createSecure(tx.goal, preparedData, userId, {
        auditLog: true,
      });
    });

    // Step 3: Return goal with calculated metrics
    return calculateGoalMetrics(goal);
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'createGoal',
      userId,
      resource: 'Goal',
    });
    throw error;
  }
}

/**
 * Validates goal creation data
 */
function validateGoalData(data: CreateGoalData): void {
  // Validate target amount
  if (data.targetAmount <= 0) {
    throw new Error('Target amount must be greater than zero');
  }

  // Validate current vs target amount
  if (data.currentAmount && data.currentAmount > data.targetAmount) {
    throw new Error('Current amount cannot exceed target amount');
  }

  // Validate deadline is in the future
  const deadlineDate = new Date(data.deadline);
  const today = new Date();

  if (deadlineDate <= today) {
    throw new Error('Deadline must be in the future');
  }
}

/**
 * Checks if user has reached their goal limit
 */
async function checkUserGoalLimit(tx: any, userId: string): Promise<void> {
  const MAX_ACTIVE_GOALS = 50;

  const activeGoalsCount = await tx.goal.count({
    where: {
      userId: userId,
      status: {
        in: [GoalStatus.ACTIVE, GoalStatus.PAUSED],
      },
      deletedAt: null,
    },
  });

  if (activeGoalsCount >= MAX_ACTIVE_GOALS) {
    throw new Error(`Maximum number of active goals reached (${MAX_ACTIVE_GOALS})`);
  }
}

/**
 * Prepares goal data for database insertion
 */
function prepareGoalData(data: CreateGoalData): any {
  return {
    name: data.name.trim(),
    description: data.description?.trim() || null,
    targetAmount: data.targetAmount,
    currentAmount: data.currentAmount || 0,
    deadline: data.deadline,
    category: data.category || GoalCategory.GENERAL,
    status: GoalStatus.ACTIVE,
  };
}

export async function updateGoal(
  goalId: string,
  userId: string,
  updates: UpdateGoalData,
): Promise<GoalWithProgress> {
  try {
    // Use transaction for consistency
    const goal = await withTransaction(async (tx) => {
      // Validate ownership within transaction
      const existingGoal = await validateUserOwnership<Goal>(tx.goal, goalId, userId, 'Goal');

      // Validate updates
      if (updates.targetAmount !== undefined && updates.targetAmount <= 0) {
        throw new Error('Target amount must be greater than zero');
      }

      const newTargetAmount = updates.targetAmount ?? existingGoal.targetAmount;
      const newCurrentAmount = updates.currentAmount ?? existingGoal.currentAmount;

      if (newCurrentAmount > newTargetAmount) {
        throw new Error('Current amount cannot exceed target amount');
      }

      if (updates.deadline && new Date(updates.deadline) <= new Date()) {
        throw new Error('Deadline must be in the future');
      }

      // Update goal using standardized pattern
      return await updateSecure(
        tx.goal,
        goalId,
        {
          ...updates,
          updatedAt: new Date(),
        },
        userId,
        {
          auditLog: true,
        },
      );
    });

    return calculateGoalMetrics(goal);
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'updateGoal',
      userId,
      resource: 'Goal',
    });
    throw error;
  }
}

export async function deleteGoal(goalId: string, userId: string): Promise<void> {
  try {
    await withTransaction(async (tx) => {
      // Validate ownership within transaction
      await validateUserOwnership<Goal>(tx.goal, goalId, userId, 'Goal');

      // Soft delete using standardized pattern
      await softDeleteSecure(tx.goal, goalId, userId, {
        auditLog: true,
      });

      // Update status to cancelled
      await tx.goal.update({
        where: { id: goalId },
        data: { status: GoalStatus.CANCELLED },
      });
    });
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'deleteGoal',
      userId,
      resource: 'Goal',
    });
    throw error;
  }
}

/**
 * Updates the progress amount for a goal
 * @param goalId - The ID of the goal to update
 * @param userId - The ID of the user making the update
 * @param progress - The new progress amount
 * @returns The updated goal with progress metrics
 * @throws Error if validation fails
 */
export async function updateGoalProgress(
  goalId: string,
  userId: string,
  progress: number,
): Promise<GoalWithProgress> {
  try {
    const goal = await withTransaction(async (tx) => {
      // Step 1: Validate ownership and get existing goal
      const existingGoal = await validateUserOwnership<Goal>(tx.goal, goalId, userId, 'Goal');

      // Step 2: Validate progress amount
      validateProgressAmount(progress, existingGoal.targetAmount);

      // Step 3: Update progress amount
      let updatedGoal = await updateSecure(
        tx.goal,
        goalId,
        {
          currentAmount: progress,
          updatedAt: new Date(),
        },
        userId,
        {
          auditLog: true,
        },
      );

      // Step 4: Auto-complete goal if target reached
      if (shouldAutoCompleteGoal(progress, existingGoal)) {
        updatedGoal = await tx.goal.update({
          where: {
            id: goalId,
            userId: userId,
          },
          data: {
            status: GoalStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      return updatedGoal;
    });

    return calculateGoalMetrics(goal);
  } catch (error) {
    await handleDatabaseError(error, {
      operation: 'updateGoalProgress',
      userId,
      resource: 'Goal',
    });
    throw error;
  }
}

/**
 * Validates that progress amount is valid
 */
function validateProgressAmount(progress: number, targetAmount: number): void {
  if (progress < 0) {
    throw new Error('Progress cannot be negative');
  }

  if (progress > targetAmount) {
    throw new Error('Progress cannot exceed target amount');
  }
}

/**
 * Determines if a goal should be auto-completed
 */
function shouldAutoCompleteGoal(progress: number, goal: Goal): boolean {
  const targetReached = progress >= goal.targetAmount;
  const isCurrentlyActive = goal.status === GoalStatus.ACTIVE;

  return targetReached && isCurrentlyActive;
}

/**
 * Gets a single goal by ID if user owns it
 * @param goalId - The ID of the goal to retrieve
 * @param userId - The ID of the user requesting the goal
 * @returns The goal with progress metrics, or null if not found/unauthorized
 */
export async function getGoal(goalId: string, userId: string): Promise<GoalWithProgress | null> {
  try {
    const goal = await validateGoalOwnership(goalId, userId);
    return calculateGoalMetrics(goal);
  } catch {
    // Return null for any error (not found or unauthorized)
    return null;
  }
}

export async function getActiveGoals(userId: string): Promise<GoalWithProgress[]> {
  const goals = await prisma.goal.findMany({
    where: {
      userId: userId,
      status: GoalStatus.ACTIVE,
      deletedAt: null,
    },
    orderBy: {
      deadline: 'asc',
    },
  });

  return goals.map(calculateGoalMetrics);
}

export async function getGoalsByCategory(
  userId: string,
  category: string,
): Promise<GoalWithProgress[]> {
  const goals = await prisma.goal.findMany({
    where: {
      userId: userId,
      category: category,
      deletedAt: null,
    },
    orderBy: [{ status: 'asc' }, { deadline: 'asc' }],
  });

  return goals.map(calculateGoalMetrics);
}

/**
 * Gets comprehensive statistics for a user's goals
 * @param userId - The ID of the user
 * @returns Object containing goal statistics and metrics
 */
export async function getGoalStats(userId: string) {
  // Fetch all user goals
  const goals = await prisma.goal.findMany({
    where: {
      userId: userId,
      deletedAt: null,
    },
  });

  // Group goals by status for easier calculation
  const goalsByStatus = groupGoalsByStatus(goals);

  // Calculate aggregate statistics
  const aggregateStats = calculateAggregateStats(goals);

  // Calculate progress metrics
  const progressMetrics = calculateProgressMetrics(goals, goalsByStatus.active);

  return {
    // Count statistics
    total: goals.length,
    active: goalsByStatus.active.length,
    completed: goalsByStatus.completed.length,
    paused: goalsByStatus.paused.length,
    cancelled: goalsByStatus.cancelled.length,

    // Financial statistics
    ...aggregateStats,

    // Progress metrics
    ...progressMetrics,
  };
}

/**
 * Groups goals by their status
 */
function groupGoalsByStatus(goals: Goal[]) {
  return {
    active: goals.filter((g) => g.status === GoalStatus.ACTIVE),
    completed: goals.filter((g) => g.status === GoalStatus.COMPLETED),
    paused: goals.filter((g) => g.status === GoalStatus.PAUSED),
    cancelled: goals.filter((g) => g.status === GoalStatus.CANCELLED),
  };
}

/**
 * Calculates aggregate financial statistics
 */
function calculateAggregateStats(goals: Goal[]) {
  const totalTargetAmount = goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalCurrentAmount = goals.reduce((sum, g) => sum + g.currentAmount, 0);

  return {
    totalTargetAmount,
    totalCurrentAmount,
  };
}

/**
 * Calculates progress-related metrics
 */
function calculateProgressMetrics(allGoals: Goal[], activeGoals: Goal[]) {
  const hasGoals = allGoals.length > 0;

  // Overall progress percentage
  const overallProgress = hasGoals ? calculateOverallProgress(allGoals) : 0;

  // Completion rate percentage
  const completionRate = hasGoals ? calculateCompletionRate(allGoals) : 0;

  // Active goals metrics
  const activeGoalsValue = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const activeGoalsProgress = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);

  return {
    overallProgress,
    completionRate,
    activeGoalsValue,
    activeGoalsProgress,
  };
}

/**
 * Calculates overall progress across all goals
 */
function calculateOverallProgress(goals: Goal[]): number {
  const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

  if (totalTarget === 0) {
    return 0;
  }

  const progressPercentage = (totalCurrent / totalTarget) * 100;
  return Math.round(progressPercentage * 100) / 100;
}

/**
 * Calculates completion rate percentage
 */
function calculateCompletionRate(goals: Goal[]): number {
  const completedCount = goals.filter((g) => g.status === GoalStatus.COMPLETED).length;
  const completionPercentage = (completedCount / goals.length) * 100;

  return Math.round(completionPercentage * 100) / 100;
}

// Export default object for compatibility
export default {
  fetchGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  updateGoalProgress,
  getGoal,
  getActiveGoals,
  getGoalsByCategory,
  getGoalStats,
};
