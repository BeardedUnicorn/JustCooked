import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { userEvent, within, expect } from 'storybook/test';
import AdvancedSearchModal from './AdvancedSearchModal';
import { SearchFilters } from '@app-types';

const meta: Meta<typeof AdvancedSearchModal> = {
  title: 'Modals/AdvancedSearchModal',
  component: AdvancedSearchModal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    onClose: { action: 'closed' },
    onSearch: { action: 'searched' },
    open: { control: 'boolean' },
    initialFilters: { control: 'object' },
  },
  args: {
    open: true,
    onClose: fn(),
    onSearch: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Open Story: Basic modal display
export const DefaultOpen: Story = {
  args: {
    open: true,
  },
};

// With Initial Filters Story: Modal with pre-populated filters
export const WithInitialFilters: Story = {
  args: {
    open: true,
    initialFilters: {
      difficulty: ['Easy', 'Medium'],
      tags: ['vegetarian', 'quick', 'healthy'],
      prepTime: '15-30',
      cookTime: '30-60',
      totalTime: '60-120',
      servings: [2, 6],
      rating: 3.5,
    } as SearchFilters,
  },
};

// Closed State Story: Modal in closed state
export const Closed: Story = {
  args: {
    open: false,
  },
};

// Empty Filters Story: Modal with no initial filters (same as default but explicit)
export const EmptyFilters: Story = {
  args: {
    open: true,
    initialFilters: {},
  },
};

// Single Filter Category Story: Only difficulty filters set
export const OnlyDifficultyFilters: Story = {
  args: {
    open: true,
    initialFilters: {
      difficulty: ['Hard'],
    } as SearchFilters,
  },
};

// Time Filters Only Story: Only time-related filters set
export const OnlyTimeFilters: Story = {
  args: {
    open: true,
    initialFilters: {
      prepTime: '0-15',
      cookTime: '15-30',
      totalTime: '30-60',
    } as SearchFilters,
  },
};

// Slider Filters Only Story: Only slider-based filters set
export const OnlySliderFilters: Story = {
  args: {
    open: true,
    initialFilters: {
      servings: [4, 8],
      rating: 4.0,
    } as SearchFilters,
  },
};

// Many Tags Story: Modal with many tags selected
export const ManyTags: Story = {
  args: {
    open: true,
    initialFilters: {
      tags: ['breakfast', 'lunch', 'dinner', 'vegetarian', 'vegan', 'gluten-free', 'quick', 'healthy'],
    } as SearchFilters,
  },
};

// All Filters Set Story: Modal with all possible filters set
export const AllFiltersSet: Story = {
  args: {
    open: true,
    initialFilters: {
      difficulty: ['Easy', 'Medium', 'Hard'],
      tags: ['vegetarian', 'quick', 'healthy', 'italian', 'baking'],
      prepTime: '30-60',
      cookTime: '60-120',
      totalTime: '120+',
      servings: [1, 12],
      rating: 4.5,
    } as SearchFilters,
  },
};

// Interaction Tests Story: Test all interactive elements
export const InteractionTests: Story = {
  args: {
    open: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Test difficulty selection
    const difficultySelect = canvas.getByTestId('advancedSearchModal-select-difficulty');
    await userEvent.click(difficultySelect);
    
    // Select Easy difficulty
    const easyOption = canvas.getByRole('option', { name: 'Easy' });
    await userEvent.click(easyOption);
    
    // Click outside to close the dropdown
    await userEvent.click(canvas.getByText('Advanced Search'));
    
    // Verify difficulty chip appears
    expect(canvas.getByTestId('advancedSearchModal-chip-difficulty-easy')).toBeInTheDocument();
    
    // Test tags autocomplete
    const tagsInput = canvas.getByTestId('advancedSearchModal-autocomplete-tagsInput').querySelector('input');
    if (tagsInput) {
      await userEvent.type(tagsInput, 'vegetarian');
      await userEvent.keyboard('{ArrowDown}');
      await userEvent.keyboard('{Enter}');
      
      // Verify tag chip appears
      expect(canvas.getByTestId('advancedSearchModal-chip-tag-vegetarian')).toBeInTheDocument();
    }
    
    // Test prep time selection
    const prepTimeSelect = canvas.getByTestId('advancedSearchModal-select-prepTime');
    await userEvent.click(prepTimeSelect);
    
    const prepTimeOption = canvas.getByRole('option', { name: '15-30 minutes' });
    await userEvent.click(prepTimeOption);
    
    // Test servings slider (approximate interaction)
    const servingsSlider = canvas.getByTestId('advancedSearchModal-slider-servings');
    // Note: Slider interaction in tests is complex, so we'll just verify it exists
    expect(servingsSlider).toBeInTheDocument();
    
    // Test rating slider
    const ratingSlider = canvas.getByTestId('advancedSearchModal-slider-rating');
    expect(ratingSlider).toBeInTheDocument();
    
    // Test Apply Filters button
    const applyButton = canvas.getByTestId('advancedSearchModal-button-apply');
    await userEvent.click(applyButton);
    
    // Verify onSearch was called with filters
    expect(args.onSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        difficulty: ['Easy'],
        tags: ['vegetarian'],
        prepTime: '15-30',
      })
    );
  },
};

