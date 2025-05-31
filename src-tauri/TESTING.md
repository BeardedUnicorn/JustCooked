# Testing Guide for JustCooked Recipe Application

This document provides comprehensive information about the testing strategy, test organization, and how to run tests for the JustCooked Tauri recipe application.

## Testing Strategy

Our testing approach follows Rust best practices and includes multiple layers of testing:

### 1. **Unit Tests**
- Test individual functions and methods in isolation
- Located alongside source code in `tests.rs` modules
- Focus on business logic, data parsing, and utility functions
- Use mocking for external dependencies

### 2. **Integration Tests**
- Test interactions between modules and components
- Located in `tests/` directory
- Test complete workflows and data flow
- Use real implementations with controlled test data

### 3. **Property-Based Tests**
- Use `proptest` to test functions with generated inputs
- Verify properties hold across wide range of inputs
- Catch edge cases that manual tests might miss
- Focus on data parsing and validation functions

### 4. **Performance Tests**
- Measure parsing performance with large datasets
- Ensure reasonable response times for typical operations
- Test memory usage with large recipes

## Test Organization

```
src-tauri/
├── src/
│   ├── recipe_import/
│   │   └── tests.rs          # Unit tests for recipe import
│   ├── image_storage/
│   │   └── tests.rs          # Unit tests for image storage
│   ├── recipe_import.rs      # Main recipe import module
│   └── image_storage.rs      # Main image storage module
├── tests/
│   ├── integration_tests.rs  # Integration tests
│   ├── property_tests.rs     # Property-based tests
│   ├── test_utils.rs         # Shared test utilities
│   └── mod.rs               # Test runner and comprehensive suites
└── TESTING.md               # This documentation
```

## Running Tests

### Prerequisites

Make sure you have the required test dependencies installed:

```bash
cd src-tauri
cargo check
```

### Running All Tests

```bash
# Run all tests (unit, integration, property-based)
cargo test

# Run tests with output
cargo test -- --nocapture

# Run tests in parallel (default)
cargo test --jobs 4
```

### Running Specific Test Categories

```bash
# Run only unit tests
cargo test --lib

# Run only integration tests
cargo test --test integration_tests

# Run only property-based tests
cargo test --test property_tests

# Run comprehensive test suite
cargo test run_comprehensive_test_suite
```

### Running Tests for Specific Modules

```bash
# Test recipe import module
cargo test recipe_import

# Test image storage module
cargo test image_storage

# Test specific function
cargo test test_is_supported_url
```

### Running Tests with Coverage

```bash
# Install cargo-tarpaulin for coverage
cargo install cargo-tarpaulin

# Run tests with coverage report
cargo tarpaulin --out Html --output-dir coverage/
```

## Test Categories Explained

### Unit Tests (`src/*/tests.rs`)

**Recipe Import Tests:**
- `test_is_supported_url()` - URL validation for supported recipe sites
- `test_extract_image_from_json()` - JSON image extraction with various formats
- `test_extract_servings_from_json()` - Serving count parsing from different data types
- `test_extract_ingredients_from_json()` - Ingredient list extraction
- `test_extract_instructions_from_json()` - Instruction parsing (string and object formats)
- `test_extract_keywords_from_json()` - Keyword extraction from categories and cuisines
- `test_get_site_selectors()` - Site-specific CSS selector generation
- `test_parse_json_ld_recipe()` - Complete JSON-LD recipe parsing
- `test_extract_from_json_ld()` - JSON-LD script extraction from HTML

**Image Storage Tests:**
- `test_is_valid_image_url()` - Image URL validation
- `test_get_app_data_dir()` - Application data directory resolution
- `test_get_local_image_as_base64()` - File reading and base64 encoding
- `test_delete_stored_image()` - File deletion operations
- `test_image_storage_error_display()` - Error handling and display

### Integration Tests (`tests/integration_tests.rs`)

- **Recipe Import Integration**: End-to-end recipe parsing from HTML with JSON-LD
- **HTML Fallback Testing**: Recipe extraction when JSON-LD is unavailable
- **Image Storage Integration**: Complete image download, processing, and storage workflow
- **Error Handling Integration**: Testing error scenarios across modules
- **URL and Image Validation**: Cross-module validation testing

### Property-Based Tests (`tests/property_tests.rs`)

