import React from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import SectionedIngredients from '../SectionedIngredients';
import { mockIngredients, mockSectionedIngredients } from '../../__tests__/fixtures/recipes';

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(
    <ThemeProvider theme={theme}>
      {component}
    </ThemeProvider>
  );
};

describe('SectionedIngredients', () => {
  it('renders ingredients without sections in a single "Ingredients" section', () => {
    renderWithTheme(<SectionedIngredients ingredients={mockIngredients} />);
    
    // Should not show section header for single "Ingredients" section
    expect(screen.queryByTestId('ingredient-section-header-ingredients')).not.toBeInTheDocument();
    
    // Should show the ingredients table
    expect(screen.getByTestId('ingredient-section-table-ingredients')).toBeInTheDocument();
    
    // Should show all ingredients
    expect(screen.getByText('flour')).toBeInTheDocument();
    expect(screen.getByText('sugar')).toBeInTheDocument();
    expect(screen.getByText('eggs')).toBeInTheDocument();
  });

  it('renders sectioned ingredients with proper section headers', () => {
    renderWithTheme(<SectionedIngredients ingredients={mockSectionedIngredients} />);
    
    // Should show section headers for multiple sections
    expect(screen.getByTestId('ingredient-section-header-white-cake-layer')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-header-cinnamon-layer')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-header-glaze')).toBeInTheDocument();
    
    // Should show section names
    expect(screen.getByText('White Cake Layer')).toBeInTheDocument();
    expect(screen.getByText('Cinnamon Layer')).toBeInTheDocument();
    expect(screen.getByText('Glaze')).toBeInTheDocument();
    
    // Should show ingredients in their respective sections
    expect(screen.getByTestId('ingredient-section-table-white-cake-layer')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-table-cinnamon-layer')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-table-glaze')).toBeInTheDocument();
  });

  it('displays ingredient amounts and units correctly', () => {
    // Create test data inline to ensure it's correct
    const testIngredients = [
      { name: 'flour', amount: 3, unit: 'cups', section: 'A Section' },
      { name: 'milk', amount: 1.5, unit: 'cups', section: 'A Section' },
      { name: 'butter', amount: 1, unit: 'cup', section: 'B Section' },
      { name: 'cinnamon', amount: 1, unit: 'tablespoon', section: 'B Section' },
      { name: 'sugar', amount: 2, unit: 'cups', section: 'C Section' },
      { name: 'vanilla', amount: 1, unit: 'teaspoon', section: 'C Section' },
    ];

    renderWithTheme(<SectionedIngredients ingredients={testIngredients} />);

    // Check that all sections are rendered
    expect(screen.getByTestId('ingredient-section-header-a-section')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-header-b-section')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-section-header-c-section')).toBeInTheDocument();

    // Check specific ingredient amounts
    expect(screen.getByText('3 cups')).toBeInTheDocument(); // flour
    expect(screen.getByText('1 1/2 cups')).toBeInTheDocument(); // milk (1.5 formatted as fraction)
    expect(screen.getByText('1 cup')).toBeInTheDocument(); // butter
    expect(screen.getByText('1 tablespoon')).toBeInTheDocument(); // cinnamon
    expect(screen.getByText('2 cups')).toBeInTheDocument(); // sugar
    expect(screen.getByText('1 teaspoon')).toBeInTheDocument(); // vanilla
  });

  it('handles ingredients with preparation notes', () => {
    const ingredientsWithPrep = [
      { name: 'butter, softened', amount: 1, unit: 'cup', section: 'Test Section' },
      { name: 'onion, diced', amount: 1, unit: '', section: 'Test Section' },
    ];
    
    renderWithTheme(<SectionedIngredients ingredients={ingredientsWithPrep} />);
    
    // Should separate ingredient name from preparation
    expect(screen.getByText('butter')).toBeInTheDocument();
    expect(screen.getByText('softened')).toBeInTheDocument();
    expect(screen.getByText('onion')).toBeInTheDocument();
    expect(screen.getByText('diced')).toBeInTheDocument();
  });

  it('sorts sections correctly with "Ingredients" first', () => {
    const mixedIngredients = [
      { name: 'item1', amount: 1, unit: 'cup', section: 'Z Section' },
      { name: 'item2', amount: 1, unit: 'cup' }, // No section (should go to "Ingredients")
      { name: 'item3', amount: 1, unit: 'cup', section: 'A Section' },
    ];

    renderWithTheme(<SectionedIngredients ingredients={mixedIngredients} />);

    const sectionHeaders = screen.getAllByRole('heading', { level: 3 });
    // When there are multiple sections, "Ingredients" should show a header and come first
    expect(sectionHeaders[0]).toHaveTextContent('Ingredients');
    expect(sectionHeaders[1]).toHaveTextContent('A Section');
    expect(sectionHeaders[2]).toHaveTextContent('Z Section');
  });

  it('applies correct test IDs for accessibility testing', () => {
    renderWithTheme(<SectionedIngredients ingredients={mockSectionedIngredients} data-testid="custom-test-id" />);
    
    // Should use custom test ID for root element
    expect(screen.getByTestId('custom-test-id')).toBeInTheDocument();
    
    // Should have test IDs for individual ingredient rows
    expect(screen.getByTestId('ingredient-row-white-cake-layer-0')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-row-cinnamon-layer-0')).toBeInTheDocument();
    expect(screen.getByTestId('ingredient-row-glaze-0')).toBeInTheDocument();
  });

  it('handles empty ingredients array', () => {
    renderWithTheme(<SectionedIngredients ingredients={[]} />);
    
    // Should render without crashing
    expect(screen.getByTestId('sectioned-ingredients')).toBeInTheDocument();
  });

  it('handles ingredients with missing or empty sections', () => {
    const mixedIngredients = [
      { name: 'item1', amount: 1, unit: 'cup', section: '' },
      { name: 'item2', amount: 1, unit: 'cup', section: undefined },
      { name: 'item3', amount: 1, unit: 'cup' },
    ];
    
    renderWithTheme(<SectionedIngredients ingredients={mixedIngredients} />);
    
    // All should be grouped under "Ingredients"
    expect(screen.getByTestId('ingredient-section-table-ingredients')).toBeInTheDocument();
    expect(screen.getByText('item1')).toBeInTheDocument();
    expect(screen.getByText('item2')).toBeInTheDocument();
    expect(screen.getByText('item3')).toBeInTheDocument();
  });
});
