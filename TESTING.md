# Testing Guide for JustCooked Recipe Application

This document provides comprehensive information about the testing strategy, test organization, and how to run tests for the JustCooked Tauri recipe application.

## Overview

The JustCooked application uses a comprehensive testing strategy that covers both the frontend (TypeScript/React) and backend (Rust) components:

- **Frontend Testing**: Jest with React Testing Library for TypeScript/React components
- **Backend Testing**: Rust's built-in testing framework with additional property-based testing
- **Integration Testing**: End-to-end testing of complete workflows
- **Test-Driven Development**: Write tests first, then implement functionality

## Frontend Testing (Jest/TypeScript)

### Test Organization

```
src/
├── __tests__/
│   ├── fixtures/
│   │   └── recipes.ts              # Test data and fixtures
│   └── pages/
│       └── Home.test.tsx           # Page component tests
├── services/__tests__/
│   ├── imageService.test.ts        # Image handling tests
│   ├── ingredientStorage.test.ts   # Ingredient database tests
│   ├── pantryStorage.test.ts       # Pantry management tests
│   ├── recipeCollectionStorage.test.ts # Recipe collections tests
│   ├── recipeImport.test.ts        # Recipe import tests
│   ├── recipeStorage.test.ts       # Recipe storage tests
│   └── searchHistoryStorage.test.ts # Search history tests
├── utils/__tests__/
│   ├── ingredientFormatting.test.ts # Ingredient formatting tests
│   ├── servingUtils.test.ts        # Serving size calculation tests
│   └── timeUtils.test.ts           # Time parsing and formatting tests
├── hooks/__tests__/
│   └── useImageUrl.test.ts         # Custom hooks tests
├── components/__tests__/
│   └── SearchBar.test.tsx          # Component tests
└── pages/__tests__/
    └── Import.test.tsx             # Page component tests
```

### Running Frontend Tests

```bash
# Run all frontend tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests for CI (no watch mode)
npm run test:ci
```

### Test Categories

#### 1. **Service Tests**
- Test business logic and data handling
- Mock Tauri API calls and external dependencies
- Focus on error handling and edge cases
- Test data persistence and retrieval

#### 2. **Utility Tests**
- Test pure functions and calculations
- Focus on ingredient formatting, time parsing, serving calculations
- Test edge cases and input validation
- Ensure mathematical accuracy

#### 3. **Component Tests**
- Test user interactions and rendering
- Mock external dependencies and services
- Test accessibility and keyboard navigation
- Verify proper event handling

#### 4. **Hook Tests**
- Test custom React hooks behavior
- Test state management and side effects
- Mock external dependencies
- Test cleanup and memory leaks

#### 5. **Page Tests**
- Test complete page functionality
- Test navigation and routing
- Mock services and external dependencies
- Test loading states and error handling

## Backend Testing (Rust/Cargo)

### Test Organization

```
src-tauri/
├── src/
│   ├── recipe_import/
│   │   └── tests.rs              # Unit tests for recipe import
│   ├── image_storage/
│   │   └── tests.rs              # Unit tests for image storage
│   ├── recipe_import.rs          # Main recipe import module
│   └── image_storage.rs          # Main image storage module
├── tests/
│   ├── integration_tests.rs      # Integration tests
│   ├── property_tests.rs         # Property-based tests
│   ├── test_utils.rs             # Shared test utilities
│   └── mod.rs                    # Test runner and comprehensive suites
├── run_tests.sh                  # Test runner script
└── TESTING.md                    # Rust testing documentation
```

### Running Backend Tests

```bash
# Run all Rust tests
npm run test:rust

# Run only unit tests
npm run test:rust:unit

# Run only integration tests
npm run test:rust:integration

# Run only property-based tests
npm run test:rust:property

# Run tests with coverage
npm run test:rust:coverage

# Run both frontend and backend tests
npm run test:all

# Run all tests with coverage
npm run test:all:coverage
```

### Rust Test Categories

#### 1. **Unit Tests** (`src/*/tests.rs`)
- Test individual functions in isolation
- Focus on recipe parsing, image handling, data validation
- Use mocking for external dependencies
- Test error conditions and edge cases

#### 2. **Integration Tests** (`tests/integration_tests.rs`)
- Test complete workflows and module interactions
- Use real implementations with controlled test data
- Test HTTP requests and file system operations
- Validate end-to-end functionality

#### 3. **Property-Based Tests** (`tests/property_tests.rs`)
- Generate random test inputs to find edge cases
- Test invariants and properties that should always hold
- Stress test with large datasets
- Validate parsing robustness

## Test Data and Fixtures

### Frontend Fixtures (`src/__tests__/fixtures/recipes.ts`)

```typescript
export const mockRecipe: Recipe = {
  id: 'test-recipe-1',
  title: 'Test Recipe',
  description: 'A test recipe for unit tests',
  // ... complete recipe data
};

export const mockIngredients: Ingredient[] = [
  { name: 'flour', amount: 2, unit: 'cups' },
  { name: 'sugar', amount: 1, unit: 'cup' },
  // ... more test ingredients
];
```

### Backend Test Utilities (`src-tauri/tests/test_utils.rs`)

