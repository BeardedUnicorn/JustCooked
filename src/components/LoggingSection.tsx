import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  FolderOpen as OpenFolderIcon,
  Assignment as LogIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { loggingManagementService } from '@services/loggingManagement';

const LoggingSection: React.FC = () => {
  const [logDirectoryPath, setLogDirectoryPath] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load log directory path on component mount
  useEffect(() => {
    const loadLogDirectoryPath = async () => {
      try {
        const path = await loggingManagementService.getLogDirectoryPath();
        setLogDirectoryPath(path);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load log directory path');
      } finally {
        setInitialLoading(false);
      }
    };

    loadLogDirectoryPath();
  }, []);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleOpenLogDirectory = async () => {
    clearMessages();
    setLoading(true);

    try {
      await loggingManagementService.openLogDirectory();
      setSuccess('Log directory opened successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open log directory');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(logDirectoryPath);
      setSuccess('Log directory path copied to clipboard');
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError('Failed to copy path to clipboard');
    }
  };

  if (initialLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <LogIcon />
            <Typography variant="h6">Logging</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LogIcon />
          <Typography variant="h6">Logging</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          View and manage application logs. Logs are automatically stored with daily rotation and cleanup.
        </Typography>

        {/* Status Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="logging-section-error">
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="logging-section-success">
            {success}
          </Alert>
        )}

        {/* Log Directory Path */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Log Directory
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Application logs are stored in the following directory:
          </Typography>
          <TextField
            fullWidth
            value={logDirectoryPath}
            variant="outlined"
            size="small"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copy path to clipboard">
                    <IconButton
                      onClick={handleCopyPath}
                      edge="end"
                      size="small"
                      data-testid="copy-log-path-button"
                      aria-label="Copy log directory path to clipboard"
                    >
                      <CopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiInputBase-input': {
                fontSize: '0.875rem',
                fontFamily: 'monospace',
              },
            }}
            data-testid="log-directory-path-field"
          />
        </Box>

        {/* Open Directory Button */}
        <Box>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <OpenFolderIcon />}
            onClick={handleOpenLogDirectory}
            disabled={loading || !logDirectoryPath}
            data-testid="open-log-directory-button"
            aria-label="Open log directory in file manager"
          >
            {loading ? 'Opening...' : 'Open Log Folder'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LoggingSection;
