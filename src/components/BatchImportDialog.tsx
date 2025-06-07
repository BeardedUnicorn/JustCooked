import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { BatchImportProgress, BatchImportStatus } from '@app-types';
import { batchImportService } from '@services/batchImport';
import BatchImportProgressComponent from './BatchImportProgress';

interface BatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImportComplete?: (result: { successCount: number; failureCount: number }) => void;
}

const BatchImportDialog: React.FC<BatchImportDialogProps> = ({
  open,
  onClose,
  onImportComplete,
}) => {
  const [url, setUrl] = useState('');
  const [maxRecipes, setMaxRecipes] = useState<number | ''>('');
  const [limitRecipes, setLimitRecipes] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<BatchImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const suggestedUrls = batchImportService.getSuggestedCategoryUrls();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setUrl('');
      setMaxRecipes('');
      setLimitRecipes(false);
      setIsImporting(false);
      setProgress(null);
      setError(null);
    }
  }, [open]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      batchImportService.cleanup();
    };
  }, []);

  // Poll for progress when importing
  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined;
    if (isImporting) {
      const fetchProgress = async () => {
        try {
          const newProgress = await batchImportService.getProgress();
          if (newProgress) {
            setProgress(newProgress);
            if (
              newProgress.status === BatchImportStatus.COMPLETED ||
              newProgress.status === BatchImportStatus.CANCELLED ||
              newProgress.status === BatchImportStatus.ERROR
            ) {
              setIsImporting(false);
              if (newProgress.status === BatchImportStatus.COMPLETED && onImportComplete) {
                onImportComplete({
                  successCount: newProgress.successfulImports,
                  failureCount: newProgress.failedImports,
                });
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch progress:', error);
        }
      };

      fetchProgress(); // Initial fetch

      intervalId = setInterval(fetchProgress, 2000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isImporting, onImportComplete]);

  const handleStartImport = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a valid URL');
      return;
    }

    setError(null);
    setIsImporting(true);

    try {
      const options = {
        maxRecipes: limitRecipes && maxRecipes ? Number(maxRecipes) : undefined,
      };

      await batchImportService.startBatchImport(trimmedUrl, options);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch import');
      setIsImporting(false);
    }
  };

  const handleCancelImport = async () => {
    try {
      await batchImportService.cancelBatchImport();
      setIsImporting(false);
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel import');
    }
  };

  const handleUrlSelect = (selectedUrl: string) => {
    setUrl(selectedUrl);
  };

  const handleClose = () => {
    if (isImporting) {
      handleCancelImport();
    }
    onClose();
  };

  const isValidUrl = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname.includes('allrecipes.com') && urlObj.pathname.includes('/recipes/');
    } catch {
      return false;
    }
  };

  const getEstimatedTime = () => {
    if (!limitRecipes || !maxRecipes) return null;
    return batchImportService.estimateImportTime(Number(maxRecipes));
  };

  const estimatedTime = getEstimatedTime();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DownloadIcon />
          Batch Recipe Import
        </Box>
      </DialogTitle>

      <DialogContent>
        {!isImporting ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* URL Input */}
            <Box>
              <Typography variant="h6" gutterBottom>
                AllRecipes Category URL
              </Typography>
              <TextField
                fullWidth
                label="Category URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.allrecipes.com/recipes/79/desserts"
                error={url.length > 0 && !isValidUrl(url)}
                helperText={
                  url.length > 0 && !isValidUrl(url)
                    ? 'Please enter a valid AllRecipes category URL'
                    : 'Enter the URL of an AllRecipes category page to import all recipes from that category and its subcategories'
                }
              />
            </Box>

            {/* Recipe Limit */}
            <Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={limitRecipes}
                    onChange={(e) => setLimitRecipes(e.target.checked)}
                  />
                }
                label="Limit number of recipes"
              />
              {limitRecipes && (
                <TextField
                  type="number"
                  label="Maximum recipes"
                  value={maxRecipes}
                  onChange={(e) => setMaxRecipes(e.target.value === '' ? '' : Number(e.target.value))}
                  inputProps={{ min: 1, max: 1000 }}
                  sx={{ mt: 1, width: '200px' }}
                  helperText="Recommended: 50-100 recipes for testing"
                />
              )}
              {estimatedTime && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Estimated time: {estimatedTime.minMinutes}-{estimatedTime.maxMinutes} minutes
                    <br />
                    {estimatedTime.description}
                  </Typography>
                </Alert>
              )}
            </Box>

            {/* Suggested URLs */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Suggested Categories</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {suggestedUrls.map((suggestion, index) => (
                    <React.Fragment key={suggestion.url}>
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => handleUrlSelect(suggestion.url)}>
                          <ListItemText
                            primary={suggestion.name}
                            secondary={suggestion.description}
                          />
                        </ListItemButton>
                      </ListItem>
                      {index < suggestedUrls.length - 1 && <Divider />}
                    </React.Fragment>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            {/* Warning */}
            <Alert severity="warning" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>Important:</strong> Batch importing can take a long time and will import many recipes.
                Consider starting with a smaller category or limiting the number of recipes for testing.
                The import will respect rate limits to avoid overwhelming the server.
              </Typography>
            </Alert>

            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}
          </Box>
        ) : (
          <BatchImportProgressComponent progress={progress} />
        )}
      </DialogContent>

      <DialogActions>
        {!isImporting ? (
          <>
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              variant="contained"
              onClick={handleStartImport}
              disabled={!url.trim() || !isValidUrl(url)}
              startIcon={<DownloadIcon />}
            >
              Start Import
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleCancelImport} color="error">
              Cancel Import
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default BatchImportDialog;
