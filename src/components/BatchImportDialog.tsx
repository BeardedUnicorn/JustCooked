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
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Queue as QueueIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { BatchImportRequest } from '@app-types';
import { batchImportService } from '@services/batchImport';
import { getExistingRecipeUrls } from '@services/recipeStorage';
import { useAppDispatch } from '@store';
import { addToQueue } from '@store/slices/importQueueSlice';
import { importQueueService } from '@services/importQueue';

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
  const [error, setError] = useState<string | null>(null);

  const suggestedUrls = batchImportService.getSuggestedCategoryUrls();

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setUrl('');
      setMaxRecipes('');
      setMaxDepth('');
      setIsAddingToQueue(false);
      setError(null);
    }
  }, [open]);

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

  const handleUrlSelect = (selectedUrl: string) => {
    setUrl(selectedUrl);
  };

  const handleClose = () => {
    if (!isAddingToQueue) {
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
      data-testid="batch-import-dialog"
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
                data-testid="batch-import-url-input"
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
                  data-testid="batch-import-max-recipes-input"
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
                  data-testid="batch-import-max-depth-input"
                  helperText="Limit category crawling depth"
                  sx={{ flex: 1 }}
                />
              </Box>
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

            {/* Info */}
            <Alert severity="info" icon={<InfoIcon />}>
              <Typography variant="body2">
                <strong>Queue System:</strong> This task will be added to the import queue and processed in the background.
                You can monitor progress and manage the queue using the queue status button in the top-right corner.
                Multiple tasks can be queued and will be processed sequentially.
              </Typography>
            </Alert>

            {/* Error Message */}
            {error && (
              <Alert severity="error">
                {error}
              </Alert>
            )}
          </Box>
      </DialogContent>

      <DialogActions>
        <Button
          onClick={handleClose}
          disabled={isAddingToQueue}
          data-testid="batch-import-cancel-button"
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleAddToQueue}
          disabled={!url.trim() || !isValidUrl(url) || isAddingToQueue}
          startIcon={<QueueIcon />}
          data-testid="batch-import-add-to-queue-button"
        >
          {isAddingToQueue ? 'Adding to Queue...' : 'Add to Queue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BatchImportDialog;
