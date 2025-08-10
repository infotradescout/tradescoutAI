# Trade Scout Moderator Setup Guide

## Setting Up Moderators for Your Platform

### Moderator Role Overview
Moderators have focused permissions for content management and user support:
- ✅ Content moderation (contractor profiles, reviews, posts)
- ✅ User support and basic account management
- ✅ Contractor application review and approval
- ✅ Chat monitoring and intervention
- ✅ Error report review and basic resolution
- ❌ Cannot manage other admins or system settings

### Creating Moderator Accounts

#### Method 1: Through Admin Panel (Recommended)
1. **Login as head_admin**
2. **Go to** `/admin/users`
3. **Search for the user** you want to promote
4. **Update their role** to `moderator`
5. **Save changes**

#### Method 2: Database Direct
```sql
-- Promote existing user to moderator
UPDATE users 
SET role = 'moderator' 
WHERE email = 'moderator-email@domain.com';
```

### Moderator Access Areas
Once promoted, moderators can access:

#### **Primary Moderator Dashboard**
- **URL**: `/admin/workspace`
- **Functions**: Contractor applications, user reports, content review

#### **User Management (Limited)**
- **URL**: `/admin/users`
- **Permissions**: View and manage regular users (homeowners, contractors)
- **Restrictions**: Cannot modify admin accounts

#### **Error Reports**
- **URL**: `/admin/error-reports`
- **Functions**: Review user-reported issues, technical problems

### Moderator Daily Tasks

#### **1. Contractor Application Review**
- Review new contractor applications
- Verify business licenses and insurance
- Approve or reject based on platform standards
- Communicate with contractors about missing documentation

#### **2. Content Moderation**
- Monitor contractor profiles for inappropriate content
- Review customer reviews and ratings
- Check chat messages for policy violations
- Remove spam or inappropriate listings

#### **3. User Support**
- Respond to user reports and complaints
- Help resolve disputes between homeowners and contractors
- Handle account-related issues
- Escalate complex issues to ops_admin

#### **4. Quality Assurance**
- Ensure contractor profiles meet quality standards
- Verify contact information and service areas
- Check for duplicate or fake accounts
- Maintain database integrity

### Moderator Guidelines

#### **Approval Criteria for Contractors**
✅ **Required Documents**
- Valid business license
- Liability insurance certificate
- Workers' compensation (if applicable)
- Professional certifications for specialized trades

✅ **Profile Quality Standards**
- Complete business information
- Professional photos
- Detailed service descriptions
- Verified contact information

❌ **Rejection Reasons**
- Incomplete documentation
- Expired licenses or insurance
- Poor quality photos or descriptions
- Duplicate accounts
- Policy violations

#### **Content Moderation Standards**
- Remove profanity or inappropriate language
- Ensure contractor photos are professional
- Verify service descriptions are accurate
- Check for spam or promotional content
- Maintain family-friendly environment

### Best Practices for Moderators

#### **Communication**
- Be professional and helpful in all interactions
- Provide clear reasons for rejections or warnings
- Respond to user inquiries within 24 hours
- Escalate complex issues promptly

#### **Documentation**
- Keep detailed notes on all decisions
- Document reasons for approvals/rejections
- Track recurring issues or problem users
- Maintain audit trail for accountability

#### **Consistency**
- Apply standards uniformly across all users
- Follow established guidelines and policies
- Consult with team on unclear situations
- Regular training on platform updates

### Setting Up Multiple Moderators

#### **Recommended Team Structure**
- **Lead Moderator**: Experienced team member, handles escalations
- **Regional Moderators**: Focus on specific geographic areas
- **Specialty Moderators**: Focus on specific trade categories
- **Support Moderators**: Handle user inquiries and basic issues

#### **Geographic Assignment**
```sql
-- Example: Assign moderator to specific regions
UPDATE users 
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'),
  '{assigned_regions}',
  '["CA", "NV", "AZ"]'
)
WHERE role = 'moderator' AND email = 'west-coast-moderator@domain.com';
```

### Moderator Training Checklist

#### **Platform Knowledge**
- [ ] Understand Trade Scout's mission and values
- [ ] Know all contractor categories and requirements
- [ ] Familiar with user interface and admin tools
- [ ] Understand escalation procedures

#### **Policy Training**
- [ ] Content moderation guidelines
- [ ] Contractor approval criteria
- [ ] User conduct policies
- [ ] Privacy and data handling

#### **Technical Skills**
- [ ] Navigate admin panel efficiently
- [ ] Use user management tools
- [ ] Generate reports and analytics
- [ ] Handle basic technical issues

### Monitoring Moderator Performance

#### **Key Metrics**
- Response time to user inquiries
- Contractor application processing speed
- Accuracy of approval/rejection decisions
- User satisfaction with moderator interactions
- Issue escalation rate

#### **Regular Reviews**
- Weekly team meetings
- Monthly performance reviews
- Quarterly policy updates
- Annual comprehensive training

### Common Moderator Scenarios

#### **Scenario 1: Questionable Contractor Application**
1. Review all submitted documents
2. Research business online for legitimacy
3. Contact contractor for additional information if needed
4. Consult lead moderator or ops_admin for guidance
5. Make decision with documented reasoning

#### **Scenario 2: User Complaint About Contractor**
1. Review complaint details and evidence
2. Check contractor's history and ratings
3. Contact both parties for their perspectives
4. Investigate chat logs if applicable
5. Take appropriate action (warning, suspension, etc.)
6. Document resolution and follow up

#### **Scenario 3: Inappropriate Content**
1. Immediately remove or hide content
2. Contact user to explain policy violation
3. Issue warning or temporary restriction
4. Document incident for future reference
5. Monitor user for repeat violations

### Contact and Escalation

#### **When to Escalate to Ops Admin**
- Complex legal or liability issues
- System-wide technical problems
- Policy changes or interpretations
- Serious user safety concerns
- Appeals of moderator decisions

#### **Emergency Contacts**
- Ops Admin: For urgent operational issues
- Head Admin: For critical system problems
- Legal: For liability or legal concerns
- Technical Support: For platform bugs or errors

This comprehensive guide ensures your moderators have clear guidelines and procedures for maintaining a high-quality platform while providing excellent user support.