# Claude AI Assistant Workflow Guide

This document provides comprehensive instructions for Claude AI assistants working on this AI Photo Generator project. All Claude agents must follow these workflows and standards.

## 🎯 Project Overview

**Project**: AI Photo Generator with Next.js, Firebase, and Gemini AI
**Repository**: https://github.com/uait/aiphotogen
**Tech Stack**: Next.js 14, TypeScript, Firebase (Hosting, Functions, Firestore), Gemini AI, Stripe, TailwindCSS

## 🚀 Pre-Work Setup

### **STEP 0**: Always Start with Git Pull
Before beginning ANY work on this project:

```bash
# Ensure you're on master and pull latest changes
git checkout master
git pull origin master
```

## 📋 Required Workflow: Monday.com Ticket Management

### **MANDATORY**: Every task must be tracked in Monday.com

1. **Before Starting Any Work**:
   - Create a new item/ticket in Monday.com
   - Include clear title, description, and acceptance criteria
   - Set appropriate priority and estimated timeline
   - Assign to yourself and set status to "Working on it"

2. **During Work**:
   - Update ticket status and add progress notes
   - Document any blockers or technical decisions
   - Add screenshots or logs if relevant

3. **Upon Completion**:
   - Update ticket with final status "Done"
   - Add summary of work completed
   - Include links to PRs/commits
   - Close the ticket

### Monday.com Board Structure Expected:
- **Backlog**: New items awaiting prioritization
- **To Do**: Prioritized items ready for work
- **Working on it**: Currently in progress
- **Review**: Awaiting code review or testing
- **Done**: Completed items

## 🔄 Required Git Workflow

### **MANDATORY**: Branch-based Development

1. **Never commit directly to `master/main`**
2. **Always create feature branches** for your work
3. **Always push your branches** for visibility and backup

### Git Workflow Steps:

```bash
# 1. Start from updated main branch
git checkout master
git pull origin master

# 2. Create feature branch (use descriptive names)
git checkout -b feature/fix-gemini-chat-mode
# or
git checkout -b bugfix/firebase-deployment-error
# or  
git checkout -b enhancement/add-usage-tracking

# 3. Make your changes and commit frequently
git add .
git commit -m "Fix Gemini chat mode returning images instead of text

- Extract mode parameter from multipart form data properly
- Add debugging logs to track mode switching
- Ensure chat uses gemini-2.0-flash-exp, photo uses gemini-2.5-flash-image-preview

🎫 Monday Ticket: [Ticket ID/Link]
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 4. Push branch to origin
git push -u origin feature/fix-gemini-chat-mode

# 5. Create Pull Request with comprehensive description
gh pr create --title "Descriptive PR title" --body "
Detailed PR description including:
- Summary of changes
- Technical implementation details  
- Benefits and impact
- Test cases covered
- Monday ticket reference
"

# 6. MANDATORY: Request Copilot Review
# After creating PR, request Copilot to review the changes
@github-copilot review this pull request

# 7. Address Copilot Feedback (if any)
# Read all Copilot review comments carefully
# If Copilot identifies legitimate issues:
#   - Make necessary changes on the feature branch
#   - Push updates to the PR
#   - Ask Copilot to re-review if needed
# If comments are minor suggestions or false positives:
#   - Document reasoning for not implementing suggestions
#   - Proceed with merge

# 8. Merge PR when ready
# Only merge when:
# ✅ Copilot review completed
# ✅ All checks passing  
# ✅ Any legitimate issues addressed
# ✅ Monday ticket updated

# 9. MANDATORY: Post-Merge Feature Sign-Off Process
# After merging any feature or fix, ALWAYS follow this verification workflow:

# a) Pull latest master with merged changes
git checkout master
git pull origin master

# b) Monitor deployment logs
gh run list --limit 3
gh run view [latest-run-id] --log

# c) Verify deployment success and functionality
# - Check that GitHub Actions deployment completed successfully
# - Test the feature on the live site (https://pixtorai.com)
# - Verify all functionality works as expected
# - Check for any runtime errors or console warnings

# d) Sign-off documentation
# Add final verification comment to the Monday ticket:
# "✅ DEPLOYMENT VERIFIED:
# - GitHub Actions: SUCCESS
# - Live Site: Feature working correctly
# - No runtime errors detected
# - Signed off by: Claude AI Assistant
# - Verification completed: [timestamp]"

# e) Close Monday ticket and mark as "Done"
```

### Commit Message Standards:

