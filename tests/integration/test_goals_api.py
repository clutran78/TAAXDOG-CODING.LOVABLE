"""
Integration Tests for Goals API with PostgreSQL/Prisma
=====================================================

Tests goal creation, retrieval, updates, and deletion using Prisma.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from prisma import Prisma
from prisma.models import Goal, User, GoalStatus


@pytest.fixture
async def prisma_client():
    """Create a test Prisma client"""
    prisma = Prisma()
    await prisma.connect()
    yield prisma
    await prisma.disconnect()


@pytest.fixture
async def test_user(prisma_client: Prisma):
    """Create a test user for goals"""
    user = await prisma_client.user.create(
        data={
            'email': 'goaltest@example.com',
            'name': 'Goal Test User',
            'role': 'USER',
            'taxResidency': 'RESIDENT'
        }
    )
    yield user
    # Cleanup
    await prisma_client.user.delete(where={'id': user.id})


@pytest.mark.asyncio
class TestGoalsAPI:
    """Test Goals API functionality with Prisma"""
    
    async def test_create_goal(self, prisma_client: Prisma, test_user: User):
        """Test creating a new goal"""
        goal_data = {
            'userId': test_user.id,
            'name': 'Emergency Fund',
            'targetAmount': Decimal('10000.00'),
            'currentAmount': Decimal('2500.00'),
            'dueDate': datetime.now() + timedelta(days=365),
            'category': 'Savings',
            'description': 'Build emergency savings fund',
            'status': GoalStatus.ACTIVE
        }
        
        goal = await prisma_client.goal.create(data=goal_data)
        
        assert goal.id is not None
        assert goal.name == 'Emergency Fund'
        assert goal.targetAmount == Decimal('10000.00')
        assert goal.currentAmount == Decimal('2500.00')
        assert goal.userId == test_user.id
        
        # Cleanup
        await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_fetch_user_goals(self, prisma_client: Prisma, test_user: User):
        """Test fetching all goals for a user"""
        # Create multiple goals
        goals_data = [
            {
                'userId': test_user.id,
                'name': 'Goal 1',
                'targetAmount': Decimal('5000.00'),
                'currentAmount': Decimal('1000.00'),
                'dueDate': datetime.now() + timedelta(days=180),
                'category': 'Savings',
                'status': GoalStatus.ACTIVE
            },
            {
                'userId': test_user.id,
                'name': 'Goal 2',
                'targetAmount': Decimal('3000.00'),
                'currentAmount': Decimal('500.00'),
                'dueDate': datetime.now() + timedelta(days=90),
                'category': 'Travel',
                'status': GoalStatus.ACTIVE
            }
        ]
        
        created_goals = []
        for data in goals_data:
            goal = await prisma_client.goal.create(data=data)
            created_goals.append(goal)
        
        # Fetch user goals
        user_goals = await prisma_client.goal.find_many(
            where={'userId': test_user.id},
            order_by=[
                {'status': 'asc'},
                {'dueDate': 'asc'}
            ]
        )
        
        assert len(user_goals) == 2
        assert all(goal.userId == test_user.id for goal in user_goals)
        
        # Cleanup
        for goal in created_goals:
            await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_update_goal_progress(self, prisma_client: Prisma, test_user: User):
        """Test updating goal progress"""
        # Create a goal
        goal = await prisma_client.goal.create(
            data={
                'userId': test_user.id,
                'name': 'Test Goal',
                'targetAmount': Decimal('5000.00'),
                'currentAmount': Decimal('1000.00'),
                'dueDate': datetime.now() + timedelta(days=180),
                'category': 'Savings',
                'status': GoalStatus.ACTIVE
            }
        )
        
        # Update progress
        new_amount = Decimal('2500.00')
        updated_goal = await prisma_client.goal.update(
            where={'id': goal.id},
            data={'currentAmount': new_amount}
        )
        
        assert updated_goal.currentAmount == new_amount
        
        # Test auto-completion when reaching target
        completed_goal = await prisma_client.goal.update(
            where={'id': goal.id},
            data={
                'currentAmount': Decimal('5000.00'),
                'status': GoalStatus.COMPLETED
            }
        )
        
        assert completed_goal.currentAmount == completed_goal.targetAmount
        assert completed_goal.status == GoalStatus.COMPLETED
        
        # Cleanup
        await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_update_goal_details(self, prisma_client: Prisma, test_user: User):
        """Test updating goal details"""
        # Create a goal
        goal = await prisma_client.goal.create(
            data={
                'userId': test_user.id,
                'name': 'Original Goal',
                'targetAmount': Decimal('5000.00'),
                'currentAmount': Decimal('0.00'),
                'dueDate': datetime.now() + timedelta(days=180),
                'category': 'Savings',
                'status': GoalStatus.ACTIVE
            }
        )
        
        # Update details
        updated_goal = await prisma_client.goal.update(
            where={'id': goal.id},
            data={
                'name': 'Updated Goal',
                'targetAmount': Decimal('7500.00'),
                'category': 'Investment',
                'description': 'Updated goal description'
            }
        )
        
        assert updated_goal.name == 'Updated Goal'
        assert updated_goal.targetAmount == Decimal('7500.00')
        assert updated_goal.category == 'Investment'
        assert updated_goal.description == 'Updated goal description'
        
        # Cleanup
        await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_delete_goal(self, prisma_client: Prisma, test_user: User):
        """Test deleting a goal"""
        # Create a goal
        goal = await prisma_client.goal.create(
            data={
                'userId': test_user.id,
                'name': 'Goal to Delete',
                'targetAmount': Decimal('1000.00'),
                'currentAmount': Decimal('0.00'),
                'dueDate': datetime.now() + timedelta(days=30),
                'category': 'Test',
                'status': GoalStatus.ACTIVE
            }
        )
        
        # Delete the goal
        await prisma_client.goal.delete(where={'id': goal.id})
        
        # Verify deletion
        deleted_goal = await prisma_client.goal.find_first(
            where={'id': goal.id}
        )
        
        assert deleted_goal is None
    
    async def test_goal_filtering_by_status(self, prisma_client: Prisma, test_user: User):
        """Test filtering goals by status"""
        # Create goals with different statuses
        goals_data = [
            {'status': GoalStatus.ACTIVE, 'name': 'Active Goal'},
            {'status': GoalStatus.COMPLETED, 'name': 'Completed Goal'},
            {'status': GoalStatus.PAUSED, 'name': 'Paused Goal'}
        ]
        
        created_goals = []
        for data in goals_data:
            goal = await prisma_client.goal.create(
                data={
                    'userId': test_user.id,
                    'name': data['name'],
                    'targetAmount': Decimal('1000.00'),
                    'currentAmount': Decimal('0.00'),
                    'dueDate': datetime.now() + timedelta(days=30),
                    'category': 'Test',
                    'status': data['status']
                }
            )
            created_goals.append(goal)
        
        # Test filtering by active status
        active_goals = await prisma_client.goal.find_many(
            where={
                'userId': test_user.id,
                'status': GoalStatus.ACTIVE
            }
        )
        
        assert len(active_goals) == 1
        assert active_goals[0].name == 'Active Goal'
        
        # Cleanup
        for goal in created_goals:
            await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_goal_progress_calculation(self, prisma_client: Prisma, test_user: User):
        """Test goal progress percentage calculation"""
        # Create a goal
        goal = await prisma_client.goal.create(
            data={
                'userId': test_user.id,
                'name': 'Progress Test',
                'targetAmount': Decimal('10000.00'),
                'currentAmount': Decimal('2500.00'),
                'dueDate': datetime.now() + timedelta(days=180),
                'category': 'Savings',
                'status': GoalStatus.ACTIVE
            }
        )
        
        # Calculate progress
        progress = (goal.currentAmount / goal.targetAmount) * 100
        assert progress == Decimal('25.00')
        
        # Update to 50% progress
        updated_goal = await prisma_client.goal.update(
            where={'id': goal.id},
            data={'currentAmount': Decimal('5000.00')}
        )
        
        new_progress = (updated_goal.currentAmount / updated_goal.targetAmount) * 100
        assert new_progress == Decimal('50.00')
        
        # Cleanup
        await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_concurrent_goal_updates(self, prisma_client: Prisma, test_user: User):
        """Test handling concurrent updates to the same goal"""
        # Create a goal
        goal = await prisma_client.goal.create(
            data={
                'userId': test_user.id,
                'name': 'Concurrent Test',
                'targetAmount': Decimal('5000.00'),
                'currentAmount': Decimal('1000.00'),
                'dueDate': datetime.now() + timedelta(days=90),
                'category': 'Test',
                'status': GoalStatus.ACTIVE
            }
        )
        
        # Simulate concurrent updates using transactions
        async def update_amount(amount: Decimal):
            async with prisma_client.tx() as tx:
                await tx.goal.update(
                    where={'id': goal.id},
                    data={'currentAmount': amount}
                )
        
        # Run concurrent updates
        await asyncio.gather(
            update_amount(Decimal('2000.00')),
            update_amount(Decimal('3000.00'))
        )
        
        # Check final state
        final_goal = await prisma_client.goal.find_first(
            where={'id': goal.id}
        )
        
        # One of the updates should have succeeded
        assert final_goal.currentAmount in [Decimal('2000.00'), Decimal('3000.00')]
        
        # Cleanup
        await prisma_client.goal.delete(where={'id': goal.id})
    
    async def test_goal_statistics(self, prisma_client: Prisma, test_user: User):
        """Test calculating goal statistics for a user"""
        # Create multiple goals with different statuses and amounts
        goals_data = [
            {
                'name': 'Goal 1',
                'targetAmount': Decimal('5000.00'),
                'currentAmount': Decimal('2500.00'),
                'status': GoalStatus.ACTIVE
            },
            {
                'name': 'Goal 2',
                'targetAmount': Decimal('3000.00'),
                'currentAmount': Decimal('3000.00'),
                'status': GoalStatus.COMPLETED
            },
            {
                'name': 'Goal 3',
                'targetAmount': Decimal('2000.00'),
                'currentAmount': Decimal('500.00'),
                'status': GoalStatus.ACTIVE
            }
        ]
        
        created_goals = []
        for data in goals_data:
            goal = await prisma_client.goal.create(
                data={
                    'userId': test_user.id,
                    'name': data['name'],
                    'targetAmount': data['targetAmount'],
                    'currentAmount': data['currentAmount'],
                    'dueDate': datetime.now() + timedelta(days=180),
                    'category': 'Test',
                    'status': data['status']
                }
            )
            created_goals.append(goal)
        
        # Calculate statistics
        all_goals = await prisma_client.goal.find_many(
            where={'userId': test_user.id}
        )
        
        total_target = sum(goal.targetAmount for goal in all_goals)
        total_current = sum(goal.currentAmount for goal in all_goals)
        active_count = len([g for g in all_goals if g.status == GoalStatus.ACTIVE])
        completed_count = len([g for g in all_goals if g.status == GoalStatus.COMPLETED])
        
        assert total_target == Decimal('10000.00')
        assert total_current == Decimal('6000.00')
        assert active_count == 2
        assert completed_count == 1
        
        # Cleanup
        for goal in created_goals:
            await prisma_client.goal.delete(where={'id': goal.id})


if __name__ == '__main__':
    pytest.main([__file__, '-v'])