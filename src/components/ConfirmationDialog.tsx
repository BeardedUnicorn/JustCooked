import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
} from '@mui/icons-material';

export interface ConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: 'warning' | 'error' | 'info' | 'success';
  confirmColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
  loading?: boolean;
  disabled?: boolean;
  testId?: string;
}

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  severity = 'warning',
  confirmColor = 'primary',
  loading = false,
  disabled = false,
  testId = 'confirmation-dialog',
}) => {
  const getIcon = () => {
    switch (severity) {
      case 'error':
        return <ErrorIcon />;
      case 'warning':
        return <WarningIcon />;
      case 'info':
        return <InfoIcon />;
      case 'success':
        return <SuccessIcon />;
      default:
        return <WarningIcon />;
    }
  };

  const handleConfirm = () => {
    if (!loading && !disabled) {
      onConfirm();
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      data-testid={testId}
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <DialogTitle id="confirmation-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getIcon()}
          {title}
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity={severity} sx={{ mb: 2 }}>
          <Typography 
            id="confirmation-dialog-description"
            variant="body1"
            component="div"
          >
            {message}
          </Typography>
        </Alert>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={handleClose}
          disabled={loading}
          data-testid={`${testId}-cancel-button`}
        >
          {cancelText}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          disabled={loading || disabled}
          data-testid={`${testId}-confirm-button`}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmationDialog;
