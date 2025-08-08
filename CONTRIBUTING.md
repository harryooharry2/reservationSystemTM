# Contributing to Cafe Table Web Reservation System

Thank you for your interest in contributing to our project! This document outlines the development workflow and guidelines for contributing.

## 🚀 Development Workflow

### Branch Strategy

We follow a **Git Flow** approach with the following branches:

- **`main`**: Production-ready code
- **`develop`**: Integration branch for features
- **`feature/*`**: Feature development branches
- **`hotfix/*`**: Critical bug fixes
- **`release/*`**: Release preparation branches

### Branch Protection Rules

#### Main Branch
- ✅ **Require pull request reviews before merging**
- ✅ **Require status checks to pass before merging**
- ✅ **Require branches to be up to date before merging**
- ✅ **Restrict pushes that create files larger than 100MB**
- ✅ **Require linear history**

#### Develop Branch
- ✅ **Require pull request reviews before merging**
- ✅ **Require status checks to pass before merging**
- ✅ **Restrict pushes that create files larger than 100MB**

### Development Process

1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Develop Your Feature**
   - Write code following our coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Commit Guidelines**
   ```bash
   # Use conventional commit format
   git commit -m "feat: add user authentication system"
   git commit -m "fix: resolve reservation conflict issue"
   git commit -m "docs: update API documentation"
   ```

4. **Push and Create Pull Request**
   ```bash
   git push origin feature/your-feature-name
   # Create PR on GitHub/GitLab
   ```

5. **Code Review Process**
   - At least one approval required
   - All CI checks must pass
   - Address review comments

6. **Merge to Develop**
   - Squash commits for clean history
   - Delete feature branch after merge

## 📋 Pull Request Guidelines

### PR Title Format
```
type(scope): brief description

Examples:
feat(auth): add JWT authentication system
fix(reservation): resolve double booking issue
docs(api): update endpoint documentation
```

### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests added/updated
```

## 🧪 Testing Requirements

### Frontend Testing
```bash
cd frontend
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:coverage # Coverage report
```

### Backend Testing
```bash
cd backend
npm run test          # Unit tests
npm run test:integration # Integration tests
npm run test:coverage # Coverage report
```

### Test Coverage Requirements
- **Unit Tests**: Minimum 80% coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: Critical user flows covered

## 📝 Code Standards

### JavaScript/TypeScript
- Use ESLint and Prettier
- Follow TypeScript strict mode
- Use meaningful variable names
- Add JSDoc comments for functions

### CSS/Styling
- Use TailwindCSS utility classes
- Follow mobile-first approach
- Maintain consistent spacing and colors

### Git Commits
- Use conventional commit format
- Keep commits atomic and focused
- Write descriptive commit messages

## 🔧 Local Development Setup

### Prerequisites
```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Development Servers
```bash
# Frontend (Astro)
cd frontend
npm run dev

# Backend (Express)
cd backend
npm run dev
```

### Database Setup
```bash
# Supabase local development
npx supabase start
npx supabase db reset
```

## 🚨 Issue Reporting

### Bug Reports
- Use the bug report template
- Include steps to reproduce
- Add screenshots if applicable
- Specify browser/environment

### Feature Requests
- Use the feature request template
- Describe the use case
- Consider implementation complexity
- Discuss with maintainers first

## 📚 Documentation

### Code Documentation
- Document complex functions
- Add inline comments for business logic
- Keep README.md updated
- Maintain API documentation

### Commit Message Examples
```bash
feat(auth): implement JWT authentication system
fix(reservation): prevent double booking conflicts
docs(api): update reservation endpoint documentation
test(auth): add unit tests for login functionality
refactor(ui): improve reservation form component
```

## 🤝 Code Review Guidelines

### For Reviewers
- Be constructive and respectful
- Focus on code quality and functionality
- Check for security issues
- Verify test coverage

### For Authors
- Respond to review comments promptly
- Make requested changes clearly
- Test changes thoroughly
- Update documentation if needed

## 🎯 Release Process

1. **Create Release Branch**
   ```bash
   git checkout develop
   git checkout -b release/v1.0.0
   ```

2. **Version Update**
   - Update version in package.json
   - Update CHANGELOG.md
   - Update documentation

3. **Testing**
   - Run full test suite
   - Perform manual testing
   - Check deployment readiness

4. **Merge to Main**
   ```bash
   git checkout main
   git merge release/v1.0.0
   git tag v1.0.0
   git push origin main --tags
   ```

5. **Deploy**
   - Deploy to staging environment
   - Run smoke tests
   - Deploy to production

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and ideas
- **Documentation**: Check README.md and docs/
- **Maintainers**: @project-maintainers

---

**Thank you for contributing to our project! 🎉** 