// Reset Functionality Story: Test reset button
export const ResetFunctionality: Story = {
  args: {
    open: true,
    initialFilters: {
      difficulty: ['Easy'],
      tags: ['vegetarian'],
      prepTime: '15-30',
      servings: [2, 6],
      rating: 3.0,
    } as SearchFilters,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Verify initial filters are displayed
    expect(canvas.getByTestId('advancedSearchModal-chip-difficulty-easy')).toBeInTheDocument();
    expect(canvas.getByTestId('advancedSearchModal-chip-tag-vegetarian')).toBeInTheDocument();
    
    // Click Reset button
    const resetButton = canvas.getByTestId('advancedSearchModal-button-reset');
    await userEvent.click(resetButton);
    
    // Verify filters are cleared (chips should be gone)
    expect(canvas.queryByTestId('advancedSearchModal-chip-difficulty-easy')).not.toBeInTheDocument();
    expect(canvas.queryByTestId('advancedSearchModal-chip-tag-vegetarian')).not.toBeInTheDocument();
  },
};

// Cancel Functionality Story: Test cancel button
export const CancelFunctionality: Story = {
  args: {
    open: true,
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    
    // Click Cancel button
    const cancelButton = canvas.getByTestId('advancedSearchModal-button-cancel');
    await userEvent.click(cancelButton);
    
    // Verify onClose was called
    expect(args.onClose).toHaveBeenCalled();
  },
};

// Time Selection Story: Test all time filter options
export const TimeSelectionTest: Story = {
  args: {
    open: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Test prep time selection
    const prepTimeSelect = canvas.getByTestId('advancedSearchModal-select-prepTime');
    await userEvent.click(prepTimeSelect);
    
    // Select "Under 15 minutes"
    const under15Option = canvas.getByRole('option', { name: 'Under 15 minutes' });
    await userEvent.click(under15Option);
    
    // Test cook time selection
    const cookTimeSelect = canvas.getByTestId('advancedSearchModal-select-cookTime');
    await userEvent.click(cookTimeSelect);
    
    // Select "30-60 minutes"
    const cook30to60Option = canvas.getByRole('option', { name: '30-60 minutes' });
    await userEvent.click(cook30to60Option);
    
    // Test total time selection
    const totalTimeSelect = canvas.getByTestId('advancedSearchModal-select-totalTime');
    await userEvent.click(totalTimeSelect);
    
    // Select "1-2 hours"
    const total1to2Option = canvas.getByRole('option', { name: '1-2 hours' });
    await userEvent.click(total1to2Option);
  },
};

// Multiple Difficulty Selection Story: Test selecting multiple difficulties
export const MultipleDifficultySelection: Story = {
  args: {
    open: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    
    // Open difficulty dropdown
    const difficultySelect = canvas.getByTestId('advancedSearchModal-select-difficulty');
    await userEvent.click(difficultySelect);
    
    // Select Easy
    const easyOption = canvas.getByRole('option', { name: 'Easy' });
    await userEvent.click(easyOption);
    
    // Select Medium (without closing dropdown)
    const mediumOption = canvas.getByRole('option', { name: 'Medium' });
    await userEvent.click(mediumOption);
    
    // Click outside to close dropdown
    await userEvent.click(canvas.getByText('Advanced Search'));
    
    // Verify both chips appear
    expect(canvas.getByTestId('advancedSearchModal-chip-difficulty-easy')).toBeInTheDocument();
    expect(canvas.getByTestId('advancedSearchModal-chip-difficulty-medium')).toBeInTheDocument();
  },
};
