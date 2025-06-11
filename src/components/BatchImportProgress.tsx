import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
  Download as DownloadIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
} from '@mui/icons-material';
import { BatchImportProgress, BatchImportStatus } from '@app-types';

interface BatchImportProgressProps {
  progress: BatchImportProgress | null;
}

const BatchImportProgressComponent: React.FC<BatchImportProgressProps> = ({ progress }) => {
  if (!progress) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  const getStatusInfo = (status: BatchImportStatus) => {
    // Handle both enum values and string values from Rust backend
    const statusStr = typeof status === 'string' ? status.toLowerCase() : status;

    switch (statusStr) {
      case BatchImportStatus.IDLE:
      case 'idle':
        return { label: 'Idle', color: 'default' as const, icon: <ScheduleIcon /> };
      case BatchImportStatus.STARTING:
      case 'starting':
        return { label: 'Starting...', color: 'primary' as const, icon: <ScheduleIcon /> };
      case BatchImportStatus.CRAWLING_CATEGORIES:
      case 'crawlingcategories':
        return { label: 'Finding Categories', color: 'primary' as const, icon: <SearchIcon /> };
      case BatchImportStatus.EXTRACTING_RECIPES:
      case 'extractingrecipes':
        return { label: 'Extracting Recipes', color: 'primary' as const, icon: <CategoryIcon /> };
      case BatchImportStatus.FILTERING_EXISTING:
      case 'filteringexisting':
        return { label: 'Filtering Existing', color: 'primary' as const, icon: <SearchIcon /> };
      case BatchImportStatus.IMPORTING_RECIPES:
      case 'importingrecipes':
        return { label: 'Importing Recipes', color: 'primary' as const, icon: <DownloadIcon /> };
      case BatchImportStatus.COMPLETED:
      case 'completed':
        return { label: 'Completed', color: 'success' as const, icon: <CheckCircleIcon /> };
      case BatchImportStatus.CANCELLED:
      case 'cancelled':
        return { label: 'Cancelled', color: 'warning' as const, icon: <ErrorIcon /> };
      case BatchImportStatus.ERROR:
      case 'error':
        return { label: 'Error', color: 'error' as const, icon: <ErrorIcon /> };
      default:
        return { label: 'Unknown', color: 'default' as const, icon: <ScheduleIcon /> };
    }
  };

  const statusInfo = getStatusInfo(progress.status);

  const getOverallProgress = () => {
    if (progress.totalRecipes === 0) return 0;
    return (progress.processedRecipes / progress.totalRecipes) * 100;
  };

  const getCategoryProgress = () => {
    if (progress.totalCategories === 0) return 0;
    return (progress.processedCategories / progress.totalCategories) * 100;
  };

  const formatDuration = (startTime: string) => {
    try {
      const start = new Date(startTime);
      const now = new Date();

      // Check if dates are valid
      if (isNaN(start.getTime()) || isNaN(now.getTime())) {
        return 'Unknown';
      }

      const diffMs = now.getTime() - start.getTime();

      // Handle negative differences (clock skew, etc.)
      if (diffMs < 0) {
        return '0s';
      }

      const diffMinutes = Math.floor(diffMs / 60000);
      const diffSeconds = Math.floor((diffMs % 60000) / 1000);

      if (diffMinutes > 0) {
        return `${diffMinutes}m ${diffSeconds}s`;
      }
      return `${diffSeconds}s`;
    } catch {
      return 'Unknown';
    }
  };

  const formatEstimatedTime = (seconds?: number) => {
    if (seconds === undefined || seconds === null) return 'Calculating...';
    if (seconds === 0) return 'Almost done';
    if (seconds < 0) return 'Unknown';

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${remainingSeconds}s`;
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="batch-import-progress">
      {/* Status Header */}
      <Card data-testid="batch-import-status-card">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            {statusInfo.icon}
            <Typography variant="h6">
              Batch Import Status
            </Typography>
            <Chip
              label={statusInfo.label}
              color={statusInfo.color}
              variant="outlined"
              data-testid="batch-import-status-chip"
            />
          </Box>

          {progress.currentUrl && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Current: {progress.currentUrl}
            </Typography>
          )}

          {/* Overall Progress */}
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">Overall Progress</Typography>
              <Typography variant="body2">
                {progress.processedRecipes} / {progress.totalRecipes} recipes
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={getOverallProgress()}
              sx={{ height: 8, borderRadius: 4 }}
              data-testid="batch-import-overall-progress"
            />
          </Box>

          {/* Category Progress */}
          {progress.totalCategories > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2">Category Progress</Typography>
                <Typography variant="body2">
                  {progress.processedCategories} / {progress.totalCategories} categories
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={getCategoryProgress()}
                sx={{ height: 6, borderRadius: 3 }}
                color="secondary"
                data-testid="batch-import-category-progress"
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Statistics */}
      <Card data-testid="batch-import-statistics-card">
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Import Statistics
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ textAlign: 'center', minWidth: '120px' }} data-testid="batch-import-successful-count">
              <Typography variant="h4" color="success.main">
                {progress.successfulImports}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Successful
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '120px' }} data-testid="batch-import-failed-count">
              <Typography variant="h4" color="error.main">
                {progress.failedImports}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Failed
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '120px' }} data-testid="batch-import-skipped-count">
              <Typography variant="h4" color="warning.main">
                {progress.skippedRecipes}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Skipped
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'center', minWidth: '120px' }} data-testid="batch-import-elapsed-time">
              <Typography variant="h4" color="primary.main">
                {formatDuration(progress.startTime)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Elapsed
              </Typography>
            </Box>
          </Box>
          
          {/* Time Information */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Estimated time remaining: {formatEstimatedTime(progress.estimatedTimeRemaining)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Errors */}
      {progress.errors.length > 0 && (
        <Accordion data-testid="batch-import-errors-accordion">
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              <Typography>
                Errors ({progress.errors.length})
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <List dense>
              {progress.errors.slice(-10).map((error, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={error.message}
                    secondary={
                      <Box>
                        <Typography variant="caption" display="block">
                          URL: {error.url}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Type: {error.errorType} | Time: {new Date(error.timestamp).toLocaleTimeString()}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
              {progress.errors.length > 10 && (
                <ListItem>
                  <ListItemText
                    primary={
                      <Typography variant="body2" color="text.secondary">
                        ... and {progress.errors.length - 10} more errors
                      </Typography>
                    }
                  />
                </ListItem>
              )}
            </List>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Completion Message */}
      {progress.status === BatchImportStatus.COMPLETED && (
        <Alert severity="success">
          <Typography variant="body1">
            Batch import completed successfully!
          </Typography>
          <Typography variant="body2">
            Imported {progress.successfulImports} recipes with {progress.failedImports} failures and {progress.skippedRecipes} skipped.
          </Typography>
        </Alert>
      )}

      {progress.status === BatchImportStatus.CANCELLED && (
        <Alert severity="warning">
          <Typography variant="body1">
            Batch import was cancelled.
          </Typography>
          <Typography variant="body2">
            Imported {progress.successfulImports} recipes before cancellation with {progress.skippedRecipes} skipped.
          </Typography>
        </Alert>
      )}

      {progress.status === BatchImportStatus.ERROR && (
        <Alert severity="error">
          <Typography variant="body1">
            Batch import encountered an error.
          </Typography>
          <Typography variant="body2">
            Check the error details above for more information.
          </Typography>
        </Alert>
      )}
    </Box>
  );
};

export default BatchImportProgressComponent;
