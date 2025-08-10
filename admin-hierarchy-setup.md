# Trade Scout Admin Hierarchy Setup

## Role Structure Overview

### **Owner (You) - `head_admin`**
- **Ultimate Authority**: Can manage ALL users including admins
- **System Control**: Full access to all platform settings and configurations
- **Financial Control**: Billing, payments, revenue management
- **Strategic Decisions**: Platform direction, major feature rollouts
- **Emergency Powers**: Can override any decision or restore system access

### **Administrators - `ops_admin`**
- **Daily Operations**: Manage platform operations and business processes
- **User Management**: Handle all users except head_admin (you)
- **Contractor Oversight**: Advanced contractor verification and management
- **Analytics Access**: Full reporting and business intelligence
- **Policy Enforcement**: Implement and enforce platform policies
- **Team Management**: Supervise moderators and support staff

### **Moderators - `moderator`**
- **Content Control**: Review and approve contractor profiles and content
- **User Support**: Handle customer service and user disputes
- **Quality Assurance**: Maintain platform standards and quality
- **Basic Reporting**: Generate content and user activity reports
- **Limited User Management**: Manage regular users (homeowners/contractors only)

## Detailed Permission Matrix

| Function | Owner (head_admin) | Admin (ops_admin) | Moderator |
|----------|-------------------|-------------------|-----------|
| **User Management** |
| Manage head_admin | ✅ Only | ❌ | ❌ |
| Manage ops_admin | ✅ | ❌ | ❌ |
| Manage moderators | ✅ | ✅ | ❌ |
| Manage regular users | ✅ | ✅ | ✅ |
| **System Configuration** |
| Site settings | ✅ | ✅ | ❌ |
| Payment settings | ✅ | ❌ | ❌ |
| Database access | ✅ | Limited | ❌ |
| **Business Operations** |
| Prize management | ✅ | ✅ | View only |
| Advertisement control | ✅ | ✅ | Report issues |
| Analytics/reporting | ✅ | ✅ | Basic only |
| **Content Management** |
| Contractor verification | ✅ | ✅ | ✅ |
| Content moderation | ✅ | ✅ | ✅ |
| User communications | ✅ | ✅ | ✅ |

## Setup Process

### Step 1: Deploy Platform
1. Click the Deploy button to launch Trade Scout
2. Register your owner account using your primary email
3. Note your email for database promotion

### Step 2: Promote Yourself to Owner
```sql
-- Make yourself the head_admin (owner)
UPDATE users 
SET role = 'head_admin' 
WHERE email = 'your-owner-email@domain.com';
```

### Step 3: Set Up Admin Team
1. Have your administrators register on the platform
2. Login as head_admin → go to `/admin/users`
3. Find each admin user → change role to `ops_admin`
4. Save changes

### Step 4: Set Up Moderator Team
1. Have your moderators register on the platform
2. Either you (head_admin) or your ops_admin can promote them
3. Navigate to `/admin/users` → change role to `moderator`
4. Save changes

## Recommended Team Structure

### **Small Team (5-10 people)**
- **1 Owner** (you) - `head_admin`
- **1-2 Admins** - `ops_admin`
- **2-4 Moderators** - `moderator`

### **Medium Team (10-25 people)**
- **1 Owner** (you) - `head_admin`
- **2-3 Admins** - `ops_admin`
- **4-8 Moderators** - `moderator`
- **Specialized roles** using existing categories

### **Large Team (25+ people)**
- **1 Owner** (you) - `head_admin`
- **3-5 Admins** - `ops_admin`
- **8-15 Moderators** - `moderator`
- **Regional assignments** for geographic coverage

## Admin Access URLs

### **Owner Dashboard (head_admin)**
- **Main Admin Panel**: `/admin/panel` - Complete platform control
- **User Management**: `/admin/users` - Manage ALL users including admins
- **Admin Workspace**: `/admin/workspace` - Operations overview
- **Error Reports**: `/admin/error-reports` - System monitoring
- **Database Access**: Direct database management capabilities

### **Administrator Dashboard (ops_admin)**
- **Admin Panel**: `/admin/panel` - Business operations and settings
- **User Management**: `/admin/users` - Manage users (except head_admin)
- **Contractor Management**: Advanced contractor verification tools
- **Analytics Dashboard**: Full business intelligence and reporting
- **Policy Management**: Platform rules and enforcement tools

### **Moderator Dashboard (moderator)**
- **Content Dashboard**: `/admin/workspace` - Daily moderation tasks
- **User Support**: `/admin/users` - Limited user management
- **Quality Control**: Contractor profile review and approval
- **Report Center**: `/admin/error-reports` - User issue resolution

## Security and Access Control

### **Access Hierarchy**
- **Owner** can access everything and manage everyone
- **Admins** can manage all operations except owner account
- **Moderators** can handle content and basic user support
- **Clear separation** prevents unauthorized access escalation

### **Emergency Procedures**
- **Owner Lockout Recovery**: Database-level access restoration
- **Admin Replacement**: Owner can instantly reassign admin roles
- **Moderator Issues**: Admins can handle moderator account problems
- **System Recovery**: Owner has ultimate system restoration powers

## Best Practices

### **Team Communication**
- **Regular Meetings**: Weekly team sync for updates and issues
- **Clear Escalation**: Moderators → Admins → Owner for complex issues
- **Documentation**: Keep detailed records of major decisions
- **Training Programs**: Regular skill updates for all team members

### **Access Management**
- **Principle of Least Privilege**: Give minimum required access
- **Regular Reviews**: Quarterly access audit and cleanup
- **Role Transitions**: Smooth handover procedures for role changes
- **Account Security**: Strong passwords and security practices

### **Operational Guidelines**
- **Decision Authority**: Clear guidelines on who can make what decisions
- **Approval Processes**: Multi-level approval for significant changes
- **Monitoring Systems**: Track team performance and platform health
- **Backup Plans**: Redundancy for critical roles and functions

## Common Scenarios

### **Daily Operations**
- **Moderators**: Handle content review, user support, basic approvals
- **Admins**: Oversee operations, handle complex issues, manage business metrics
- **Owner**: Strategic decisions, team management, crisis resolution

### **Crisis Management**
- **Technical Issues**: Owner has ultimate system access and control
- **Business Decisions**: Admins implement, owner approves major changes
- **Team Conflicts**: Clear hierarchy for dispute resolution
- **Emergency Response**: 24/7 coverage through role distribution

### **Growth and Scaling**
- **Team Expansion**: Structured hiring and role assignment process
- **Geographic Coverage**: Regional admin/moderator assignments
- **Specialized Functions**: Custom role definitions within existing framework
- **Performance Management**: Clear metrics and evaluation criteria

This hierarchy ensures you maintain ultimate control while empowering your team with appropriate levels of authority to effectively manage and grow your Trade Scout platform.