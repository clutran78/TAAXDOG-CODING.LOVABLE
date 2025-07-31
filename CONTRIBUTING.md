# Contributing to TaxReturnPro

Thank you for your interest in contributing to TaxReturnPro! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:
- Be respectful and considerate in all interactions
- Welcome newcomers and help them get started
- Focus on constructive criticism and solutions
- Respect differing viewpoints and experiences

## Getting Started

1. **Fork the Repository**
   ```bash
   git clone https://github.com/TaaxDog/TAAXDOG-CODING.git
   cd TAAXDOG-CODING
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Set Up Database**
   ```bash
   npm run setup
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

## Development Process

### Branch Naming Convention
- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation updates
- `refactor/description` - Code refactoring
- `test/description` - Test additions/updates

### Workflow
1. Create a new branch from `main`
2. Make your changes
3. Write/update tests
4. Ensure all tests pass
5. Commit your changes
6. Push to your fork
7. Create a Pull Request

## Coding Standards

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for complex functions
- Prefer functional components in React

### Style Guidelines
```typescript
// Good
export async function getUserData(userId: string): Promise<User> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });
  
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
}

// Avoid
export async function getData(id) {
  return await prisma.user.findUnique({where:{id}});
}
```

### Component Structure
```typescript
// Use this pattern for components
interface ComponentProps {
  title: string;
  onAction: () => void;
}

export function Component({ title, onAction }: ComponentProps) {
  // Component logic
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

## Testing Guidelines

### Test Structure
```
src/
├── components/__tests__/     # Component tests
├── app/api/__tests__/       # API tests
└── __tests__/               # Integration tests
```

### Writing Tests
- Write tests for all new features
- Maintain minimum 70% code coverage
- Use descriptive test names
- Test both success and error cases

### Example Test
```typescript
describe('Dashboard Component', () => {
  it('should display user financial summary', async () => {
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Total Balance')).toBeInTheDocument();
    });
  });
  
  it('should handle API errors gracefully', async () => {
    // Mock API error
    mockApiError();
    
    render(<Dashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('Unable to load data')).toBeInTheDocument();
    });
  });
});
```

### Running Tests
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
npm test ComponentName     # Test specific file
```

## Submitting Changes

### Commit Messages
Follow conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Test additions/changes
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add two-factor authentication

fix(dashboard): resolve loading state issue

docs(api): update authentication endpoints
```

### Pull Request Guidelines
1. **Title**: Use clear, descriptive titles
2. **Description**: Include:
   - What changes were made
   - Why the changes were necessary
   - Any breaking changes
   - Screenshots for UI changes
3. **Tests**: Ensure all tests pass
4. **Documentation**: Update relevant documentation

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project standards
- [ ] Self-reviewed code
- [ ] Updated documentation
- [ ] No console.log statements
```

## Reporting Issues

### Bug Reports

Use this template when reporting bugs:

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. macOS, Windows, Linux]
- Browser: [e.g. Chrome, Safari, Firefox]
- Version: [e.g. 22]
- Node.js version: [e.g. 18.17.0]

**Additional context**
Any other context about the problem.

### Feature Requests

Use this template when requesting features:

**Is your feature request related to a problem?**
A clear description of what the problem is.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Other solutions you've considered.

**Australian Compliance**
How does this feature relate to Australian tax/financial regulations?

**Additional context**
Any other context or screenshots about the feature request.

## Australian Compliance Considerations

When contributing features that handle financial data:
- Ensure GST calculations use 10% rate
- Use Australian date formats (DD/MM/YYYY)
- Follow Australian financial year (July 1 - June 30)
- Validate ABN/TFN formats correctly
- Ensure data residency compliance

## Security Guidelines

- Never commit sensitive data or credentials
- Use environment variables for configuration
- Validate and sanitize all user inputs
- Follow OWASP security best practices
- Report security vulnerabilities privately

## Questions?

If you have questions:
1. Check existing documentation
2. Search closed issues
3. Ask in discussions
4. Contact maintainers

Thank you for contributing to TaxReturnPro! 🇦🇺