```
Title: Brief description (50 chars max)

Detailed explanation of changes:
- Bullet point of change 1
- Bullet point of change 2
- Bullet point of change 3

Technical details or reasoning if needed.

🎫 Monday Ticket: [Ticket ID/Link]
🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 🛠️ Development Standards

### TypeScript
- Always use proper TypeScript types
- Fix compilation errors before committing
- Use `npm run build` to verify TypeScript compilation

### Testing
- Run `npm test` if tests exist
- Test functionality manually before committing
- Document test steps in Monday ticket

### Code Quality
- Follow existing code patterns and conventions
- Use ESLint/Prettier if configured
- Keep functions focused and well-documented

## 🚀 Deployment Process

### **IMPORTANT**: Deployment Only Happens on Master Branch Merges

GitHub Actions will **ONLY** deploy when:
✅ Code is merged into the `master` branch
❌ **NOT** on feature branch pushes or pull requests

### Development Workflow:
```bash
# 1. Create feature branch (as per Git workflow)
git checkout -b feature/your-feature-name

# 2. Make changes and commit
git add .
git commit -m "Your changes"
git push -u origin feature/your-feature-name

# 3. Create Pull Request
# GitHub Actions will NOT deploy at this stage

# 4. After code review, merge to master
# This triggers automatic deployment to Firebase
```

### Manual Deployment (Emergency Only):
```bash
# Test locally first
cd functions
npm run build
npm run serve

# Manual deploy if GitHub Actions fails
firebase deploy --only functions
```

### Deployment Checklist:
- [ ] TypeScript compilation passes (`npm run build`)
- [ ] No ESLint errors
- [ ] Manual testing completed on feature branch
- [ ] Pull Request created and reviewed
- [ ] Merged to master branch (triggers deployment)
- [ ] Monday ticket updated with deployment status
- [ ] Monitor deployment logs for errors

## 🤖 Copilot Review Process

### **MANDATORY**: Every PR must be reviewed by Copilot

After creating a Pull Request, you **MUST** request a Copilot review before merging.

### **Step-by-Step Copilot Review Workflow:**

#### 1. **Request Copilot Review**
```bash
# After creating PR, go to PR comments and tag Copilot
@github-copilot review this pull request
```

#### 2. **Read Copilot Feedback Carefully**
Copilot will analyze:
- ✅ Code quality and best practices
- ✅ Potential bugs or security issues  
- ✅ Performance considerations
- ✅ Documentation completeness
- ✅ Testing coverage gaps
- ✅ Design pattern consistency

#### 3. **Evaluate Copilot Comments**

**For LEGITIMATE Issues** (address these):
- 🚨 **Security vulnerabilities** → Fix immediately
- 🐛 **Potential bugs** → Review and fix if valid
- 📝 **Missing error handling** → Add proper error handling  
- 🔧 **Performance issues** → Optimize if significant
- 📚 **Missing documentation** → Add if critical

**For MINOR Suggestions** (optional):
- 🎨 **Code style preferences** → Document reasoning if not following
- 💡 **Alternative approaches** → Consider but not mandatory
- 📊 **Micro-optimizations** → Implement if time permits
- 🔄 **Refactoring suggestions** → Consider for future improvements

#### 4. **Addressing Feedback**
```bash
# If changes needed, update on the same feature branch
git add .
git commit -m "Address Copilot feedback: [specific changes]"
git push

# Request re-review if major changes made
@github-copilot please re-review the updated changes
```

#### 5. **Document Decision Rationale**
When NOT implementing Copilot suggestions, add a comment explaining:
```
✅ Copilot Review Addressed:
- Fixed potential null reference issue in line 45
- Added error handling for API calls
- Did not implement suggested refactoring (reason: would break existing functionality)
- Performance suggestion noted for future consideration
```

### **Merge Decision Matrix**

| Copilot Feedback | Action Required | Can Merge? |
|------------------|----------------|------------|
| 🚨 Security issues | Must fix | ❌ No |
| 🐛 Critical bugs | Must fix | ❌ No |
| ⚠️ Potential issues | Review & fix if valid | ⏳ After fixes |
| 💡 Style suggestions | Optional | ✅ Yes |
| 📝 Documentation | Add if critical | ✅ Yes* |
| 🔧 Minor improvements | Consider | ✅ Yes |

*Document reasoning if not adding suggested documentation

### **When to Merge**
✅ **Safe to merge when:**
- Copilot review completed
- All critical issues addressed  
- Security concerns resolved
- Legitimate bugs fixed
- Decision rationale documented
- All automated checks passing

### **Example Copilot Review Commands**
```bash
# Basic review request
@github-copilot review this pull request