- **Servings Extraction**: Test with generated numeric values (0-1000)
- **Image URL Extraction**: Test with generated valid URLs
- **Ingredient Lists**: Test with generated ingredient arrays (1-20 items)
- **Instruction Lists**: Test with generated instruction arrays (1-15 items)
- **Keyword Extraction**: Test with generated category and cuisine arrays
- **URL Validation**: Test with generated domain patterns
- **Large Data Handling**: Test with large ingredient/instruction lists (50-200 items)

### Performance Tests (`tests/mod.rs`)

- **Recipe Parsing Performance**: Parse 100 recipes and measure time
- **Large Recipe Handling**: Test recipes with 100+ ingredients and 50+ instructions
- **Memory Usage**: Monitor memory consumption during parsing

## Test Data and Fixtures

### Sample Recipe Data (`test_utils.rs`)

The test utilities provide realistic test data:

- **`create_sample_recipe_json()`**: Complete JSON-LD recipe with all fields
- **`create_sample_recipe_html()`**: Full HTML page with embedded JSON-LD
- **`create_minimal_recipe_html()`**: Basic HTML for fallback testing
- **`create_test_image_file()`**: Minimal valid image files for testing
- **`create_test_image_data()`**: Binary data for different image formats

### Error Test Cases

- Invalid JSON structures
- Missing required fields
- Wrong data types
- Malformed HTML
- Network errors
- File system errors

## Mocking and Test Doubles

### HTTP Mocking (`wiremock`)

Integration tests use `wiremock` to mock HTTP responses:

```rust
let mock_server = MockServer::start().await;
Mock::given(method("GET"))
    .and(path("/recipe"))
    .respond_with(ResponseTemplate::new(200).set_body_string(html))
    .mount(&mock_server)
    .await;
```

### File System Mocking (`tempfile`)

Tests use temporary directories for file operations:

```rust
let temp_dir = TempDir::new().unwrap();
let test_file = temp_dir.path().join("test.jpg");
```

## Continuous Integration

### GitHub Actions Configuration

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      - name: Run tests
        run: cd src-tauri && cargo test
      - name: Run tests with coverage
        run: cd src-tauri && cargo tarpaulin --out Xml
```

## Test Best Practices

### 1. **Test Naming**
- Use descriptive test names: `test_extract_servings_from_json_with_string_input`
- Group related tests with common prefixes
- Include expected behavior in name

### 2. **Test Structure**
- Follow Arrange-Act-Assert pattern
- Keep tests focused on single behavior
- Use helper functions for common setup

### 3. **Test Data**
- Use realistic test data that matches production scenarios
- Test edge cases (empty, null, invalid data)
- Include unicode and special characters

### 4. **Error Testing**
- Test both success and failure paths
- Verify error types and messages
- Test error recovery scenarios

### 5. **Performance Testing**
- Set reasonable performance expectations
- Test with realistic data sizes
- Monitor memory usage for large operations

## Debugging Tests

### Running Tests with Debug Output

```bash
# Show println! output
cargo test -- --nocapture

# Show debug logs
RUST_LOG=debug cargo test

# Run single test with full output
cargo test test_name -- --exact --nocapture
```

### Using Test Debugger

```bash
# Run tests with debugger
rust-gdb --args target/debug/deps/test_binary test_name
```

## Coverage Goals

- **Unit Tests**: >90% line coverage for business logic
- **Integration Tests**: Cover all major user workflows
- **Error Handling**: Test all error paths and edge cases
- **Performance**: Ensure reasonable performance under load

## Adding New Tests

When adding new functionality:

1. **Write unit tests first** for individual functions
2. **Add integration tests** for new workflows
3. **Include property-based tests** for data parsing functions
4. **Add performance tests** for operations that process large data
5. **Update test documentation** with new test categories

## Troubleshooting Common Issues

### Test Failures

- Check test data matches expected format
- Verify mock server responses
- Ensure temporary files are cleaned up
- Check for race conditions in async tests

### Performance Issues

- Use `--release` flag for performance tests
- Monitor memory usage with `valgrind` or similar tools
- Profile with `cargo flamegraph` for detailed analysis

### Flaky Tests

- Add proper async/await handling
- Use deterministic test data
- Add retry logic for network-dependent tests
- Ensure proper cleanup in test teardown
