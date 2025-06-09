import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import Collections from '../Collections';
import darkTheme from '../../theme';
import * as recipeCollectionStorage from '../../services/recipeCollectionStorage';

// Mock the navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock the storage service
jest.mock('../../services/recipeCollectionStorage');

const mockCollections = [
  {
    id: '1',
    name: 'Weeknight Dinners',
    description: 'Quick and easy meals for busy weeknights',
    recipeIds: ['recipe1', 'recipe2'],
    dateCreated: '2023-01-01T00:00:00.000Z',
    dateModified: '2023-01-02T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Holiday Desserts',
    description: 'Special treats for the holidays',
    recipeIds: ['recipe3'],
    dateCreated: '2023-01-03T00:00:00.000Z',
    dateModified: '2023-01-04T00:00:00.000Z',
  },
];

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={darkTheme}>
        {component}
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Collections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (recipeCollectionStorage.getAllCollections as jest.Mock).mockResolvedValue(mockCollections);
  });

  it('renders collections page with header', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Collections')).toBeInTheDocument();
      expect(screen.getByText('Add Collection')).toBeInTheDocument();
    });
  });

  it('displays collections when they exist', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Weeknight Dinners')).toBeInTheDocument();
      expect(screen.getByText('Holiday Desserts')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Quick and easy meals for busy weeknights')).toBeInTheDocument();
    expect(screen.getByText('Special treats for the holidays')).toBeInTheDocument();
    expect(screen.getByText('2 recipes')).toBeInTheDocument();
    expect(screen.getByText('1 recipe')).toBeInTheDocument();
  });

  it('displays empty state when no collections exist', async () => {
    (recipeCollectionStorage.getAllCollections as jest.Mock).mockResolvedValue([]);
    
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('No collections yet')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Create your first collection to organize your favorite recipes!')).toBeInTheDocument();
    expect(screen.getByText('Create Collection')).toBeInTheDocument();
  });

  it('opens create collection dialog when add button is clicked', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Add Collection')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Collection'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Collection')).toBeInTheDocument();
    });
    
    expect(screen.getByLabelText('Collection Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
  });

  it('creates a new collection when form is submitted', async () => {
    const mockCreateCollection = jest.fn().mockReturnValue({
      id: '3',
      name: 'Test Collection',
      description: 'Test description',
      recipeIds: [],
      dateCreated: '2023-01-05T00:00:00.000Z',
      dateModified: '2023-01-05T00:00:00.000Z',
    });
    (recipeCollectionStorage.createCollection as jest.Mock).mockImplementation(mockCreateCollection);
    
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Add Collection')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Collection'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Collection')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByLabelText('Collection Name'), {
      target: { value: 'Test Collection' },
    });
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'Test description' },
    });
    
    fireEvent.click(screen.getByText('Create Collection'));
    
    await waitFor(() => {
      expect(mockCreateCollection).toHaveBeenCalledWith('Test Collection', 'Test description');
    });
  });

  it('navigates to collection view when collection is clicked', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Weeknight Dinners')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Weeknight Dinners'));
    
    expect(mockNavigate).toHaveBeenCalledWith('/collections/1');
  });

  it('opens edit dialog when edit button is clicked', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Holiday Desserts')).toBeInTheDocument();
    });
    
    const editButtons = screen.getAllByLabelText('Edit collection');
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });
    
    expect(screen.getByDisplayValue('Holiday Desserts')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Special treats for the holidays')).toBeInTheDocument();
  });

  it('updates collection when edit form is submitted', async () => {
    const mockSaveCollection = jest.fn();
    (recipeCollectionStorage.saveCollection as jest.Mock).mockImplementation(mockSaveCollection);
    
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Holiday Desserts')).toBeInTheDocument();
    });
    
    const editButtons = screen.getAllByLabelText('Edit collection');
    fireEvent.click(editButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Edit Collection')).toBeInTheDocument();
    });
    
    const nameInput = screen.getByDisplayValue('Holiday Desserts');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });
    
    fireEvent.click(screen.getByText('Save Changes'));
    
    await waitFor(() => {
      expect(mockSaveCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '2',
          name: 'Updated Name',
          description: 'Special treats for the holidays',
        })
      );
    });
  });

  it('opens delete dialog when delete button is clicked', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Holiday Desserts')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByLabelText('Delete collection');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Collection')).toBeInTheDocument();
    });
    
    expect(screen.getByText(/Are you sure you want to delete "Holiday Desserts"/)).toBeInTheDocument();
  });

  it('deletes collection when delete is confirmed', async () => {
    const mockDeleteCollection = jest.fn();
    (recipeCollectionStorage.deleteCollection as jest.Mock).mockImplementation(mockDeleteCollection);
    
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Holiday Desserts')).toBeInTheDocument();
    });
    
    const deleteButtons = screen.getAllByLabelText('Delete collection');
    fireEvent.click(deleteButtons[0]);
    
    await waitFor(() => {
      expect(screen.getByText('Delete Collection')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Delete'));
    
    await waitFor(() => {
      expect(mockDeleteCollection).toHaveBeenCalledWith('2');
    });
  });

  it('handles error when loading collections fails', async () => {
    (recipeCollectionStorage.getAllCollections as jest.Mock).mockImplementation(() => {
      throw new Error('Failed to load');
    });
    
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Failed to load collections')).toBeInTheDocument();
    });
  });

  it('disables create button when name is empty', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Add Collection')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Add Collection'));
    
    await waitFor(() => {
      expect(screen.getByText('Create New Collection')).toBeInTheDocument();
    });
    
    const createButton = screen.getByText('Create Collection');
    expect(createButton).toBeDisabled();
    
    fireEvent.change(screen.getByLabelText('Collection Name'), {
      target: { value: 'Test' },
    });
    
    expect(createButton).not.toBeDisabled();
  });

  it('formats dates correctly', async () => {
    renderWithProviders(<Collections />);
    
    await waitFor(() => {
      expect(screen.getByText('Jan 3, 2023')).toBeInTheDocument();
      expect(screen.getByText('Jan 1, 2023')).toBeInTheDocument();
    });
  });
});
