import React from 'react';
import {
  Box,
  Typography,
  Container,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import DatabaseManagementSection from '@components/DatabaseManagementSection';
import LoggingSection from '@components/LoggingSection';

const Settings: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 3 }}>
          <Link
            color="inherit"
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigate('/');
            }}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            <HomeIcon fontSize="small" />
            Home
          </Link>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <SettingsIcon fontSize="small" />
            Settings
          </Box>
        </Breadcrumbs>

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
