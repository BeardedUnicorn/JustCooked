import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Pantry from '../Pantry';
import * as pantryStorage from '@services/pantryStorage';

// Mock the pantry storage service
vi.mock('@services/pantryStorage');
const mockGetPantryItems = vi.mocked(pantryStorage.getPantryItems);

const renderPantry = () => {
  return render(
    <BrowserRouter>
      <Pantry />
    </BrowserRouter>
  );
};

describe('Pantry Page', () => {
  beforeEach(() => {
    mockGetPantryItems.mockResolvedValue([]);
  });

  it('renders without crashing', () => {
    renderPantry();
    expect(screen.getByText(/Track ingredients you have at home/i)).toBeInTheDocument();
  });
});
