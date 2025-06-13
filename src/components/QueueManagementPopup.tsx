import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  LinearProgress,
  Chip,
  Alert,
  Paper,
} from '@mui/material';
import {
  Close as CloseIcon,
  Cancel as CancelIcon,
  PlayArrow as RunningIcon,
  Schedule as PendingIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
  Queue as QueueIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store';
import {
  selectImportQueue,
  selectCurrentTask,
  selectPendingTasks,
  selectCompletedTasks,
  selectQueueSummary,
  removeFromQueue,
} from '@store/slices/importQueueSlice';
import { ImportQueueTask, ImportQueueTaskStatus } from '@app-types';
import { importQueueService } from '@services/importQueue';

interface QueueManagementPopupProps {
  open: boolean;
  onClose: () => void;
}

const QueueManagementPopup: React.FC<QueueManagementPopupProps> = ({ open, onClose }) => {
  const dispatch = useAppDispatch();
  const queueState = useAppSelector(selectImportQueue);
  const currentTask = useAppSelector(selectCurrentTask);
  const pendingTasks = useAppSelector(selectPendingTasks);
  const completedTasks = useAppSelector(selectCompletedTasks);
  const queueSummary = useAppSelector(selectQueueSummary);

  const handleRemoveTask = async (taskId: string) => {
    try {
      await dispatch(removeFromQueue(taskId)).unwrap();
    } catch (error) {
      console.error('Failed to remove task:', error);
    }
  };

  const getTaskIcon = (status: ImportQueueTaskStatus) => {
    switch (status) {
      case ImportQueueTaskStatus.PENDING:
        return <PendingIcon color="action" />;
      case ImportQueueTaskStatus.RUNNING:
        return <RunningIcon color="primary" />;
      case ImportQueueTaskStatus.COMPLETED:
        return <CompletedIcon color="success" />;
      case ImportQueueTaskStatus.FAILED:
        return <ErrorIcon color="error" />;
      case ImportQueueTaskStatus.CANCELLED:
        return <CancelIcon color="action" />;
      default:
        return <QueueIcon />;
    }
  };

  const getStatusChip = (task: ImportQueueTask) => {
    const statusText = importQueueService.getStatusDisplayText(task);
    let color: 'default' | 'primary' | 'success' | 'error' | 'warning' = 'default';

    switch (task.status) {
      case ImportQueueTaskStatus.PENDING:
        color = 'default';
        break;
      case ImportQueueTaskStatus.RUNNING:
        color = 'primary';
        break;
      case ImportQueueTaskStatus.COMPLETED:
        color = 'success';
        break;
      case ImportQueueTaskStatus.FAILED:
        color = 'error';
        break;
      case ImportQueueTaskStatus.CANCELLED:
        color = 'warning';
        break;
    }

    return (
      <Chip
        label={statusText}
        color={color}
        size="small"
        variant="outlined"
        data-testid={`task-status-chip-${task.id}`}
      />
    );
  };

  const renderProgressBars = (task: ImportQueueTask) => {
    if (task.status !== ImportQueueTaskStatus.RUNNING) {
      return null;
    }

    const categoryProgress = importQueueService.getCategoryProgress(task);
    const recipeProgress = importQueueService.getRecipeProgress(task);
    const currentPhase = importQueueService.getCurrentPhaseDescription(task);

    // Always show progress bars for running tasks - simplified conditions
    const showCategoryProgress = task.progress && (
      categoryProgress.isActive ||
      task.progress.status === 'starting' ||
      task.progress.status === 'crawlingCategories' ||
      task.progress.status === 'extractingRecipes' ||
      task.progress.status === 'filteringExisting' ||
      categoryProgress.total > 0
    );

    const showRecipeProgress = task.progress && (
      recipeProgress.isActive ||
      task.progress.status === 'importingRecipes' ||
      recipeProgress.total > 0
    );

    // If no specific progress bars are shown, show a general progress indicator
    const showGeneralProgress = task.status === ImportQueueTaskStatus.RUNNING &&
      !showCategoryProgress && !showRecipeProgress;

    return (
      <Box sx={{ width: '100%', mt: 1 }}>
        {/* Current Phase Description */}
        {currentPhase && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {currentPhase}
          </Typography>
        )}

        {/* Category Scraping Progress */}
        {showCategoryProgress && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {task.progress?.status === 'starting' ? 'Initializing...' :
                 task.progress?.status === 'filteringExisting' ? 'Filtering existing recipes...' :
                 'Scraping categories'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {categoryProgress.current}/{categoryProgress.total || '?'}
              </Typography>
            </Box>
            <LinearProgress
              variant={categoryProgress.total > 0 ? "determinate" : "indeterminate"}
              value={categoryProgress.total > 0 ? categoryProgress.percentage : undefined}
              color={categoryProgress.isActive || task.progress?.status === 'starting' || task.progress?.status === 'filteringExisting' ? 'primary' : 'inherit'}
              data-testid={`category-progress-bar-${task.id}`}
              sx={{
                height: 6,
                borderRadius: 3,
                opacity: categoryProgress.isActive || task.progress?.status === 'starting' || task.progress?.status === 'filteringExisting' ? 1 : 0.6
              }}
            />
          </Box>
        )}

        {/* Recipe Import Progress */}
        {showRecipeProgress && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Importing recipes
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {recipeProgress.current}/{recipeProgress.total || '?'}
              </Typography>
            </Box>
            <LinearProgress
              variant={recipeProgress.total > 0 ? "determinate" : "indeterminate"}
              value={recipeProgress.total > 0 ? recipeProgress.percentage : undefined}
              color={recipeProgress.isActive ? 'primary' : 'inherit'}
              data-testid={`recipe-progress-bar-${task.id}`}
              sx={{
                height: 6,
                borderRadius: 3,
                opacity: recipeProgress.isActive ? 1 : 0.6
              }}
            />
          </Box>
        )}

        {/* General Progress Indicator - shown when no specific progress is available */}
        {showGeneralProgress && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Processing...
              </Typography>
              <Typography variant="caption" color="text.secondary">
                In progress
              </Typography>
            </Box>
            <LinearProgress
              variant="indeterminate"
              color="primary"
              data-testid={`general-progress-bar-${task.id}`}
              sx={{
                height: 6,
                borderRadius: 3,
              }}
            />
          </Box>
        )}

        {/* Overall Progress Summary */}
        {task.progress && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Overall: {importQueueService.getProgressPercentage(task)}% complete
          </Typography>
        )}
      </Box>
    );
  };

  const renderTaskItem = (task: ImportQueueTask, isCurrentTask: boolean = false) => {
    const estimatedTime = importQueueService.getEstimatedTimeRemaining(task);
    const canRemove = importQueueService.canRemoveTask(task);

    return (
      <ListItem
        key={task.id}
        data-testid={`queue-task-item-${task.id}`}
        sx={{
          border: isCurrentTask ? '2px solid' : '1px solid',
          borderColor: isCurrentTask ? 'primary.main' : 'divider',
          borderRadius: 1,
          mb: 1,
          backgroundColor: isCurrentTask ? 'action.selected' : 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          {getTaskIcon(task.status)}
        </Box>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" component="span">
                {task.description}
              </Typography>
              {isCurrentTask && (
                <Chip
                  label="Current"
                  color="primary"
                  size="small"
                  data-testid={`current-task-indicator-${task.id}`}
                />
              )}
            </Box>
          }
          secondary={
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                {getStatusChip(task)}
                {estimatedTime && (
                  <Typography variant="caption" color="text.secondary">
                    {estimatedTime} remaining
                  </Typography>
                )}
              </Box>
              {renderProgressBars(task)}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Added: {new Date(task.addedAt).toLocaleString()}
              </Typography>
            </Box>
          }
        />
        <ListItemSecondaryAction>
          {canRemove && (
            <IconButton
              edge="end"
              onClick={() => handleRemoveTask(task.id)}
              color="error"
              size="small"
              data-testid={`remove-task-button-${task.id}`}
            >
              <CancelIcon />
            </IconButton>
          )}
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      data-testid="queue-management-popup"
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">Import Queue Management</Typography>
          <IconButton onClick={onClose} size="small" data-testid="queue-popup-close-button">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {queueState.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {queueState.error}
          </Alert>
        )}

        {/* Queue Summary */}
        <Paper sx={{ p: 2, mb: 3 }} data-testid="queue-summary">
          <Typography variant="h6" gutterBottom>
            Queue Summary
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Chip
              label={`${queueSummary.pending} Pending`}
              color={queueSummary.pending > 0 ? 'default' : 'default'}
              variant="outlined"
            />
            <Chip
              label={`${queueState.isProcessing ? 1 : 0} Running`}
              color={queueState.isProcessing ? 'primary' : 'default'}
              variant="outlined"
            />
            <Chip
              label={`${queueSummary.completed} Completed`}
              color={queueSummary.completed > 0 ? 'success' : 'default'}
              variant="outlined"
            />
            <Chip
              label={`${queueSummary.failed} Failed`}
              color={queueSummary.failed > 0 ? 'error' : 'default'}
              variant="outlined"
            />
          </Box>
        </Paper>

        {queueSummary.totalTasks === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }} data-testid="empty-queue-message">
            <QueueIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No import tasks in queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Add batch import tasks to see them here
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Current/Running Task */}
            {currentTask && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom data-testid="current-task-section">
                  Current Task
                </Typography>
                <List sx={{ p: 0 }}>
                  {renderTaskItem(currentTask, true)}
                </List>
              </Box>
            )}

            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom data-testid="pending-tasks-section">
                  Pending Tasks ({pendingTasks.length})
                </Typography>
                <List sx={{ p: 0 }}>
                  {pendingTasks.map(task => renderTaskItem(task))}
                </List>
              </Box>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <Box>
                <Typography variant="h6" gutterBottom data-testid="completed-tasks-section">
                  Completed Tasks ({completedTasks.length})
                </Typography>
                <List sx={{ p: 0 }}>
                  {completedTasks.slice(0, 5).map(task => renderTaskItem(task))}
                  {completedTasks.length > 5 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1 }}>
                      ... and {completedTasks.length - 5} more completed tasks
                    </Typography>
                  )}
                </List>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} data-testid="queue-popup-close-action-button">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QueueManagementPopup;
