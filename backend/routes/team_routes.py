"""
TAAXDOG Team Collaboration Routes
API endpoints for team management and collaborative features.
"""

from flask import Blueprint, request, jsonify
import asyncio
import logging
from datetime import datetime
import sys
import os

# Add parent directory to path for cross-module imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

try:
    from team_collaboration import team_collaboration_manager, TeamRole
    from subscription_manager import subscription_manager, FeatureAccess
    from utils.auth_middleware import require_auth
    from utils.validators import validate_json
except ImportError:
    # Fallback for development mode
    team_collaboration_manager = None
    subscription_manager = None
    class TeamRole: pass
    class FeatureAccess: pass
    def require_auth(func): return func
    def validate_json(*args): return lambda func: func

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

team_bp = Blueprint('team', __name__)

@team_bp.route('/api/team/create', methods=['POST'])
@require_auth
def create_team():
    """Create a new team"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['team_name']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        team_name = data['team_name']
        description = data.get('description', '')
        
        # Check feature access
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            has_access = loop.run_until_complete(
                subscription_manager.check_feature_access(user_id, FeatureAccess.TEAM_COLLABORATION)
            )
            
            if not has_access:
                return jsonify({
                    'success': False,
                    'error': 'Business subscription required for team collaboration',
                    'upgrade_required': True
                }), 403
            
            # Create team
            result = loop.run_until_complete(
                team_collaboration_manager.create_team(user_id, team_name, description)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error creating team for user {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to create team'
        }), 500

@team_bp.route('/api/team/<team_id>/invite', methods=['POST'])
@require_auth
def invite_member(team_id):
    """Invite a new member to the team"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['email', 'role']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        email = data['email']
        role_str = data['role']
        
        # Validate role
        try:
            role = TeamRole(role_str)
        except ValueError:
            return jsonify({
                'success': False,
                'error': f'Invalid role: {role_str}'
            }), 400
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Invite member
            result = loop.run_until_complete(
                team_collaboration_manager.invite_member(team_id, user_id, email, role)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error inviting member to team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to invite member'
        }), 500

@team_bp.route('/api/team/invitation/<invitation_id>/accept', methods=['POST'])
@require_auth
def accept_invitation(invitation_id):
    """Accept a team invitation"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            # Accept invitation
            result = loop.run_until_complete(
                team_collaboration_manager.accept_invitation(invitation_id, user_id)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error accepting invitation {invitation_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to accept invitation'
        }), 500

@team_bp.route('/api/team/<team_id>/members', methods=['GET'])
@require_auth
def get_team_members(team_id):
    """Get all team members"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                team_collaboration_manager.get_team_members(team_id, user_id)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting team members for team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get team members'
        }), 500

@team_bp.route('/api/team/<team_id>/members/<member_id>', methods=['DELETE'])
@require_auth
def remove_member(team_id, member_id):
    """Remove a member from the team"""
    try:
        user_id = request.user_id
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                team_collaboration_manager.remove_member(team_id, user_id, member_id)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error removing member {member_id} from team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to remove member'
        }), 500

@team_bp.route('/api/team/<team_id>/members/<member_id>/role', methods=['PUT'])
@require_auth
def update_member_role(team_id, member_id):
    """Update a member's role"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        if 'role' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: role'
            }), 400
        
        role_str = data['role']
        
        # Validate role
        try:
            role = TeamRole(role_str)
        except ValueError:
            return jsonify({
                'success': False,
                'error': f'Invalid role: {role_str}'
            }), 400
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                team_collaboration_manager.update_member_role(team_id, user_id, member_id, role)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error updating member role for {member_id} in team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to update member role'
        }), 500

@team_bp.route('/api/team/<team_id>/activity', methods=['GET'])
@require_auth
def get_team_activity(team_id):
    """Get team activity log"""
    try:
        user_id = request.user_id
        limit = int(request.args.get('limit', 50))
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                team_collaboration_manager.get_team_activity(team_id, user_id, limit)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error getting team activity for team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get team activity'
        }), 500

@team_bp.route('/api/team/<team_id>/share-report', methods=['POST'])
@require_auth
def share_report_with_team(team_id):
    """Share a report with team members"""
    try:
        user_id = request.user_id
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['report_data']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'Missing required field: {field}'
                }), 400
        
        report_data = data['report_data']
        
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            result = loop.run_until_complete(
                team_collaboration_manager.share_report_with_team(team_id, user_id, report_data)
            )
            
            return jsonify(result)
            
        finally:
            loop.close()
            
    except Exception as e:
        logger.error(f"Error sharing report with team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to share report'
        }), 500

@team_bp.route('/api/team/my-teams', methods=['GET'])
@require_auth
def get_user_teams():
    """Get all teams the user is a member of"""
    try:
        user_id = request.user_id
        
        # This would typically query the database for teams where the user is a member
        # For now, return a placeholder response
        
        return jsonify({
            'success': True,
            'teams': [],
            'message': 'Team listing not yet fully implemented'
        })
        
    except Exception as e:
        logger.error(f"Error getting user teams for {user_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get user teams'
        }), 500

@team_bp.route('/api/team/<team_id>/permissions', methods=['GET'])
@require_auth
def get_user_permissions(team_id):
    """Get current user's permissions in the team"""
    try:
        user_id = request.user_id
        
        # This would check the user's role and return their permissions
        # For now, return a placeholder response
        
        return jsonify({
            'success': True,
            'permissions': [],
            'message': 'Permission checking not yet fully implemented'
        })
        
    except Exception as e:
        logger.error(f"Error getting user permissions for team {team_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get user permissions'
        }), 500

@team_bp.route('/api/shared-reports/<report_id>', methods=['GET'])
@require_auth
def get_shared_report(report_id):
    """Get a shared report"""
    try:
        user_id = request.user_id
        
        # This would fetch the shared report and verify access
        # For now, return a placeholder response
        
        return jsonify({
            'success': True,
            'report': {},
            'message': 'Shared report access not yet fully implemented'
        })
        
    except Exception as e:
        logger.error(f"Error getting shared report {report_id}: {e}")
        return jsonify({
            'success': False,
            'error': 'Failed to get shared report'
        }), 500 