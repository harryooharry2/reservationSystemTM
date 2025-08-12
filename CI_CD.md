# CI/CD Pipeline Documentation

This document describes the comprehensive CI/CD pipeline implemented for the Cafe Reservation System using GitHub Actions.

## Overview

The CI/CD pipeline provides:

- Automated testing and quality checks
- Multi-environment deployments (staging, production)
- Security scanning and vulnerability checks
- Performance monitoring and health checks
- Rollback capabilities
- Comprehensive reporting

## Pipeline Architecture

### Workflows

1. **CI/CD Pipeline** (`ci-cd.yml`)

   - Main pipeline for builds, tests, and deployments
   - Triggers on push to main/develop branches
   - Includes security scanning and quality gates

2. **Test Suite** (`test.yml`)

   - Dedicated testing workflow
   - Runs unit, integration, E2E, performance, and security tests
   - Scheduled daily runs for regression testing

3. **Deploy** (`deploy.yml`)
   - Deployment-specific workflow
   - Supports manual deployments with environment selection
   - Includes post-deployment monitoring

## Setup Instructions

### 1. GitHub Repository Setup

1. **Enable GitHub Actions**

   - Go to repository Settings → Actions → General
   - Enable "Allow all actions and reusable workflows"

2. **Set up Environments**

   - Go to Settings → Environments
   - Create `staging` and `production` environments
   - Configure protection rules and required reviewers

3. **Configure Branch Protection**
   - Go to Settings → Branches
   - Add rule for `main` branch:
     - Require pull request reviews
     - Require status checks to pass
     - Require branches to be up to date

### 2. Environment Variables and Secrets

Configure the following secrets in your GitHub repository:

#### Required Secrets

```bash
# Netlify Configuration
NETLIFY_AUTH_TOKEN=your_netlify_auth_token
NETLIFY_SITE_ID_STAGING=your_staging_site_id
NETLIFY_SITE_ID_PRODUCTION=your_production_site_id

# Render Configuration (if using Render)
RENDER_API_KEY=your_render_api_key
RENDER_SERVICE_ID_STAGING=your_staging_service_id
RENDER_SERVICE_ID_PRODUCTION=your_production_service_id

# Environment URLs
STAGING_FRONTEND_URL=https://your-staging-app.netlify.app
STAGING_BACKEND_URL=https://your-staging-api.onrender.com
PRODUCTION_FRONTEND_URL=https://your-production-app.netlify.app
PRODUCTION_BACKEND_URL=https://your-production-api.onrender.com

# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key
```

#### Optional Secrets

```bash
# Notification Services
SLACK_WEBHOOK_URL=your_slack_webhook_url
DISCORD_WEBHOOK_URL=your_discord_webhook_url
EMAIL_SMTP_CONFIG=your_email_config

# Monitoring Services
NEW_RELIC_LICENSE_KEY=your_new_relic_key
DATADOG_API_KEY=your_datadog_key
SENTRY_DSN=your_sentry_dsn
```

### 3. Deployment Platform Setup

#### Netlify (Frontend)

1. **Create Netlify Sites**

   ```bash
   # Staging site
   netlify sites:create --name cafe-reservation-staging

   # Production site
   netlify sites:create --name cafe-reservation-production
   ```

2. **Configure Build Settings**

   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: `18`

3. **Set Environment Variables**

   ```bash
   # Staging
   netlify env:set PUBLIC_SUPABASE_URL your_staging_supabase_url
   netlify env:set PUBLIC_API_URL your_staging_backend_url

   # Production
   netlify env:set PUBLIC_SUPABASE_URL your_production_supabase_url
   netlify env:set PUBLIC_API_URL your_production_backend_url
   ```

#### Render (Backend)

1. **Create Render Services**

   - Create Web Service for backend
   - Connect GitHub repository
   - Set build command: `npm install`
   - Set start command: `npm start`