# Focused review request  
@github-copilot review the security aspects of this pull request

# Re-review after changes
@github-copilot please review the updated code changes

# Ask for specific feedback
@github-copilot what are the potential performance issues in this code?
```

## 🧪 Testing Requirements

### Manual Testing Checklist:
- [ ] Text chat returns text responses (not images)
- [ ] Photo mode generates/edits images correctly
- [ ] File uploads work properly
- [ ] Authentication flow works
- [ ] Subscription features functional
- [ ] Mobile responsiveness verified

### Local Testing Commands:
```bash
# Run development server
npm run dev

# Run Firebase Functions locally
cd functions && npm run serve

# Run tests (if available)
npm test

# Build for production
npm run build
```

## 🔐 Environment Variables & Secrets

### Required Environment Variables:
- `GEMINI_API_KEY`: Google Gemini AI API key
- `STRIPE_SECRET_KEY`: Stripe payment processing
- `STRIPE_WEBHOOK_SECRET`: Stripe webhook verification
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Stripe client-side key

### GitHub Secrets Setup:
All secrets must be configured in GitHub repository settings under Secrets and Variables → Actions.

## 📊 Monitoring & Debugging

### Firebase Functions Logs:
```bash
# View real-time logs
firebase functions:log

# Or check Firebase Console → Functions → Logs
```

### Common Debug Commands:
```bash
# Check deployment status
gh run list --limit 5

# View specific workflow run
gh run view [run-id]

# Check git status
git status
git log --oneline -10
```

## 🔍 Troubleshooting Common Issues

### TypeScript Compilation Errors:
1. Check `functions/src/` for unused imports/variables
2. Verify all types are properly defined
3. Run `cd functions && npm run build` to identify issues

### Deployment Failures:
1. Check GitHub Actions logs
2. Verify all environment variables are set
3. Ensure Firebase CLI is properly authenticated
4. Check for merge conflicts or syntax errors

### API Response Issues:
1. Check Firebase Function logs for errors
2. Verify Gemini API key configuration
3. Test API endpoints individually
4. Check network requests in browser DevTools

## 📝 Documentation Requirements

### Code Comments:
- Document complex logic and business rules
- Explain API integrations and external dependencies
- Add TODO comments for known technical debt

### README Updates:
- Keep setup instructions current
- Document new features or configuration changes
- Update troubleshooting sections

## 🎯 Success Criteria

### Every Task Must Include:
1. ✅ Monday.com ticket created and tracked
2. ✅ Feature branch created and pushed
3. ✅ Code changes committed with proper messages
4. ✅ Pull Request created with comprehensive description
5. ✅ **Copilot review requested and addressed**
6. ✅ Manual testing completed
7. ✅ All critical Copilot feedback resolved
8. ✅ PR merged only after Copilot approval
9. ✅ **MANDATORY: Post-merge verification workflow completed**
10. ✅ **Deployment monitored and verified successful**
11. ✅ **Live site functionality tested and confirmed**
12. ✅ **Feature sign-off documented in Monday ticket**
13. ✅ Monday ticket closed with verification summary
14. ✅ Documentation updated (if needed)

## 🚨 Critical Rules

### **NEVER**:
- Commit directly to master/main branch
- Deploy without testing
- Leave Monday tickets incomplete
- Ignore TypeScript compilation errors
- Push code with console.log statements (except for debugging)
- Commit sensitive data (API keys, passwords)
- **Merge PRs without Copilot review**
- **Ignore critical Copilot security/bug feedback**

### **ALWAYS**:
- Create Monday tickets before starting work
- Use feature branches for all development
- Test changes manually before committing
- **Request Copilot review for every PR**
- **Address all critical Copilot feedback**
- Update ticket status throughout development
- Push branches for backup and visibility
- Include ticket references in commits
- **Document rationale when not following Copilot suggestions**
- **Complete post-merge verification workflow**
- **Monitor deployment logs after merging**
- **Test live site functionality after deployment**
- **Sign off on features with verification documentation**
- Close tickets with comprehensive verification summary

## 🔄 Continuous Improvement

### Regular Reviews:
- Review and update this document monthly
- Gather feedback from development patterns
- Update workflows based on project evolution
- Maintain consistency across all Claude agents

---

*This document should be the first reference for any Claude AI assistant working on this project. Adherence to these standards ensures code quality, project tracking, and team coordination.*