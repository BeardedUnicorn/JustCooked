import React, { useEffect } from 'react';
import {
  IconButton,
  Badge,
  Tooltip,
  CircularProgress,
  Box,
} from '@mui/material';
import {
  Queue as QueueIcon,
  CheckCircle as CompletedIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '@store';
import {
  selectImportQueue,
  selectQueueSummary,
  startMonitoring,
  stopMonitoring,
  getQueueStatus,
} from '@store/slices/importQueueSlice';

interface QueueStatusButtonProps {
  onClick: () => void;
}

const QueueStatusButton: React.FC<QueueStatusButtonProps> = ({ onClick }) => {
  const dispatch = useAppDispatch();
  const queueState = useAppSelector(selectImportQueue);
  const queueSummary = useAppSelector(selectQueueSummary);

  // Start monitoring when component mounts
  useEffect(() => {
    let mounted = true;

    const startMonitoringAsync = async () => {
      if (!mounted) return;

      try {
        await dispatch(getQueueStatus()).unwrap();
        if (mounted && !queueState.isMonitoring) {
          await dispatch(startMonitoring()).unwrap();
        }
      } catch (error) {
        console.error('Failed to start queue monitoring:', error);
      }
    };

    startMonitoringAsync();

    return () => {
      mounted = false;
      if (queueState.isMonitoring) {
        dispatch(stopMonitoring());
      }
    };
  }, [dispatch]); // Remove queueState.isMonitoring from deps to prevent restart loops

  // Determine the icon and color based on queue state
  const getQueueIcon = () => {
    if (queueState.isProcessing) {
      return (
        <Box sx={{ position: 'relative', display: 'inline-flex' }} data-testid="queueStatusButton-icon-status">
          <QueueIcon />
          <CircularProgress
            size={20}
            sx={{
              position: 'absolute',
              top: 2,
              left: 2,
              color: 'primary.main',
            }}
          />
        </Box>
      );
    }

    if (queueSummary.failed > 0) {
      return <ErrorIcon color="error" data-testid="queueStatusButton-icon-status" />;
    }

    if (queueSummary.completed > 0 && queueSummary.pending === 0) {
      return <CompletedIcon color="success" data-testid="queueStatusButton-icon-status" />;
    }

    return <QueueIcon data-testid="queueStatusButton-icon-status" />;
  };

  // Get tooltip text
  const getTooltipText = () => {
    if (queueState.loading) {
      return 'Loading queue status...';
    }

    if (queueState.error) {
      return `Queue error: ${queueState.error}`;
    }

    if (queueSummary.totalTasks === 0) {
      return 'Import queue is empty';
    }

    const parts = [];
    
    if (queueSummary.pending > 0) {
      parts.push(`${queueSummary.pending} pending`);
    }
    
    if (queueState.isProcessing) {
      parts.push('1 running');
    }
    
    if (queueSummary.completed > 0) {
      parts.push(`${queueSummary.completed} completed`);
    }
    
    if (queueSummary.failed > 0) {
      parts.push(`${queueSummary.failed} failed`);
    }

    return `Import Queue: ${parts.join(', ')}`;
  };

  // Calculate badge count (pending + running)
  const badgeCount = queueSummary.pending + (queueState.isProcessing ? 1 : 0);

  return (
    <Tooltip title={getTooltipText()} arrow>
      <IconButton
        color="inherit"
        onClick={onClick}
        data-testid="queue-status-button"
        sx={{
          position: 'relative',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        }}
      >
        <Badge
          badgeContent={badgeCount > 0 ? badgeCount : undefined}
          color={queueSummary.failed > 0 ? 'error' : 'primary'}
          data-testid="queue-status-badge"
        >
          {getQueueIcon()}
        </Badge>
      </IconButton>
    </Tooltip>
  );
};

export default QueueStatusButton;
