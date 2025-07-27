import { GoalService } from '@/lib/goals/goal-service';
import { prisma } from '@/lib/prisma';

async function testGoalsAPI() {
  console.log('Testing Goals API with PostgreSQL...\n');

  try {
    // Test 1: Create a test user
    const testUser = await prisma.user.create({
      data: {
        email: 'goaltest@example.com',
        name: 'Goal Test User',
        password: 'hashedpassword',
      },
    });
    console.log('✅ Created test user:', testUser.id);

    // Test 2: Create a goal
    const newGoal = await GoalService.createGoal(testUser.id, {
      title: 'Emergency Fund',
      targetAmount: 10000,
      targetDate: new Date('2024-12-31'),
      category: 'Savings',
      currentAmount: 2500,
    });
    console.log('✅ Created goal:', newGoal.id);

    // Test 3: Fetch all goals
    const goals = await GoalService.fetchGoals(testUser.id);
    console.log('✅ Fetched goals:', goals.length);

    // Test 4: Update goal progress
    const updatedGoal = await GoalService.updateGoalProgress(newGoal.id, 3500);
    console.log('✅ Updated goal progress:', updatedGoal.currentAmount.toString());

    // Test 5: Update goal details
    const editedGoal = await GoalService.updateGoal(newGoal.id, {
      title: 'Emergency Fund - Updated',
      targetAmount: 12000,
    });
    console.log('✅ Updated goal details:', editedGoal.title);

    // Test 6: Get goal stats
    const stats = await GoalService.getGoalStats(testUser.id);
    console.log('✅ Goal stats:', stats);

    // Test 7: Delete goal
    await GoalService.deleteGoal(newGoal.id);
    console.log('✅ Deleted goal');

    // Cleanup: Delete test user
    await prisma.user.delete({
      where: { id: testUser.id },
    });
    console.log('✅ Cleaned up test user');

    console.log('\n✅ All tests passed! Goals API is working correctly with PostgreSQL.');
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testGoalsAPI();
