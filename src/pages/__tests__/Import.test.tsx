import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Import from '@pages/Import';
import { importRecipeFromUrl } from '@services/recipeImport';

// Mock the recipe import service
jest.mock('@services/recipeImport');

const mockImportRecipeFromUrl = importRecipeFromUrl as jest.MockedFunction<typeof importRecipeFromUrl>;

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockImportedRecipe = {
  id: 'imported-recipe-1',
  title: 'Imported Chocolate Cake',
  description: 'A delicious chocolate cake imported from the web',
  image: 'https://example.com/cake.jpg',
  sourceUrl: 'https://example.com/recipe/chocolate-cake',
  prepTime: 'PT30M',
  cookTime: 'PT45M',
  totalTime: 'PT1H15M',
  servings: 8,
  ingredients: [
    { name: 'flour', amount: 2, unit: 'cups' },
    { name: 'sugar', amount: 1.5, unit: 'cups' },
    { name: 'cocoa powder', amount: 0.75, unit: 'cup' },
  ],
  instructions: [
    'Preheat oven to 350°F',
    'Mix dry ingredients',
    'Add wet ingredients',
    'Bake for 45 minutes',
  ],
  tags: ['dessert', 'chocolate', 'cake'],
  dateAdded: '2024-01-15T10:00:00.000Z',
  dateModified: '2024-01-15T10:00:00.000Z',
};

const renderImport = () => {
  return render(
    <BrowserRouter>
      <Import />
    </BrowserRouter>
  );
};

describe('Import Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render import form with URL input', () => {
    renderImport();

    expect(screen.getByText(/enter the url of a recipe/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/recipe url/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import recipe/i })).toBeInTheDocument();
  });

  test('should show supported sites information', () => {
    renderImport();
    
    expect(screen.getByText(/supported sites/i)).toBeInTheDocument();
    expect(screen.getByText(/allrecipes/i)).toBeInTheDocument();
    expect(screen.getByText(/food network/i)).toBeInTheDocument();
    expect(screen.getByText(/bon appétit/i)).toBeInTheDocument();
  });

  test('should import recipe successfully', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });

    await user.type(urlInput, 'https://example.com/recipe/chocolate-cake');
    await user.click(importButton);

    expect(mockImportRecipeFromUrl).toHaveBeenCalledWith('https://example.com/recipe/chocolate-cake');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/recipe imported successfully/i);
    });

    // Should show the imported recipe details
    expect(screen.getByText(mockImportedRecipe.title)).toBeInTheDocument();
  });

  test('should show loading state during import', async () => {
    const user = userEvent.setup();
    // Mock a delayed response
    mockImportRecipeFromUrl.mockImplementation(() => new Promise(() => {}));
    
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    
    await user.type(urlInput, 'https://example.com/recipe/test');
    await user.click(importButton);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(importButton).toBeDisabled();
  });

  test('should handle import errors gracefully', async () => {
    const user = userEvent.setup();
    const errorMessage = 'Failed to import recipe: Invalid URL';
    mockImportRecipeFromUrl.mockRejectedValue(new Error(errorMessage));
    
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    
    await user.type(urlInput, 'https://invalid-site.com/recipe');
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('should validate empty URL before importing', async () => {
    renderImport();

    const importButton = screen.getByRole('button', { name: /import recipe/i });

    // Button should be disabled when URL is empty
    expect(importButton).toBeDisabled();

    // Since button is disabled, clicking it won't work and import shouldn't be called
    expect(mockImportRecipeFromUrl).not.toHaveBeenCalled();
  });

  test('should show error for whitespace-only URL', async () => {
    const user = userEvent.setup();

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });

    await user.type(urlInput, '   ');

    // Button should still be disabled for whitespace-only input
    expect(importButton).toBeDisabled();

    expect(mockImportRecipeFromUrl).not.toHaveBeenCalled();
  });

  test('should clear error message when URL is changed', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockRejectedValue(new Error('Import failed'));
    
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    
    // Trigger error
    await user.type(urlInput, 'https://invalid-site.com/recipe');
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByText('Import failed')).toBeInTheDocument();
    });
    
    // Change URL should clear error
    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/new-recipe');
    
    expect(screen.queryByText('Import failed')).not.toBeInTheDocument();
  });

  test('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);
    
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    
    // Tab to URL input
    await user.tab();
    expect(urlInput).toHaveFocus();
    
    await user.type(urlInput, 'https://example.com/recipe/test');
    
    // Tab to import button
    await user.tab();
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    expect(importButton).toHaveFocus();
    
    // Press Enter to import
    await user.keyboard('{Enter}');
    
    expect(mockImportRecipeFromUrl).toHaveBeenCalled();
  });

  test('should handle Enter key in URL input', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);

    await user.type(urlInput, 'https://example.com/recipe/test');
    await user.keyboard('{Enter}');

    // Enter key now triggers import
    expect(mockImportRecipeFromUrl).toHaveBeenCalledWith('https://example.com/recipe/test');
  });

  test('should show import instructions', () => {
    renderImport();

    expect(screen.getByText(/enter the url of a recipe/i)).toBeInTheDocument();
    expect(screen.getByText(/supported sites/i)).toBeInTheDocument();
  });

  test('should handle very long URLs', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    const longUrl = 'https://example.com/recipe/' + 'a'.repeat(1000);

    await user.type(urlInput, longUrl);
    await user.click(importButton);

    expect(mockImportRecipeFromUrl).toHaveBeenCalledWith(longUrl);
  });

  test('should handle special characters in URLs', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    const specialUrl = 'https://example.com/recipe/café-crème?param=value&other=test';

    await user.type(urlInput, specialUrl);
    await user.click(importButton);

    expect(mockImportRecipeFromUrl).toHaveBeenCalledWith(specialUrl);
  });

  test('should trim whitespace from URL input', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);

    renderImport();

    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    const urlWithWhitespace = '  https://example.com/recipe/test  ';

    await user.type(urlInput, urlWithWhitespace);
    await user.click(importButton);

    expect(mockImportRecipeFromUrl).toHaveBeenCalledWith('https://example.com/recipe/test');
  });

  test('should have proper accessibility attributes', () => {
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    
    expect(urlInput).toHaveAttribute('type', 'url');
    expect(urlInput).toHaveAttribute('aria-describedby');
    expect(importButton).toHaveAttribute('aria-label');
  });

  test('should show success message after successful import', async () => {
    const user = userEvent.setup();
    mockImportRecipeFromUrl.mockResolvedValue(mockImportedRecipe);
    
    renderImport();
    
    const urlInput = screen.getByLabelText(/recipe url/i);
    const importButton = screen.getByRole('button', { name: /import recipe/i });
    
    await user.type(urlInput, 'https://example.com/recipe/test');
    await user.click(importButton);
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/recipe imported successfully/i);
    });
  });
});