```rust
pub fn create_sample_recipe_json() -> Value {
    json!({
        "@type": "Recipe",
        "name": "Test Recipe",
        // ... complete recipe JSON-LD
    })
}

pub fn create_test_image_data() -> Vec<u8> {
    // Minimal valid image data for testing
}
```

## Mocking Strategy

### Frontend Mocking

#### Tauri API Mocking (`src/test-setup.ts`)
```typescript
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

jest.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: jest.fn(),
  writeTextFile: jest.fn(),
  // ... other fs operations
}));
```

#### Service Mocking
```typescript
jest.mock('@services/recipeStorage');
const mockGetAllRecipes = recipeStorage.getAllRecipes as jest.MockedFunction<typeof recipeStorage.getAllRecipes>;
```

### Backend Mocking

#### HTTP Mocking (`wiremock`)
```rust
use wiremock::{MockServer, Mock, ResponseTemplate};

let mock_server = MockServer::start().await;
Mock::given(method("GET"))
    .and(path("/recipe"))
    .respond_with(ResponseTemplate::new(200).set_body_json(&recipe_json))
    .mount(&mock_server)
    .await;
```

## Test-Driven Development (TDD)

### TDD Workflow

1. **Write a failing test** that describes the desired functionality
2. **Run the test** to confirm it fails for the right reason
3. **Write minimal code** to make the test pass
4. **Refactor** the code while keeping tests passing
5. **Repeat** for the next piece of functionality

### Example TDD Cycle

```typescript
// 1. Write failing test
test('should parse ISO duration PT30M to "30 minutes"', () => {
  expect(parseIsoDuration('PT30M')).toBe('30 minutes');
});

// 2. Run test (fails - function doesn't exist)
// 3. Implement minimal function
export function parseIsoDuration(duration: string): string {
  if (duration === 'PT30M') return '30 minutes';
  return '';
}

// 4. Test passes, refactor to handle more cases
// 5. Add more tests and repeat
```

## Coverage Goals

- **Services**: >90% line coverage
- **Utils**: >95% line coverage (pure functions)
- **Components**: >80% line coverage
- **Hooks**: >90% line coverage
- **Pages**: >70% line coverage (focus on critical paths)

## Running Tests

### Development Workflow

```bash
# Start development with tests in watch mode
npm run dev
# In another terminal:
npm run test:watch

# Before committing changes
npm run test:all
```

### CI/CD Pipeline

```bash
# Run all tests with coverage
npm run test:all:coverage

# Check coverage thresholds
npm run test:ci
```

## Debugging Tests

### Frontend Test Debugging

```bash
# Run specific test file
npm test -- SearchBar.test.tsx

# Run specific test case
npm test -- --testNamePattern="should handle search input"

# Run with debug output
npm test -- --verbose

# Run single test with full output
npm test -- --testNamePattern="specific test" --verbose
```

### Backend Test Debugging

```bash
# Run specific test
cd src-tauri && cargo test test_parse_json_ld_recipe

# Run with output
cd src-tauri && cargo test -- --nocapture

# Run with debug logs
cd src-tauri && RUST_LOG=debug cargo test
```

## Best Practices

### Frontend Testing

1. **Use descriptive test names** that explain what is being tested
2. **Test user behavior**, not implementation details
3. **Mock external dependencies** consistently
4. **Test error states** and edge cases
5. **Use proper cleanup** in beforeEach/afterEach
6. **Test accessibility** features when relevant

### Backend Testing

1. **Test public interfaces**, not private implementation
2. **Use realistic test data** that matches production scenarios
3. **Test error conditions** thoroughly
4. **Use property-based testing** for data parsing functions
5. **Clean up resources** (files, network connections) after tests
6. **Test concurrent access** where relevant

### General Guidelines

1. **Keep tests independent** - each test should be able to run in isolation
2. **Use meaningful assertions** - test the right things
3. **Avoid test duplication** - use shared fixtures and utilities
4. **Update tests when requirements change**
5. **Review test coverage** regularly and add missing tests
6. **Document complex test scenarios**

## Troubleshooting

### Common Issues

#### Frontend
- **Import path errors**: Check path aliases in jest.config.js
- **Async test failures**: Use proper async/await or waitFor
- **Mock not working**: Ensure mocks are set up in test-setup.ts
- **Component not rendering**: Check for missing providers or context

#### Backend
- **Test compilation errors**: Check Cargo.toml dependencies
- **File system tests failing**: Ensure proper cleanup and permissions
- **Network tests flaky**: Use proper mocking with wiremock
- **Property tests failing**: Review generated inputs and constraints

### Getting Help

1. Check existing test files for patterns and examples
2. Review the testing documentation in `src-tauri/TESTING.md`
3. Run tests with verbose output to see detailed error messages
4. Use debugger or console.log/println! for complex issues
5. Ask team members for guidance on testing patterns

## Continuous Improvement

- **Regular test reviews** to identify gaps and improvements
- **Update test data** to reflect real-world scenarios
- **Refactor tests** when they become hard to maintain
- **Add performance tests** for critical operations
- **Monitor test execution time** and optimize slow tests
- **Keep testing documentation** up to date
