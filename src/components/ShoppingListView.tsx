import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Divider,
  Button,
  Alert,
  Collapse,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Delete as DeleteIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  Category as CategoryIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon,
} from '@mui/icons-material';
import {
  ShoppingList,
  ShoppingListItem,
  getCategoryDisplayName,
  getCategoryOrder,
} from '@app-types';
import {
  getShoppingListItems,
  updateShoppingListItemChecked,
  deleteShoppingListItem,
  groupShoppingListItemsByCategory,
  calculateShoppingListProgress,
  exportShoppingListAsText,
} from '@services/shoppingListStorage';

interface ShoppingListViewProps {
  shoppingList: ShoppingList;
  onItemsChanged?: () => void;
  onDelete?: () => void;
}

const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  shoppingList,
  onItemsChanged,
}) => {
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedItem, setSelectedItem] = useState<ShoppingListItem | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadItems();
  }, [shoppingList.id]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const shoppingListItems = await getShoppingListItems(shoppingList.id);
      setItems(shoppingListItems);
      setError(null);
    } catch (err) {
      setError('Failed to load shopping list items');
      console.error('Error loading shopping list items:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleItemCheckedChange = async (item: ShoppingListItem, checked: boolean) => {
    try {
      await updateShoppingListItemChecked(item.id, checked);
      
      // Update local state
      setItems(prevItems =>
        prevItems.map(prevItem =>
          prevItem.id === item.id ? { ...prevItem, isChecked: checked } : prevItem
        )
      );
      
      onItemsChanged?.();
    } catch (err) {
      setError('Failed to update item status');
      console.error('Error updating item checked status:', err);
    }
  };

  const handleDeleteItem = async (item: ShoppingListItem) => {
    try {
      await deleteShoppingListItem(item.id);
      setItems(prevItems => prevItems.filter(prevItem => prevItem.id !== item.id));
      onItemsChanged?.();
      setMenuAnchor(null);
      setSelectedItem(null);
    } catch (err) {
      setError('Failed to delete item');
      console.error('Error deleting item:', err);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, item: ShoppingListItem) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedItem(null);
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  const handlePrint = () => {
    const textContent = exportShoppingListAsText(shoppingList, items);
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${shoppingList.name}</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              pre { white-space: pre-wrap; font-family: inherit; }
            </style>
          </head>
          <body>
            <pre>${textContent}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleShare = async () => {
    const textContent = exportShoppingListAsText(shoppingList, items);
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: shoppingList.name,
          text: textContent,
        });
      } catch (err) {
        console.log('Share cancelled or failed');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(textContent);
        // You could show a toast notification here
        console.log('Shopping list copied to clipboard');
      } catch (err) {
        console.error('Failed to copy to clipboard:', err);
      }
    }
  };

  const formatQuantity = (quantity: number, unit: string) => {
    const rounded = Math.round(quantity * 100) / 100;
    const formatted = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${formatted} ${unit}`;
  };

  const formatDateRange = () => {
    const startDate = new Date(shoppingList.dateRangeStart).toLocaleDateString();
    const endDate = new Date(shoppingList.dateRangeEnd).toLocaleDateString();
    return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }} data-testid="shoppingListView-loading-main">
        <LinearProgress />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Loading shopping list...
        </Typography>
      </Box>
    );
  }

  const groupedItems = groupShoppingListItemsByCategory(items);
  const progress = calculateShoppingListProgress(items);
  const sortedCategories = Object.keys(groupedItems).sort((a, b) => 
    getCategoryOrder(a) - getCategoryOrder(b)
  );

  return (
    <Box data-testid="shoppingListView-container-main">
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} data-testid="shoppingListView-alert-error">
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h5" component="h1" gutterBottom data-testid="shoppingListView-text-name">
              {shoppingList.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" data-testid="shoppingListView-text-dateRange">
              {formatDateRange()}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PrintIcon />}
              onClick={handlePrint}
              data-testid="shopping-list-print-button"
            >
              Print
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<ShareIcon />}
              onClick={handleShare}
              data-testid="shopping-list-share-button"
            >
              Share
            </Button>
          </Box>
        </Box>

        {/* Progress */}
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary" data-testid="shoppingListView-text-progress">
              Progress: {progress.completed} of {progress.total} items
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progress.percentage}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress.percentage}
            sx={{ height: 8, borderRadius: 4 }}
            data-testid="shoppingListView-progressBar-main"
          />
        </Box>

        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={`${items.length} items`}
            size="small"
            color="primary"
            variant="outlined"
          />
          <Chip
            label={`${sortedCategories.length} categories`}
            size="small"
            color="secondary"
            variant="outlined"
          />
        </Box>
      </Paper>

      {/* Shopping List Items */}
      {sortedCategories.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }} data-testid="shoppingListView-text-empty">
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No items in this shopping list
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This shopping list appears to be empty.
          </Typography>
        </Paper>
      ) : (
        sortedCategories.map((category) => {
          const categoryItems = groupedItems[category];
          const isCollapsed = collapsedCategories.has(category);
          const checkedCount = categoryItems.filter(item => item.isChecked).length;

          return (
            <Paper key={category} sx={{ mb: 2 }}>
              {/* Category Header */}
              <Box
                sx={{
                  p: 2,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': { backgroundColor: 'action.hover' },
                }}
                onClick={() => toggleCategoryCollapse(category)}
                data-testid={`shopping-list-category-${category}`}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CategoryIcon color="action" />
                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                    {getCategoryDisplayName(category)}
                  </Typography>
                  <Chip
                    label={`${checkedCount}/${categoryItems.length}`}
                    size="small"
                    color={checkedCount === categoryItems.length ? 'success' : 'default'}
                    variant="outlined"
                  />
                </Box>
                <IconButton
                  size="small"
                  data-testid={`shoppingListView-category-toggle-${category}`}
                  sx={{ pointerEvents: 'none' }} // Prevent double-click handling
                >
                  {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                </IconButton>
              </Box>

              {/* Category Items */}
              <Collapse in={!isCollapsed}>
                <List sx={{ pt: 0 }}>
                  {categoryItems.map((item, index) => (
                    <React.Fragment key={item.id}>
                      <ListItem
                        sx={{
                          pl: 4,
                          opacity: item.isChecked ? 0.6 : 1,
                          textDecoration: item.isChecked ? 'line-through' : 'none',
                        }}
                        data-testid={`shopping-list-item-${item.id}`}
                      >
                        <ListItemIcon>
                          <Checkbox
                            checked={item.isChecked}
                            onChange={(e) => handleItemCheckedChange(item, e.target.checked)}
                            icon={<RadioButtonUncheckedIcon />}
                            checkedIcon={<CheckCircleIcon />}
                            data-testid={`shopping-list-item-checkbox-${item.id}`}
                          />
                        </ListItemIcon>
                        
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="body1" component="span" data-testid={`shoppingListView-text-itemQuantity-${item.id}`}>
                                {formatQuantity(item.quantity, item.unit)}
                              </Typography>
                              <Typography variant="body1" component="span" data-testid={`shoppingListView-text-itemName-${item.id}`} sx={{ ml: 1 }}>
                                {item.ingredientName}
                              </Typography>
                            </Box>
                          }
                          secondary={item.notes ? (
                            <Typography variant="body2" data-testid={`shoppingListView-text-itemNotes-${item.id}`}>
                              {item.notes}
                            </Typography>
                          ) : null}
                        />
                        
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={(e) => handleMenuOpen(e, item)}
                            data-testid={`shopping-list-item-menu-${item.id}`}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                      
                      {index < categoryItems.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              </Collapse>
            </Paper>
          );
        })
      )}

      {/* Item Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        data-testid="shopping-list-item-context-menu"
      >
        <MenuItem
          onClick={() => {
            if (selectedItem) {
              handleDeleteItem(selectedItem);
            }
          }}
          data-testid="shopping-list-item-delete"
        >
          <DeleteIcon sx={{ mr: 1 }} />
          Delete Item
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ShoppingListView;
