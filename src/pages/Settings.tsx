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
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        {/* Page Header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Settings
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your application settings and data.
          </Typography>
        </Box>

        {/* Settings Sections */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
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
