"""
TAAXDOG Team Collaboration System
Advanced team management and collaborative features for business users and tax agents.
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import uuid
from firebase_config import db

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TeamRole(Enum):
    OWNER = "owner"
    ADMIN = "admin"
    ACCOUNTANT = "accountant"
    BOOKKEEPER = "bookkeeper"
    VIEWER = "viewer"
    TAX_AGENT = "tax_agent"

class PermissionLevel(Enum):
    READ = "read"
    WRITE = "write"
    ADMIN = "admin"
    FULL = "full"

class ActivityType(Enum):
    RECEIPT_UPLOADED = "receipt_uploaded"
    TRANSACTION_CATEGORIZED = "transaction_categorized"
    REPORT_GENERATED = "report_generated"
    EXPENSE_ADDED = "expense_added"
    MEMBER_INVITED = "member_invited"
    MEMBER_REMOVED = "member_removed"
    PERMISSIONS_CHANGED = "permissions_changed"
    SETTINGS_UPDATED = "settings_updated"

@dataclass
class TeamMember:
    user_id: str
    email: str
    name: str
    role: TeamRole
    permissions: List[str]
    invited_by: str
    invited_at: datetime
    last_active: Optional[datetime] = None
    status: str = "active"  # active, pending, suspended

@dataclass
class TeamPermissions:
    can_view_transactions: bool = True
    can_categorize_transactions: bool = False
    can_upload_receipts: bool = False
    can_generate_reports: bool = False
    can_manage_members: bool = False
    can_edit_settings: bool = False
    can_access_tax_data: bool = False
    can_submit_bas: bool = False

@dataclass
class TeamActivity:
    id: str
    team_id: str
    user_id: str
    user_name: str
    activity_type: ActivityType
    description: str
    metadata: Dict[str, Any]
    timestamp: datetime

@dataclass
class TeamInvitation:
    id: str
    team_id: str
    email: str
    role: TeamRole
    invited_by: str
    invited_at: datetime
    expires_at: datetime
    status: str = "pending"  # pending, accepted, expired, cancelled

class TeamCollaborationManager:
    """Advanced team collaboration and management system"""
    
    def __init__(self):
        self.db = db
    
    async def create_team(self, owner_id: str, team_name: str, description: str = "") -> Dict[str, Any]:
        """Create a new team"""
        try:
            team_id = str(uuid.uuid4())
            
            # Get owner user details
            owner_doc = self.db.collection('users').document(owner_id).get()
            if not owner_doc.exists:
                return {'success': False, 'error': 'Owner user not found'}
            
            owner_data = owner_doc.to_dict()
            
            # Create team document
            team_data = {
                'id': team_id,
                'name': team_name,
                'description': description,
                'owner_id': owner_id,
                'created_at': datetime.now(),
                'updated_at': datetime.now(),
                'status': 'active',
                'settings': {
                    'require_approval_for_expenses': True,
                    'auto_categorization_enabled': True,
                    'receipt_approval_required': False,
                    'audit_trail_enabled': True
                }
            }
            
            # Add owner as first team member
            owner_member = TeamMember(
                user_id=owner_id,
                email=owner_data.get('email', ''),
                name=owner_data.get('displayName', 'Owner'),
                role=TeamRole.OWNER,
                permissions=self._get_role_permissions(TeamRole.OWNER),
                invited_by=owner_id,
                invited_at=datetime.now(),
                last_active=datetime.now()
            )
            
            # Store in database
            self.db.collection('teams').document(team_id).set(team_data)
            self.db.collection('teams').document(team_id).collection('members').document(owner_id).set(
                self._member_to_dict(owner_member)
            )
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=owner_id,
                user_name=owner_member.name,
                activity_type=ActivityType.SETTINGS_UPDATED,
                description=f"Team '{team_name}' created",
                metadata={'team_name': team_name}
            )
            
            return {
                'success': True,
                'team_id': team_id,
                'team': team_data
            }
            
        except Exception as e:
            logger.error(f"Error creating team: {e}")
            return {'success': False, 'error': str(e)}
    
    async def invite_member(
        self, 
        team_id: str, 
        inviter_id: str, 
        email: str, 
        role: TeamRole
    ) -> Dict[str, Any]:
        """Invite a new member to the team"""
        try:
            # Check if inviter has permission
            if not await self._check_permission(team_id, inviter_id, 'can_manage_members'):
                return {'success': False, 'error': 'Insufficient permissions to invite members'}
            
            # Check if user is already a member
            existing_member = self.db.collection('teams').document(team_id).collection('members').where('email', '==', email).get()
            if existing_member:
                return {'success': False, 'error': 'User is already a team member'}
            
            # Create invitation
            invitation_id = str(uuid.uuid4())
            invitation = TeamInvitation(
                id=invitation_id,
                team_id=team_id,
                email=email,
                role=role,
                invited_by=inviter_id,
                invited_at=datetime.now(),
                expires_at=datetime.now() + timedelta(days=7)  # 7 day expiry
            )
            
            # Store invitation
            self.db.collection('team_invitations').document(invitation_id).set(
                self._invitation_to_dict(invitation)
            )
            
            # Get inviter details
            inviter_doc = self.db.collection('users').document(inviter_id).get()
            inviter_name = inviter_doc.to_dict().get('displayName', 'Team member') if inviter_doc.exists else 'Team member'
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=inviter_id,
                user_name=inviter_name,
                activity_type=ActivityType.MEMBER_INVITED,
                description=f"Invited {email} as {role.value}",
                metadata={'email': email, 'role': role.value}
            )
            
            # TODO: Send invitation email
            
            return {
                'success': True,
                'invitation_id': invitation_id,
                'invitation': self._invitation_to_dict(invitation)
            }
            
        except Exception as e:
            logger.error(f"Error inviting member: {e}")
            return {'success': False, 'error': str(e)}
    
    async def accept_invitation(self, invitation_id: str, user_id: str) -> Dict[str, Any]:
        """Accept a team invitation"""
        try:
            # Get invitation
            invitation_doc = self.db.collection('team_invitations').document(invitation_id).get()
            if not invitation_doc.exists:
                return {'success': False, 'error': 'Invitation not found'}
            
            invitation_data = invitation_doc.to_dict()
            
            # Check if invitation is still valid
            if invitation_data['status'] != 'pending':
                return {'success': False, 'error': 'Invitation is no longer valid'}
            
            if datetime.fromisoformat(invitation_data['expires_at']) < datetime.now():
                return {'success': False, 'error': 'Invitation has expired'}
            
            # Get user details
            user_doc = self.db.collection('users').document(user_id).get()
            if not user_doc.exists:
                return {'success': False, 'error': 'User not found'}
            
            user_data = user_doc.to_dict()
            
            # Create team member
            member = TeamMember(
                user_id=user_id,
                email=user_data.get('email', ''),
                name=user_data.get('displayName', 'Team member'),
                role=TeamRole(invitation_data['role']),
                permissions=self._get_role_permissions(TeamRole(invitation_data['role'])),
                invited_by=invitation_data['invited_by'],
                invited_at=datetime.fromisoformat(invitation_data['invited_at']),
                last_active=datetime.now()
            )
            
            # Add to team
            team_id = invitation_data['team_id']
            self.db.collection('teams').document(team_id).collection('members').document(user_id).set(
                self._member_to_dict(member)
            )
            
            # Update invitation status
            self.db.collection('team_invitations').document(invitation_id).update({
                'status': 'accepted',
                'accepted_at': datetime.now()
            })
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=user_id,
                user_name=member.name,
                activity_type=ActivityType.MEMBER_INVITED,
                description=f"{member.name} joined the team as {member.role.value}",
                metadata={'role': member.role.value}
            )
            
            return {
                'success': True,
                'team_id': team_id,
                'member': self._member_to_dict(member)
            }
            
        except Exception as e:
            logger.error(f"Error accepting invitation: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_team_members(self, team_id: str, user_id: str) -> Dict[str, Any]:
        """Get all team members"""
        try:
            # Check if user is a team member
            member_doc = self.db.collection('teams').document(team_id).collection('members').document(user_id).get()
            if not member_doc.exists:
                return {'success': False, 'error': 'Access denied'}
            
            # Get all members
            members_ref = self.db.collection('teams').document(team_id).collection('members')
            members_docs = members_ref.get()
            
            members = []
            for doc in members_docs:
                member_data = doc.to_dict()
                members.append(member_data)
            
            return {
                'success': True,
                'members': members
            }
            
        except Exception as e:
            logger.error(f"Error getting team members: {e}")
            return {'success': False, 'error': str(e)}
    
    async def remove_member(self, team_id: str, remover_id: str, member_id: str) -> Dict[str, Any]:
        """Remove a member from the team"""
        try:
            # Check permissions
            if not await self._check_permission(team_id, remover_id, 'can_manage_members'):
                return {'success': False, 'error': 'Insufficient permissions to remove members'}
            
            # Cannot remove owner
            team_doc = self.db.collection('teams').document(team_id).get()
            if team_doc.exists and team_doc.to_dict().get('owner_id') == member_id:
                return {'success': False, 'error': 'Cannot remove team owner'}
            
            # Get member details before removal
            member_doc = self.db.collection('teams').document(team_id).collection('members').document(member_id).get()
            if not member_doc.exists:
                return {'success': False, 'error': 'Member not found'}
            
            member_data = member_doc.to_dict()
            
            # Remove member
            self.db.collection('teams').document(team_id).collection('members').document(member_id).delete()
            
            # Get remover details
            remover_doc = self.db.collection('users').document(remover_id).get()
            remover_name = remover_doc.to_dict().get('displayName', 'Team admin') if remover_doc.exists else 'Team admin'
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=remover_id,
                user_name=remover_name,
                activity_type=ActivityType.MEMBER_REMOVED,
                description=f"Removed {member_data.get('name', 'member')} from team",
                metadata={'removed_member': member_data.get('name', 'member')}
            )
            
            return {'success': True}
            
        except Exception as e:
            logger.error(f"Error removing member: {e}")
            return {'success': False, 'error': str(e)}
    
    async def update_member_role(
        self, 
        team_id: str, 
        updater_id: str, 
        member_id: str, 
        new_role: TeamRole
    ) -> Dict[str, Any]:
        """Update a member's role and permissions"""
        try:
            # Check permissions
            if not await self._check_permission(team_id, updater_id, 'can_manage_members'):
                return {'success': False, 'error': 'Insufficient permissions to update member roles'}
            
            # Cannot change owner role
            team_doc = self.db.collection('teams').document(team_id).get()
            if team_doc.exists and team_doc.to_dict().get('owner_id') == member_id:
                return {'success': False, 'error': 'Cannot change owner role'}
            
            # Update member role and permissions
            new_permissions = self._get_role_permissions(new_role)
            
            self.db.collection('teams').document(team_id).collection('members').document(member_id).update({
                'role': new_role.value,
                'permissions': new_permissions,
                'updated_at': datetime.now()
            })
            
            # Get member and updater details
            member_doc = self.db.collection('teams').document(team_id).collection('members').document(member_id).get()
            updater_doc = self.db.collection('users').document(updater_id).get()
            
            member_name = member_doc.to_dict().get('name', 'member') if member_doc.exists else 'member'
            updater_name = updater_doc.to_dict().get('displayName', 'Team admin') if updater_doc.exists else 'Team admin'
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=updater_id,
                user_name=updater_name,
                activity_type=ActivityType.PERMISSIONS_CHANGED,
                description=f"Changed {member_name}'s role to {new_role.value}",
                metadata={'member': member_name, 'new_role': new_role.value}
            )
            
            return {'success': True}
            
        except Exception as e:
            logger.error(f"Error updating member role: {e}")
            return {'success': False, 'error': str(e)}
    
    async def get_team_activity(self, team_id: str, user_id: str, limit: int = 50) -> Dict[str, Any]:
        """Get team activity log"""
        try:
            # Check if user is a team member
            member_doc = self.db.collection('teams').document(team_id).collection('members').document(user_id).get()
            if not member_doc.exists:
                return {'success': False, 'error': 'Access denied'}
            
            # Get activity log
            activities_ref = self.db.collection('teams').document(team_id).collection('activities')
            activities_query = activities_ref.order_by('timestamp', direction='DESCENDING').limit(limit)
            activities_docs = activities_query.get()
            
            activities = []
            for doc in activities_docs:
                activity_data = doc.to_dict()
                activities.append(activity_data)
            
            return {
                'success': True,
                'activities': activities
            }
            
        except Exception as e:
            logger.error(f"Error getting team activity: {e}")
            return {'success': False, 'error': str(e)}
    
    async def share_report_with_team(
        self, 
        team_id: str, 
        user_id: str, 
        report_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Share a tax report with team members"""
        try:
            # Check if user can generate reports
            if not await self._check_permission(team_id, user_id, 'can_generate_reports'):
                return {'success': False, 'error': 'Insufficient permissions to share reports'}
            
            # Create shared report
            report_id = str(uuid.uuid4())
            shared_report = {
                'id': report_id,
                'team_id': team_id,
                'shared_by': user_id,
                'report_data': report_data,
                'shared_at': datetime.now(),
                'access_level': 'team_members'
            }
            
            # Store shared report
            self.db.collection('shared_reports').document(report_id).set(shared_report)
            
            # Get user details
            user_doc = self.db.collection('users').document(user_id).get()
            user_name = user_doc.to_dict().get('displayName', 'Team member') if user_doc.exists else 'Team member'
            
            # Log activity
            await self._log_activity(
                team_id=team_id,
                user_id=user_id,
                user_name=user_name,
                activity_type=ActivityType.REPORT_GENERATED,
                description=f"Shared {report_data.get('report_type', 'report')} with team",
                metadata={'report_type': report_data.get('report_type'), 'report_id': report_id}
            )
            
            return {
                'success': True,
                'report_id': report_id,
                'share_url': f"/shared-reports/{report_id}"
            }
            
        except Exception as e:
            logger.error(f"Error sharing report: {e}")
            return {'success': False, 'error': str(e)}
    
    def _get_role_permissions(self, role: TeamRole) -> List[str]:
        """Get permissions for a role"""
        permissions_map = {
            TeamRole.OWNER: [
                'can_view_transactions', 'can_categorize_transactions', 'can_upload_receipts',
                'can_generate_reports', 'can_manage_members', 'can_edit_settings',
                'can_access_tax_data', 'can_submit_bas'
            ],
            TeamRole.ADMIN: [
                'can_view_transactions', 'can_categorize_transactions', 'can_upload_receipts',
                'can_generate_reports', 'can_manage_members', 'can_access_tax_data'
            ],
            TeamRole.ACCOUNTANT: [
                'can_view_transactions', 'can_categorize_transactions', 'can_upload_receipts',
                'can_generate_reports', 'can_access_tax_data', 'can_submit_bas'
            ],
            TeamRole.BOOKKEEPER: [
                'can_view_transactions', 'can_categorize_transactions', 'can_upload_receipts'
            ],
            TeamRole.VIEWER: [
                'can_view_transactions'
            ],
            TeamRole.TAX_AGENT: [
                'can_view_transactions', 'can_categorize_transactions', 'can_generate_reports',
                'can_access_tax_data', 'can_submit_bas'
            ]
        }
        
        return permissions_map.get(role, [])
    
    async def _check_permission(self, team_id: str, user_id: str, permission: str) -> bool:
        """Check if user has specific permission"""
        try:
            member_doc = self.db.collection('teams').document(team_id).collection('members').document(user_id).get()
            if not member_doc.exists:
                return False
            
            member_data = member_doc.to_dict()
            permissions = member_data.get('permissions', [])
            
            return permission in permissions
            
        except Exception as e:
            logger.error(f"Error checking permission: {e}")
            return False
    
    async def _log_activity(
        self,
        team_id: str,
        user_id: str,
        user_name: str,
        activity_type: ActivityType,
        description: str,
        metadata: Dict[str, Any]
    ) -> None:
        """Log team activity"""
        try:
            activity = TeamActivity(
                id=str(uuid.uuid4()),
                team_id=team_id,
                user_id=user_id,
                user_name=user_name,
                activity_type=activity_type,
                description=description,
                metadata=metadata,
                timestamp=datetime.now()
            )
            
            self.db.collection('teams').document(team_id).collection('activities').document(activity.id).set(
                self._activity_to_dict(activity)
            )
            
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
    
    def _member_to_dict(self, member: TeamMember) -> Dict[str, Any]:
        """Convert TeamMember to dictionary"""
        return {
            'user_id': member.user_id,
            'email': member.email,
            'name': member.name,
            'role': member.role.value,
            'permissions': member.permissions,
            'invited_by': member.invited_by,
            'invited_at': member.invited_at.isoformat(),
            'last_active': member.last_active.isoformat() if member.last_active else None,
            'status': member.status
        }
    
    def _invitation_to_dict(self, invitation: TeamInvitation) -> Dict[str, Any]:
        """Convert TeamInvitation to dictionary"""
        return {
            'id': invitation.id,
            'team_id': invitation.team_id,
            'email': invitation.email,
            'role': invitation.role.value,
            'invited_by': invitation.invited_by,
            'invited_at': invitation.invited_at.isoformat(),
            'expires_at': invitation.expires_at.isoformat(),
            'status': invitation.status
        }
    
    def _activity_to_dict(self, activity: TeamActivity) -> Dict[str, Any]:
        """Convert TeamActivity to dictionary"""
        return {
            'id': activity.id,
            'team_id': activity.team_id,
            'user_id': activity.user_id,
            'user_name': activity.user_name,
            'activity_type': activity.activity_type.value,
            'description': activity.description,
            'metadata': activity.metadata,
            'timestamp': activity.timestamp.isoformat()
        }

# Global instance
team_collaboration_manager = TeamCollaborationManager() 