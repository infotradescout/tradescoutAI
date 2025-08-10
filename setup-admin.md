# Trade Scout Admin Setup Guide

## Quick Start: Create Your First Head Admin

### Method 1: Database Direct (Recommended for Initial Setup)
```sql
-- After deployment, update a user to head_admin role
UPDATE users 
SET role = 'head_admin' 
WHERE email = 'your-admin-email@domain.com';
```

### Method 2: Use the Admin Panel (After first admin is created)
1. Login as head_admin
2. Go to `/admin/users`
3. Search for user and update their role

## Admin Access URLs (After Deployment)
- **Admin Panel**: `https://your-app.replit.app/admin/panel`
- **User Management**: `https://your-app.replit.app/admin/users`
- **Error Reports**: `https://your-app.replit.app/admin/error-reports`
- **Admin Workspace**: `https://your-app.replit.app/admin/workspace`

## Admin Role Permissions

### Head Admin (`head_admin`)
- ✅ Manage ALL users including other admins
- ✅ Full access to admin panel settings
- ✅ Prize and promotion management
- ✅ Site-wide configuration
- ✅ Database and system operations

### Operations Admin (`ops_admin`)  
- ✅ User management (except head admins)
- ✅ Contractor verification
- ✅ Lead routing configuration
- ✅ Analytics and reporting

### Moderator (`moderator`)
- ✅ Content moderation
- ✅ User support tickets
- ✅ Basic contractor management
- ❌ Cannot manage other admins

## Security Best Practices
1. **Start with ONE head_admin** (yourself)
2. **Use strong passwords** for admin accounts
3. **Enable 2FA** if available in your auth provider
4. **Regular access reviews** - audit admin permissions quarterly
5. **Separate admin emails** from personal accounts

## Post-Deployment Checklist
- [ ] Deploy application using Replit Deploy button
- [ ] Access deployed URL
- [ ] Create your admin account through normal registration
- [ ] Run SQL command to upgrade to head_admin
- [ ] Test admin panel access
- [ ] Create additional admin accounts as needed
- [ ] Configure site settings in admin panel
- [ ] Set up contractor verification process
- [ ] Test all admin functions

## Team Access Management

### For Replit Teams Users
- Set deployment to **Private** to restrict access to organization members
- Use Access panel to grant specific team members edit access
- Create Join Links for temporary collaborative access

### For Public Deployment
- Admin access is controlled by user roles in database
- Public can register as homeowners/contractors
- Only designated admins can access admin functions

## Common Admin Tasks
1. **Approve Contractors**: `/admin/workspace` → Contractor Applications
2. **Manage Prizes**: `/admin/panel` → Prize Configuration  
3. **View Analytics**: Check user engagement and lead conversion
4. **Content Moderation**: Review and approve contractor profiles
5. **System Monitoring**: Check error reports and system health

## Support
- Admin panel includes built-in help documentation
- Error reporting system for technical issues
- User management interface for account support