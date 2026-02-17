import type { Meta, StoryObj } from '@storybook/react';
import SectionedIngredients from './SectionedIngredients';
import { mockIngredients, mockSectionedIngredients } from '@/__tests__/fixtures/recipes';
import { Ingredient } from '@app-types';

const meta: Meta<typeof SectionedIngredients> = {
  title: 'Display/SectionedIngredients',
  component: SectionedIngredients,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    ingredients: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default Story (No Sections): Use mockIngredients
export const Default: Story = {
  args: {
    ingredients: mockIngredients,
  },
};

// With Sections Story: Use mockSectionedIngredients
export const WithSections: Story = {
  args: {
    ingredients: mockSectionedIngredients,
  },
};

// Empty State Story: ingredients=[]
export const EmptyState: Story = {
  args: {
    ingredients: [],
  },
};

// Long Ingredient Names Story: Test how long names/preparations are handled
export const LongIngredientNames: Story = {
  args: {
    ingredients: [
      {
        name: 'extra-virgin olive oil, preferably cold-pressed and organic',
        amount: 0.25,
        unit: 'cup',
        section: 'Base Ingredients',
      },
      {
        name: 'freshly ground black pepper, coarsely ground with a mortar and pestle',
        amount: 1,
        unit: 'teaspoon',
        section: 'Seasonings',
      },
      {
        name: 'artisanal aged balsamic vinegar from Modena, Italy, aged at least 12 years',
        amount: 2,
        unit: 'tablespoons',
        section: 'Finishing Touches',
      },
      {
        name: 'sea salt, preferably flaky Maldon or kosher salt, to taste',
        amount: 1,
        unit: 'pinch',
        section: 'Seasonings',
      },
      {
        name: 'fresh basil leaves, hand-picked and gently torn, not chopped with a knife',
        amount: 0.5,
        unit: 'cup',
        section: 'Herbs and Garnishes',
      },
    ] as Ingredient[],
  },
};

// Single Section Story: All ingredients in one section
export const SingleSection: Story = {
  args: {
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cups', section: 'Dry Ingredients' },
      { name: 'sugar', amount: 1, unit: 'cup', section: 'Dry Ingredients' },
      { name: 'baking powder', amount: 2, unit: 'teaspoons', section: 'Dry Ingredients' },
      { name: 'salt', amount: 0.5, unit: 'teaspoon', section: 'Dry Ingredients' },
    ] as Ingredient[],
  },
};

// Mixed Sections Story: Some ingredients with sections, some without
export const MixedSections: Story = {
  args: {
    ingredients: [
      { name: 'flour', amount: 2, unit: 'cups' }, // No section
      { name: 'sugar', amount: 1, unit: 'cup', section: 'Sweeteners' },
      { name: 'eggs', amount: 3, unit: '' }, // No section
      { name: 'vanilla extract', amount: 1, unit: 'teaspoon', section: 'Flavorings' },
      { name: 'milk', amount: 0.5, unit: 'cup' }, // No section
      { name: 'cinnamon', amount: 1, unit: 'teaspoon', section: 'Spices' },
    ] as Ingredient[],
  },
};

// Preparation Methods Story: Ingredients with various preparation notes
export const WithPreparationMethods: Story = {
  args: {
    ingredients: [
      { name: 'butter, softened', amount: 1, unit: 'cup', section: 'Fats' },
      { name: 'onion, diced', amount: 1, unit: 'large', section: 'Vegetables' },
      { name: 'garlic, minced', amount: 3, unit: 'cloves', section: 'Aromatics' },
      { name: 'chicken breast, boneless and skinless, cut into strips', amount: 2, unit: 'pounds', section: 'Proteins' },
      { name: 'parmesan cheese, freshly grated', amount: 0.5, unit: 'cup', section: 'Dairy' },
      { name: 'fresh herbs, chopped', amount: 2, unit: 'tablespoons', section: 'Garnishes' },
    ] as Ingredient[],
  },
};

// Large Recipe Story: Many ingredients across multiple sections
export const LargeRecipe: Story = {
  args: {
    ingredients: [
      // Cake Layer
      { name: 'all-purpose flour', amount: 3, unit: 'cups', section: 'Cake Layer' },
      { name: 'granulated sugar', amount: 2, unit: 'cups', section: 'Cake Layer' },
      { name: 'unsalted butter, softened', amount: 1, unit: 'cup', section: 'Cake Layer' },
      { name: 'large eggs', amount: 4, unit: '', section: 'Cake Layer' },
      { name: 'whole milk', amount: 1, unit: 'cup', section: 'Cake Layer' },
      { name: 'vanilla extract', amount: 2, unit: 'teaspoons', section: 'Cake Layer' },
      { name: 'baking powder', amount: 2, unit: 'teaspoons', section: 'Cake Layer' },
      { name: 'salt', amount: 0.5, unit: 'teaspoon', section: 'Cake Layer' },
      
      // Frosting
      { name: 'cream cheese, softened', amount: 8, unit: 'ounces', section: 'Cream Cheese Frosting' },
      { name: 'unsalted butter, softened', amount: 0.5, unit: 'cup', section: 'Cream Cheese Frosting' },
      { name: 'powdered sugar', amount: 4, unit: 'cups', section: 'Cream Cheese Frosting' },
      { name: 'vanilla extract', amount: 1, unit: 'teaspoon', section: 'Cream Cheese Frosting' },
      { name: 'heavy cream', amount: 2, unit: 'tablespoons', section: 'Cream Cheese Frosting' },
      
      // Decoration
      { name: 'fresh strawberries, sliced', amount: 2, unit: 'cups', section: 'Decoration' },
      { name: 'mint leaves, fresh', amount: 12, unit: '', section: 'Decoration' },
      { name: 'chocolate shavings', amount: 0.25, unit: 'cup', section: 'Decoration' },
    ] as Ingredient[],
  },
};
