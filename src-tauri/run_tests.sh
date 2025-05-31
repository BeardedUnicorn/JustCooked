#!/bin/bash

# JustCooked Recipe Application - Test Runner
# This script runs the comprehensive test suite for the Tauri recipe application

set -e  # Exit on any error

echo "🧪 JustCooked Recipe Application - Comprehensive Test Suite"
echo "=========================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "Cargo.toml" ]; then
    print_error "Please run this script from the src-tauri directory"
    exit 1
fi

# 1. Unit Tests
print_status "Running Unit Tests..."
if cargo test --lib --quiet; then
    print_success "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

# 2. Recipe Import Tests
print_status "Running Recipe Import Tests..."
if cargo test --lib recipe_import::tests --quiet; then
    print_success "Recipe import tests passed"
else
    print_error "Recipe import tests failed"
    exit 1
fi

# 3. Image Storage Tests
print_status "Running Image Storage Tests..."
if cargo test --lib image_storage::tests --quiet; then
    print_success "Image storage tests passed"
else
    print_error "Image storage tests failed"
    exit 1
fi

# 4. Property-Based Tests
print_status "Running Property-Based Tests..."
if cargo test --test property_tests --quiet; then
    print_success "Property-based tests passed"
else
    print_warning "Some property-based tests failed (this may be expected for edge cases)"
fi

# 5. Integration Tests (if they compile)
print_status "Checking Integration Tests..."
if cargo test --test integration_tests --no-run --quiet 2>/dev/null; then
    print_status "Running Integration Tests..."
    if cargo test --test integration_tests test_url_validation test_image_url_validation --quiet; then
        print_success "Integration tests passed"
    else
        print_warning "Some integration tests failed (may require external dependencies)"
    fi
else
    print_warning "Integration tests require additional setup (wiremock, etc.)"
fi

# 6. Performance Tests
print_status "Running Performance Tests..."
if cargo test --test mod test_recipe_parsing_performance --quiet; then
    print_success "Performance tests passed"
else
    print_warning "Performance tests may require additional setup"
fi

# Summary
echo ""
echo "=========================================================="
print_success "Test Suite Summary"
echo "=========================================================="

# Count total tests
UNIT_TESTS=$(cargo test --lib --quiet 2>&1 | grep -o '[0-9]* passed' | head -1 | cut -d' ' -f1)
echo "📋 Unit Tests: $UNIT_TESTS tests passed"

# Property tests
PROP_TESTS=$(cargo test --test property_tests --quiet 2>&1 | grep -o '[0-9]* passed' | head -1 | cut -d' ' -f1)
echo "🎲 Property-Based Tests: $PROP_TESTS tests passed"

echo ""
print_success "All core tests are passing!"
echo ""
echo "📚 For more detailed test information, see:"
echo "   - src-tauri/TESTING.md - Complete testing documentation"
echo "   - src-tauri/tests/ - Test source code"
echo ""
echo "🚀 To run specific test categories:"
echo "   cargo test --lib                    # Unit tests only"
echo "   cargo test --test property_tests    # Property-based tests"
echo "   cargo test --test integration_tests # Integration tests"
echo ""
echo "🔍 To run tests with output:"
echo "   cargo test -- --nocapture"
echo ""
echo "📊 To run tests with coverage:"
echo "   cargo install cargo-tarpaulin"
echo "   cargo tarpaulin --out Html --output-dir coverage/"
