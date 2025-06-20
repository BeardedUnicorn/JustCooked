import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  IconButton,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { invoke } from '@tauri-apps/api/core';
import { Product, ProductSearchResult, PantryItem } from '@app-types';
import IngredientAssociationModal from './IngredientAssociationModal';
import BarcodeScanner from './BarcodeScanner';
import CreateProductDialog, { CreateProductData } from './CreateProductDialog';
import { IngredientAssociation } from '@app-types/productIngredientMapping';
import { ProductIngredientMappingService } from '@services/productIngredientMappingService';

interface ProductSearchModalProps {
  open: boolean;
  onClose: () => void;
  onAddProduct: (item: PantryItem) => void;
}

const categories = [
  'Produce', 'Dairy', 'Meat', 'Grains', 'Baking', 'Spices', 'Canned Goods', 'Frozen', 'Other'
];

const units = [
  'g', 'kg', 'ml', 'l', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'piece(s)'
];

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({
  open,
  onClose,
  onAddProduct,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState('piece(s)');
  const [category, setCategory] = useState('Other');
  const [expiryDate, setExpiryDate] = useState('');
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [pendingPantryItem, setPendingPantryItem] = useState<PantryItem | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showCreateProductDialog, setShowCreateProductDialog] = useState(false);
  const [scannedUpcCode, setScannedUpcCode] = useState('');

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      await performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const result = await invoke<ProductSearchResult>('db_search_products', {
        query: query.trim(),
        limit: 10,
      });

      // Filter out products with empty, null, or undefined product names
      const filteredProducts = result.products.filter(product =>
        product.product_name &&
        product.product_name.trim() !== ''
      );

      setSearchResults(filteredProducts);
    } catch (err) {
      console.error('Error searching products:', err);
      setError('Failed to search products. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
  };

  const handleAddToPantry = async () => {
    if (!selectedProduct) return;

    const pantryItem: PantryItem = {
      id: crypto.randomUUID(),
      name: selectedProduct.product_name,
      amount,
      unit,
      category,
      expiryDate: expiryDate || undefined,
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString(),
      productCode: selectedProduct.code,
      productName: selectedProduct.product_name,
      brands: selectedProduct.brands,
    };

    // Check if there's already a mapping for this product
    const existingMapping = await ProductIngredientMappingService.getMapping(selectedProduct.code);

    if (existingMapping) {
      // Product already has a mapping, add directly to pantry
      onAddProduct(pantryItem);
      handleClose();
    } else {
      // No mapping exists, show ingredient association modal
      setPendingPantryItem(pantryItem);
      setShowIngredientModal(true);
    }
  };

  const handleIngredientAssociation = async (association: IngredientAssociation | null) => {
    if (!pendingPantryItem) return;

    try {
      // Create mapping if association was provided
      if (association && selectedProduct) {
        await ProductIngredientMappingService.createMapping({
          product_code: selectedProduct.code,
          ingredient_id: association.ingredient_id,
        });
      }

      // Add item to pantry regardless of whether association was made
      onAddProduct(pendingPantryItem);
      handleClose();
    } catch (error) {
      console.error('Failed to create ingredient mapping:', error);
      // Still add to pantry even if mapping failed
      onAddProduct(pendingPantryItem);
      handleClose();
    }
  };

  const handleBarcodeScanned = async (code: string) => {
    setSearchQuery(code);
    setShowBarcodeScanner(false);
    
    // Perform search with the scanned code
    await performSearch(code);
    
    // Check if any products were found
    const result = await invoke<ProductSearchResult>('db_search_products', {
      query: code.trim(),
      limit: 10,
    });
    
    const filteredProducts = result.products.filter(product =>
      product.product_name &&
      product.product_name.trim() !== ''
    );
    
    if (filteredProducts.length === 1) {
      // Exactly one result found, auto-select it
      setSelectedProduct(filteredProducts[0]);
    } else if (filteredProducts.length === 0) {
      // No products found, check if the code looks like a UPC code
      const isUpcCode = /^\d{8,14}$/.test(code.trim());
      if (isUpcCode) {
        // Show create product dialog for UPC codes
        setScannedUpcCode(code.trim());
        setShowCreateProductDialog(true);
      }
    }
    // If multiple results found, let user choose from the list
  };

  const handleCreateProduct = async (productData: CreateProductData) => {
    try {
      // Create the product in the database
      await invoke('db_create_product', {
        product: {
          code: productData.code,
          url: '', // Empty URL for manually created products
          product_name: productData.product_name,
          brands: productData.brand,
        }
      });

      // Create a Product object for the newly created product
      const newProduct: Product = {
        code: productData.code,
        url: '',
        product_name: productData.product_name,
        brands: productData.brand,
      };

      // Auto-select the newly created product
      setSelectedProduct(newProduct);
      setShowCreateProductDialog(false);
      setScannedUpcCode('');

      // Set default category from the created product
      setCategory(productData.category);

      // Set expiration date if provided
      if (productData.expiration_date) {
        setExpiryDate(productData.expiration_date);
      }
    } catch (error) {
      console.error('Failed to create product:', error);
      setError('Failed to create product. Please try again.');
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setSearchResults([]);
    setSelectedProduct(null);
    setAmount(1);
    setUnit('piece(s)');
    setCategory('Other');
    setExpiryDate('');
    setError(null);
    setShowIngredientModal(false);
    setPendingPantryItem(null);
    setShowBarcodeScanner(false);
    setShowCreateProductDialog(false);
    setScannedUpcCode('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth data-testid="productSearchModal-dialog-main">
      <DialogTitle>Add Product to Pantry</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          {/* Search Field */}
          <TextField
            autoFocus
            label="Search by UPC code, product name, or brand"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            fullWidth
            margin="normal"
            placeholder="e.g., 123456789012, Coca Cola, Heinz"
            data-testid="product-search-input"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowBarcodeScanner(true)}
                    edge="end"
                    aria-label="scan barcode"
                    data-testid="barcode-scanner-button"
                  >
                    <QrCodeScannerIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          {/* Loading Indicator */}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }} data-testid="productSearchModal-loading-search">
              <CircularProgress size={24} />
            </Box>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ my: 2 }} data-testid="productSearchModal-alert-error">
              {error}
            </Alert>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && !selectedProduct && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Search Results ({searchResults.length})
              </Typography>
              <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                {searchResults.map((product) => (
                  <ListItem key={product.code} disablePadding>
                    <ListItemButton
                      onClick={() => handleProductSelect(product)}
                      data-testid={`product-result-${product.code}`}
                    >
                      <ListItemText
                        primary={product.product_name}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Brand: {product.brands}
                            </Typography>
                            <Chip
                              label={`UPC: ${product.code}`}
                              size="small"
                              variant="outlined"
                              sx={{ mt: 0.5 }}
                            />
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Selected Product Details */}
          {selectedProduct && (
            <Box sx={{ mt: 2 }} data-testid="productSearchModal-display-selectedProduct">
              <Typography variant="h6" gutterBottom>
                Selected Product
              </Typography>
              <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold">
                  {selectedProduct.product_name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Brand: {selectedProduct.brands}
                </Typography>
                <Chip
                  label={`UPC: ${selectedProduct.code}`}
                  size="small"
                  variant="outlined"
                  sx={{ mt: 1 }}
                />
              </Box>

              {/* Pantry Item Details */}
              <Typography variant="h6" gutterBottom>
                Pantry Details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    sx={{ flex: 1 }}
                    inputProps={{ min: 0, step: 0.1 }}
                    data-testid="product-amount-input"
                  />
                  <FormControl sx={{ flex: 1 }}>
                    <InputLabel>Unit</InputLabel>
                    <Select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      label="Unit"
                      data-testid="product-unit-select"
                    >
                      {units.map((u) => (
                        <MenuItem key={u} value={u}>
                          {u}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    label="Category"
                    data-testid="product-category-select"
                  >
                    {categories.map((c) => (
                      <MenuItem key={c} value={c}>
                        {c}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Expiry Date"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  data-testid="product-expiry-input"
                />
              </Box>

              <Button
                variant="outlined"
                onClick={() => setSelectedProduct(null)}
                sx={{ mt: 2 }}
                data-testid="product-back-button"
              >
                Back to Search Results
              </Button>
            </Box>
          )}

          {/* No Results Message */}
          {searchQuery.trim() && !loading && searchResults.length === 0 && !error && (
            <Box sx={{ mt: 2, textAlign: 'center' }} data-testid="productSearchModal-text-noResults">
              <Typography variant="body1" color="text.secondary">
                No products found for "{searchQuery}". Try a different search term.
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} data-testid="product-cancel-button">
          Cancel
        </Button>
        <Button
          onClick={handleAddToPantry}
          variant="contained"
          disabled={!selectedProduct}
          data-testid="product-add-button"
        >
          Add to Pantry
        </Button>
      </DialogActions>

      {/* Ingredient Association Modal */}
      <IngredientAssociationModal
        open={showIngredientModal}
        onClose={() => setShowIngredientModal(false)}
        onAssociate={handleIngredientAssociation}
        productName={selectedProduct?.product_name || ''}
      />

      {/* Barcode Scanner Modal */}
      <BarcodeScanner
        open={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={handleBarcodeScanned}
      />

      {/* Create Product Dialog */}
      <CreateProductDialog
        open={showCreateProductDialog}
        onClose={() => {
          setShowCreateProductDialog(false);
          setScannedUpcCode('');
        }}
        onCreateProduct={handleCreateProduct}
        upcCode={scannedUpcCode}
      />
    </Dialog>
  );
};

export default ProductSearchModal;
