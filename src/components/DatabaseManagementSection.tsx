import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Divider,
  FormControlLabel,
  Switch,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  CloudDownload as ExportIcon,
  CloudUpload as ImportIcon,
  DeleteForever as ResetIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as DatabaseIcon,
} from '@mui/icons-material';
import { databaseManagementService } from '@services/databaseManagement';
import { DatabaseImportResult } from '@app-types';
import ConfirmationDialog from './ConfirmationDialog';

const DatabaseManagementSection: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  
  // Confirmation dialog states
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  const handleExport = async () => {
    clearMessages();
    setLoading(true);
    setOperation('export');

    try {
      await databaseManagementService.exportDatabase();
      setSuccess('Database exported successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export database');
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  const handleImportConfirm = async () => {
    setShowImportConfirm(false);
    clearMessages();
    setLoading(true);
    setOperation('import');

    try {
      const result: DatabaseImportResult = await databaseManagementService.importDatabase(replaceExisting);
      const message = databaseManagementService.formatImportResult(result);
      setSuccess(message);
      
      if (result.errors.length > 0) {
        console.warn('Import completed with errors:', result.errors);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import database');
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  const handleResetConfirm = async () => {
    setShowResetConfirm(false);
    clearMessages();
    setLoading(true);
    setOperation('reset');

    try {
      await databaseManagementService.resetDatabase();
      setSuccess('Database reset successfully! All data has been cleared.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset database');
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  const isOperationLoading = (op: string) => loading && operation === op;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <DatabaseIcon />
          <Typography variant="h6">Database Management</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Export, import, or reset your recipe database. Use these features to backup your data or migrate between devices.
        </Typography>

        {/* Status Messages */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} data-testid="dbManagement-alert-error">
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} data-testid="dbManagement-alert-success">
            {success}
          </Alert>
        )}

        {/* Export Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Export Database
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Create a backup file containing all your recipes, ingredients, collections, and other data.
          </Typography>
          <Button
            variant="contained"
            startIcon={isOperationLoading('export') ? <CircularProgress size={20} data-testid="dbManagement-loading-export" /> : <ExportIcon />}
            onClick={handleExport}
            disabled={loading}
            data-testid="dbManagement-button-export"
          >
            {isOperationLoading('export') ? 'Exporting...' : 'Export Database'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Import Section */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Import Database
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Restore data from a previously exported backup file.
          </Typography>
          
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Import Options</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Switch
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    data-testid="dbManagement-switch-replaceExisting"
                  />
                }
                label="Replace existing data"
              />
              <Typography variant="caption" display="block" color="text.secondary">
                {replaceExisting 
                  ? 'All current data will be deleted and replaced with imported data'
                  : 'Imported data will be merged with existing data'
                }
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Button
            variant="contained"
            startIcon={isOperationLoading('import') ? <CircularProgress size={20} data-testid="dbManagement-loading-import" /> : <ImportIcon />}
            onClick={() => setShowImportConfirm(true)}
            disabled={loading}
            data-testid="dbManagement-button-import"
          >
            {isOperationLoading('import') ? 'Importing...' : 'Import Database'}
          </Button>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Reset Section */}
        <Box>
          <Typography variant="subtitle1" gutterBottom color="error">
            Reset Database
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Permanently delete all data from the database. This action cannot be undone.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            startIcon={isOperationLoading('reset') ? <CircularProgress size={20} data-testid="dbManagement-loading-reset" /> : <ResetIcon />}
            onClick={() => setShowResetConfirm(true)}
            disabled={loading}
            data-testid="dbManagement-button-reset"
          >
            {isOperationLoading('reset') ? 'Resetting...' : 'Reset Database'}
          </Button>
        </Box>

        {/* Import Confirmation Dialog */}
        <ConfirmationDialog
          open={showImportConfirm}
          onClose={() => setShowImportConfirm(false)}
          onConfirm={handleImportConfirm}
          title="Import Database"
          message={
            replaceExisting
              ? 'This will delete all existing data and replace it with the imported data. This action cannot be undone. Are you sure you want to continue?'
              : 'This will merge the imported data with your existing data. Duplicate items may be created. Are you sure you want to continue?'
          }
          confirmText="Import"
          severity={replaceExisting ? 'error' : 'warning'}
          confirmColor={replaceExisting ? 'error' : 'primary'}
          testId="database-import-confirm-dialog"
        />

        {/* Reset Confirmation Dialog */}
        <ConfirmationDialog
          open={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          onConfirm={handleResetConfirm}
          title="Reset Database"
          message="This will permanently delete ALL your recipes, ingredients, collections, and other data. This action cannot be undone. Are you absolutely sure you want to continue?"
          confirmText="Reset Database"
          severity="error"
          confirmColor="error"
          testId="database-reset-confirm-dialog"
        />
      </CardContent>
    </Card>
  );
};

export default DatabaseManagementSection;
