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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Queue as QueueIcon,
  Info as InfoIcon,
  PlaylistAdd as PlaylistAddIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { BatchImportRequest, ReImportRequest } from '@app-types';
import { batchImportService } from '@services/batchImport';
import { reImportService } from '@services/reImportService';
import { importQueueService } from '@services/importQueue';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import { useAppDispatch } from '@store';
import { addToQueue, addMultipleToQueue } from '@store/slices/importQueueSlice';

interface BatchImportDialogProps {
  open: boolean;
  onClose: () => void;
  onTaskAdded?: (taskId: string) => void;
}

const BatchImportDialog: React.FC<BatchImportDialogProps> = ({
  open,
  onClose,
  onTaskAdded,
}) => {
  const dispatch = useAppDispatch();
  const [url, setUrl] = useState('');
  const [maxRecipes, setMaxRecipes] = useState<number | ''>('');
  const [maxDepth, setMaxDepth] = useState<number | ''>('');
  const [isAddingToQueue, setIsAddingToQueue] = useState(false);
  const [isLoadingPopularCategories, setIsLoadingPopularCategories] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ processed: number; total: number; currentUrl?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reImportableCount, setReImportableCount] = useState<number>(0);
  const [isLoadingReImportCount, setIsLoadingReImportCount] = useState(false);

  const suggestedUrls = batchImportService.getSuggestedCategoryUrls();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setUrl('');
      setMaxRecipes('');
      setMaxDepth('');
      setIsAddingToQueue(false);
      setIsLoadingPopularCategories(false);
      setLoadingProgress(null);
      setError(null);
      setSuccessMessage(null);
      setReImportableCount(0);
      setIsLoadingReImportCount(false);
    }
  }, [open]);

  // Load re-importable recipes count when dialog opens
  useEffect(() => {
    if (open) {
      loadReImportableCount();
    }
  }, [open]);

  const loadReImportableCount = async () => {
    setIsLoadingReImportCount(true);
    try {
      const count = await reImportService.getReImportableRecipesCount();
      setReImportableCount(count);
    } catch (err) {
      console.error('Failed to load re-importable recipes count:', err);
      setReImportableCount(0);
    } finally {
      setIsLoadingReImportCount(false);
    }
  };

  const handleAddToQueue = async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a valid URL');
      return;
    }

    setError(null);
    setIsAddingToQueue(true);

    try {
      // Get existing recipe URLs for deduplication
      const existingUrls = await getExistingRecipeUrls();

      // Create the batch import request
      const request: BatchImportRequest = {
        startUrl: trimmedUrl,
        maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
        maxDepth: maxDepth ? Number(maxDepth) : undefined,
        existingUrls,
      };

      // Generate description for the task
      const description = importQueueService.getTaskDescription(request);

      // Add to queue using Redux
      const result = await dispatch(addToQueue({ description, request })).unwrap();

      // Notify parent component
      if (onTaskAdded) {
        onTaskAdded(result);
      }

      // Close dialog immediately on success
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task to queue');
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleReImportExisting = async () => {
    if (reImportableCount === 0) {
      setError('No recipes with source URLs found for re-import');
      return;
    }

    setError(null);
    setIsAddingToQueue(true);

    try {
      // Create the re-import request
      const request: ReImportRequest = {
        maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
        // No specific recipe IDs - re-import all existing recipes
      };

      // Generate description for the task
      const description = reImportService.getTaskDescription(request);

      // Add to queue
      const taskId = await reImportService.addToQueue(description, request);

      // Notify parent component
      if (onTaskAdded) {
        onTaskAdded(taskId);
      }

      // Close dialog immediately on success
      onClose();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add re-import task to queue');
    } finally {
      setIsAddingToQueue(false);
    }
  };

  const handleUrlSelect = (selectedUrl: string) => {
    setUrl(selectedUrl);
  };

  const handleLoadPopularCategories = async () => {
    setError(null);
    setSuccessMessage(null);
    setIsLoadingPopularCategories(true);
    setLoadingProgress({ processed: 0, total: 0 });

    try {
      const popularUrls = batchImportService.getPopularCategoryUrls();

      const options = {
        maxRecipes: maxRecipes ? Number(maxRecipes) : undefined,
        maxDepth: maxDepth ? Number(maxDepth) : undefined,
      };

      // Set up progress tracking
      const onProgress = (progress: { processed: number; total: number; currentUrl?: string }) => {
        setLoadingProgress(progress);
      };

      const result = await dispatch(addMultipleToQueue({
        urls: popularUrls,
        options,
        onProgress
      })).unwrap();

      // Show success message
      const successMsg = `Successfully added ${result.totalAdded} popular categories to the queue!`;
      if (result.errors.length > 0) {
        setSuccessMessage(`${successMsg} (${result.errors.length} failed)`);
      } else {
        setSuccessMessage(successMsg);
      }

      // Notify parent component about the tasks added
      if (onTaskAdded) {
        result.taskIds.forEach(taskId => onTaskAdded(taskId));
      }

      // Close dialog after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add popular categories to queue');
    } finally {
      setIsLoadingPopularCategories(false);
      setLoadingProgress(null);
    }
  };

  const handleClose = () => {
    if (!isAddingToQueue && !isLoadingPopularCategories) {
      onClose();
    }
  };

  const isValidUrl = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.hostname.includes('allrecipes.com') && urlObj.pathname.includes('/recipes/');
    } catch {
      return false;
    }
  };



  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      data-testid="batchImportDialog-dialog-main"
      PaperProps={{
        sx: { minHeight: '500px' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QueueIcon />
          Add Batch Import to Queue
        </Box>
      </DialogTitle>

      <DialogContent>
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
                data-testid="batchImportDialog-input-url"
                helperText={
                  url.length > 0 && !isValidUrl(url)
                    ? 'Please enter a valid AllRecipes category URL'
                    : 'Enter the URL of an AllRecipes category page to import all recipes from that category and its subcategories'
                }
              />
            </Box>

            {/* Import Options */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Import Options (Optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                  label="Max Recipes"
                  type="number"
                  value={maxRecipes}
                  onChange={(e) => setMaxRecipes(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="No limit"
                  inputProps={{ min: 1, max: 10000 }}
                  data-testid="batchImportDialog-input-maxRecipes"
                  helperText="Limit the number of recipes to import"
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Max Depth"
                  type="number"
                  value={maxDepth}
                  onChange={(e) => setMaxDepth(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="No limit"
                  inputProps={{ min: 1, max: 10 }}
                  data-testid="batchImportDialog-input-maxDepth"
                  helperText="Limit category crawling depth"
                  sx={{ flex: 1 }}
                />
              </Box>
            </Box>

            {/* Re-import Existing Recipes */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Re-import Existing Recipes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Re-import all existing recipes that have source URLs to fix ingredient parsing issues with the latest parsing logic.
                {isLoadingReImportCount ? ' Loading count...' : ` Found ${reImportableCount} recipes available for re-import.`}
              </Typography>

              <Button
                variant="outlined"
                onClick={handleReImportExisting}
                disabled={reImportableCount === 0 || isAddingToQueue || isLoadingPopularCategories || isLoadingReImportCount}
                startIcon={<RefreshIcon />}
                data-testid="batchImportDialog-button-reimportExisting"
                sx={{ mb: 2 }}
              >
                {isAddingToQueue ? 'Adding Re-import to Queue...' : `Re-import ${reImportableCount} Existing Recipes`}
              </Button>
            </Box>

            {/* Quick Start - Popular Categories */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Quick Start
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Load popular AllRecipes categories to get started quickly. This will add all categories to the import queue using your current settings.
              </Typography>

              {/* Progress Display */}
              {isLoadingPopularCategories && loadingProgress && (
                <Box sx={{ mb: 2 }} data-testid="batchImportDialog-progress-popular">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Adding categories to queue...
                    </Typography>
                    <Chip
                      label={`${loadingProgress.processed}/${loadingProgress.total}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={loadingProgress.total > 0 ? (loadingProgress.processed / loadingProgress.total) * 100 : 0}
                    sx={{ mb: 1 }}
                  />
                  {loadingProgress.currentUrl && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Processing: {new URL(loadingProgress.currentUrl).pathname.split('/').pop() || 'category'}
                    </Typography>
                  )}
                </Box>
              )}

              <Button
                variant="outlined"
                onClick={handleLoadPopularCategories}
                disabled={isLoadingPopularCategories || isAddingToQueue}
                startIcon={<PlaylistAddIcon />}
                data-testid="batchImportDialog-button-loadPopular"
                sx={{ mb: 1 }}
              >
                {isLoadingPopularCategories ? 'Adding Popular Categories...' : 'Load Popular Categories'}
              </Button>
            </Box>

            {/* Suggested URLs */}
            <Accordion data-testid="batchImportDialog-accordion-suggested">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">Suggested Categories</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {suggestedUrls.map((suggestion, index) => (
                    <React.Fragment key={suggestion.url}>
                      <ListItem disablePadding data-testid={`batchImportDialog-listItem-suggested-${index}`}>
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

            {/* Info */}
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>Queue System:</strong> This task will be added to the import queue and processed in the background.
                You can monitor progress and manage the queue using the queue status button in the top-right corner.
                Multiple tasks can be queued and will be processed sequentially.
              </Typography>
            </Alert>

            {/* Success Message */}
            {successMessage && (
              <Alert severity="success" data-testid="batchImportDialog-alert-success">
                {successMessage}
              </Alert>
            )}

            {/* Error Message */}
            {error && (
              <Alert severity="error" data-testid="batchImportDialog-alert-error">
                {error}
              </Alert>
            )}
          </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={isAddingToQueue || isLoadingPopularCategories}
          data-testid="batchImportDialog-button-cancel"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAddToQueue}
          disabled={!url.trim() || !isValidUrl(url) || isAddingToQueue || isLoadingPopularCategories}
          startIcon={<QueueIcon />}
          data-testid="batchImportDialog-button-addToQueue"
        >
          {isAddingToQueue ? 'Adding to Queue...' : 'Add to Queue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchImportDialog;
