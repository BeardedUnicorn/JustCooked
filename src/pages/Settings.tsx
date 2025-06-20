import React from 'react';
import {
  Box,
  Typography,
  Container
} from '@mui/material';
import DatabaseManagementSection from '@components/DatabaseManagementSection';
import LoggingSection from '@components/LoggingSection';

const Settings: React.FC = () => {
  return (
    <Container maxWidth="lg" data-testid="settingsPage-container-main">
      <Box sx={{ py: 3 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom data-testid="settingsPage-title-main">
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary" data-testid="settingsPage-text-description">
            Manage your application settings and data.
          </Typography>
        </Box>

        {/* Settings Sections */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }} data-testid="settingsPage-container-sections">
          {/* Database Management Section */}
          <DatabaseManagementSection />

          {/* Logging Section */}
          <LoggingSection />

          {/* Future sections can be added here */}
          {/*
          <PreferencesSection />
          <AppearanceSection />
          <NotificationSection />
          */}
        </Box>
      </Box>
    </Container>
  );
};

export default Settings;
