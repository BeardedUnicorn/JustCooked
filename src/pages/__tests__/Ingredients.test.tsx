import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Ingredients from '../Ingredients';
import * as ingredientStorage from '@services/ingredientStorage';

// Mock the ingredient storage service
jest.mock('@services/ingredientStorage');
const mockLoadIngredients = ingredientStorage.loadIngredients as jest.MockedFunction<typeof ingredientStorage.loadIngredients>;

const renderIngredients = () => {
  return render(
    <BrowserRouter>
      <Ingredients />
    </BrowserRouter>
  );
};

describe('Ingredients Page', () => {
  beforeEach(() => {
    mockLoadIngredients.mockReturnValue([]);
  });

  it('renders without crashing', () => {
    renderIngredients();
    expect(screen.getByLabelText(/Search ingredients/i)).toBeInTheDocument();
  });
});