2. **Configure Environment Variables**
   ```bash
   NODE_ENV=production
   PORT=10000
   CORS_ORIGIN=https://your-frontend-domain.netlify.app
   JWT_SECRET=your_jwt_secret
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Workflow Descriptions

### CI/CD Pipeline (`ci-cd.yml`)

#### Jobs:

1. **Frontend Lint & Test**

   - Installs dependencies
   - Runs linting
   - Builds frontend
   - Uploads build artifacts

2. **Backend Lint & Test**

   - Installs dependencies
   - Runs linting and tests
   - Builds backend
   - Uploads artifacts

3. **Security Scan**

   - Runs npm audit
   - Performs CodeQL analysis
   - Checks for vulnerabilities

4. **Deploy to Staging**

   - Deploys to staging environment
   - Runs health checks
   - Executes staging tests

5. **Deploy to Production**

   - Deploys to production environment
   - Runs comprehensive health checks
   - Creates deployment tags

6. **Post-deployment Tests**

   - Runs end-to-end tests
   - Performs performance tests
   - Executes security tests

7. **Rollback**
   - Manual rollback capability
   - Environment-specific rollback

### Test Suite (`test.yml`)

#### Jobs:

1. **Unit Tests**

   - Matrix strategy for frontend/backend
   - Runs unit tests
   - Generates coverage reports

2. **Integration Tests**

   - Tests API endpoints
   - Database integration tests
   - Frontend-backend integration

3. **End-to-End Tests**

   - Full application testing
   - User journey validation
   - Cross-browser testing

4. **Performance Tests**

   - Load testing
   - Response time validation
   - Resource usage monitoring

5. **Security Tests**

   - Vulnerability scanning
   - Dependency audit
   - Security best practices check

6. **Coverage Report**
   - Combines coverage data
   - Generates comprehensive reports
   - Uploads artifacts

### Deploy (`deploy.yml`)

#### Jobs:

1. **Pre-deployment Checks**

   - Security audit
   - Build validation
   - Artifact preparation

2. **Deploy to Staging**

   - Netlify frontend deployment
   - Render backend deployment
   - Health checks and tests

3. **Deploy to Production**

   - Production deployment
   - Smoke tests
   - Deployment tagging

4. **Post-deployment Monitoring**

   - Environment monitoring
   - Performance tracking
   - Alert verification

5. **Rollback**
   - Manual rollback workflow
   - Environment-specific rollback

## Deployment Process

### Automated Deployments

1. **Staging Deployment**

   - Trigger: Push to `develop` branch
   - Process: Build → Test → Deploy → Verify
   - Environment: Staging

2. **Production Deployment**
   - Trigger: Push to `main` branch
   - Process: Build → Test → Security Scan → Deploy → Verify
   - Environment: Production

### Manual Deployments

1. **Manual Trigger**

   - Go to Actions → Deploy
   - Select environment (staging/production)
   - Choose force deployment if needed

2. **Approval Process**
   - Production deployments require approval
   - Configured in GitHub Environments
   - Reviewers can approve/reject

### Rollback Process

1. **Automatic Rollback**

   - Health check failures trigger rollback
   - Smoke test failures trigger rollback
   - Performance degradation triggers rollback

2. **Manual Rollback**
   - Go to Actions → Deploy
   - Select rollback option
   - Choose target environment

## Quality Gates

### Pre-deployment Checks

- ✅ All tests pass
- ✅ Security scan clean
- ✅ Code coverage > 80%
- ✅ Performance benchmarks met
- ✅ No critical vulnerabilities

### Post-deployment Checks

- ✅ Health checks pass
- ✅ Smoke tests pass
- ✅ Performance within thresholds
- ✅ Monitoring alerts clear

## Monitoring and Alerting

### Deployment Monitoring

- Real-time deployment status
- Health check monitoring
- Performance tracking
- Error rate monitoring

### Alert Channels

- GitHub Actions notifications
- Slack/Discord integration
- Email notifications
- PagerDuty integration

## Best Practices

### 1. Branch Strategy

```bash
main          # Production-ready code
├── develop   # Integration branch
├── feature/* # Feature branches
└── hotfix/*  # Hotfix branches
```

### 2. Commit Messages

```bash
feat: add new reservation feature
fix: resolve authentication issue
docs: update API documentation
test: add unit tests for auth module
chore: update dependencies
```

### 3. Pull Request Process

1. Create feature branch
2. Implement changes
3. Run local tests
4. Create pull request
5. Code review
6. CI/CD pipeline runs
7. Merge to develop/main

### 4. Environment Management

- **Development**: Local development
- **Staging**: Pre-production testing
- **Production**: Live application

### 5. Security Practices

- Regular dependency updates
- Security scanning in pipeline
- Secrets management
- Access control
- Audit logging

## Troubleshooting

### Common Issues

1. **Build Failures**

   - Check Node.js version compatibility
   - Verify dependency versions
   - Review build logs

2. **Deployment Failures**

   - Check environment variables
   - Verify platform credentials
   - Review deployment logs

3. **Test Failures**

   - Check test environment setup
   - Verify database connections
   - Review test configuration

4. **Performance Issues**
   - Monitor resource usage
   - Check for memory leaks
   - Review database queries

### Debug Commands

```bash
# Check workflow status
gh run list

# View workflow logs
gh run view <run-id>

# Rerun failed workflow
gh run rerun <run-id>

# Download artifacts
gh run download <run-id>
```

## Maintenance

### Regular Tasks

- **Weekly**: Review pipeline performance
- **Monthly**: Update dependencies
- **Quarterly**: Review security policies
- **Annually**: Update deployment platforms

### Monitoring

- Pipeline execution times
- Success/failure rates
- Resource usage
- Security scan results

## Support

For CI/CD issues:

1. Check GitHub Actions logs
2. Review workflow configurations
3. Verify environment variables
4. Contact DevOps team

## Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Netlify Documentation](https://docs.netlify.com/)
- [Render Documentation](https://render.com/docs)
- [Supabase Documentation](https://supabase.com/docs)
