import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
} from '@mui/material';

interface CreateProductDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateProduct: (productData: CreateProductData) => void;
  upcCode: string;
}

export interface CreateProductData {
  code: string;
  brand: string;
  product_name: string;
  expiration_date?: string;
  category: string;
}

const categories = [
  'Produce', 'Dairy', 'Meat', 'Grains', 'Baking', 'Spices', 'Canned Goods', 'Frozen', 'Other'
];

const CreateProductDialog: React.FC<CreateProductDialogProps> = ({
  open,
  onClose,
  onCreateProduct,
  upcCode,
}) => {
  const [brand, setBrand] = useState('');
  const [productName, setProductName] = useState('');
  const [expirationDate, setExpirationDate] = useState('');
  const [category, setCategory] = useState('Other');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);

    // Validation
    if (!brand.trim()) {
      setError('Brand is required');
      return;
    }

    if (!productName.trim()) {
      setError('Product name is required');
      return;
    }

    const productData: CreateProductData = {
      code: upcCode,
      brand: brand.trim(),
      product_name: productName.trim(),
      expiration_date: expirationDate || undefined,
      category,
    };

    onCreateProduct(productData);
    handleClose();
  };

  const handleClose = () => {
    setBrand('');
    setProductName('');
    setExpirationDate('');
    setCategory('Other');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth data-testid="create-product-dialog">
      <DialogTitle>Create New Product</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No product found for UPC code <strong>{upcCode}</strong>. Please enter the product details to add it to the database.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} data-testid="createProductDialog-alert-error">
              {error}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="UPC Code"
              value={upcCode}
              disabled
              fullWidth
              data-testid="create-product-upc-input"
            />

            <TextField
              autoFocus
              label="Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Coca-Cola, Heinz, General Mills"
              data-testid="create-product-brand-input"
            />

            <TextField
              label="Product Name"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              fullWidth
              required
              placeholder="e.g., Classic Coke 12oz Can, Tomato Ketchup"
              data-testid="create-product-name-input"
            />

            <TextField
              label="Expiration Date"
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
              helperText="Optional: Best by or expiration date"
              data-testid="create-product-expiration-input"
            />

            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                label="Category"
                data-testid="create-product-category-select"
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} data-testid="create-product-cancel-button">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          data-testid="create-product-submit-button"
        >
          Create Product
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProductDialog;
