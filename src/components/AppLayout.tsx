import React, { useState, useEffect } from 'react';
import {
  Box, Drawer, AppBar, Toolbar, Typography, List, ListItem,
  ListItemIcon, ListItemText, IconButton, BottomNavigation,
  BottomNavigationAction, useMediaQuery, useTheme, Breadcrumbs,
  Link
} from '@mui/material';
import { styled } from '@mui/system';
import { useNavigate, useLocation } from 'react-router-dom';
import darkTheme from '@styles/theme';
import HomeIcon from '@mui/icons-material/Home';

import KitchenIcon from '@mui/icons-material/Kitchen';

import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BookIcon from '@mui/icons-material/Book';
import MenuIcon from '@mui/icons-material/Menu';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import SettingsIcon from '@mui/icons-material/Settings';

import QueueStatusButton from './QueueStatusButton';
import QueueManagementPopup from './QueueManagementPopup';

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' && prop !== 'isMobile' })<{
  open?: boolean;
  isMobile?: boolean;
}>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  padding: theme.spacing(isMobile ? 2 : 3),
  paddingBottom: isMobile ? theme.spacing(10) : theme.spacing(3), // Space for bottom nav
  transition: darkTheme.navigation.transitions.drawerClose,
  marginLeft: isMobile ? 0 : `-${darkTheme.navigation.drawerWidth}px`,
  ...(open && !isMobile && {
    transition: darkTheme.navigation.transitions.drawerOpen,
    marginLeft: 0,
  }),
}));

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [open, setOpen] = useState(!isMobile);
  const [queuePopupOpen, setQueuePopupOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Use theme drawer width
  const drawerWidth = darkTheme.navigation.drawerWidth;

  const menuItems = [
    { text: 'Dashboard', icon: <HomeIcon />, path: '/', label: 'Dashboard' },
    { text: 'Cookbook', icon: <BookIcon />, path: '/cookbook', label: 'Cookbook' },
    { text: 'Planner', icon: <CalendarMonthIcon />, path: '/planner', label: 'Planner' },
    { text: 'Pantry', icon: <KitchenIcon />, path: '/pantry', label: 'Pantry' },
    { text: 'Settings', icon: <SettingsIcon />, path: '/settings', label: 'Settings' },
  ];

  // Close drawer on mobile when route changes
  useEffect(() => {
    if (isMobile) {
      setOpen(false);
    } else {
      setOpen(true);
    }
  }, [isMobile]);

  // Generate breadcrumbs
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const breadcrumbs = [{ label: 'Home', path: '/' }];

    if (pathSegments.length > 0) {
      const currentItem = menuItems.find(item => item.path === location.pathname);
      if (currentItem) {
        breadcrumbs.push({ label: currentItem.text, path: location.pathname });
      } else if (pathSegments[0] === 'recipe') {
        breadcrumbs.push({ label: 'Search Recipes', path: '/search' });
        breadcrumbs.push({ label: 'Recipe Details', path: location.pathname });
      } else if (pathSegments[0] === 'collections') {
        breadcrumbs.push({ label: 'Collections', path: '/collections' });
        if (pathSegments.length > 1) {
          breadcrumbs.push({ label: 'Collection Details', path: location.pathname });
        }
      } else if (pathSegments[0] === 'smart-cookbook') {
        breadcrumbs.push({ label: 'Smart Cookbook', path: location.pathname });
      }
    }

    return breadcrumbs.length > 1 ? breadcrumbs : [];
  };

  const breadcrumbs = generateBreadcrumbs();



  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          display: isMobile ? 'none' : 'block'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="toggle navigation drawer"
            edge="start"
            onClick={() => setOpen(!open)}
            sx={{ mr: theme.spacing(2) }}
            data-testid="navigation-drawer-toggle"
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <Typography variant="h6" noWrap component="div">
              JustCooked
            </Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <QueueStatusButton onClick={() => setQueuePopupOpen(true)} />
        </Toolbar>
      </AppBar>

      {/* Desktop Drawer */}
      {!isMobile && (
        <Drawer
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
          variant="persistent"
          anchor="left"
          open={open}
        >
          <Toolbar />
          <List>
            {menuItems.map((item) => (
              <ListItem
                key={item.text}
                component="button"
                onClick={() => navigate(item.path)}
                data-testid={`navigation-menu-${item.label.toLowerCase()}`}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: location.pathname === item.path ? 'action.selected' : 'transparent',
                  color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    color: 'text.primary',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '& .MuiListItemText-primary': {
                      color: 'primary.main',
                    },
                    '&:hover': {
                      backgroundColor: 'action.selected',
                      color: 'primary.main',
                    },
                  },
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: theme.spacing(-0.25),
                  },
                }}
                aria-label={`Navigate to ${item.text}`}
                role="menuitem"
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'text.primary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          variant="temporary"
          anchor="left"
          open={open}
          onClose={() => setOpen(false)}
          data-testid="mobile-navigation-drawer"
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={{
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
            },
          }}
        >
          <Box sx={{ p: theme.spacing(2) }}>
            <Typography variant="h6" component="div" sx={{ color: 'text.primary' }}>
              JustCooked
            </Typography>
          </Box>
          <List>
            {menuItems.map((item) => (
              <ListItem
                key={item.text}
                component="button"
                onClick={() => {
                  navigate(item.path);
                  setOpen(false);
                }}
                data-testid={`mobile-navigation-menu-${item.label.toLowerCase()}`}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: location.pathname === item.path ? 'action.selected' : 'transparent',
                  color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                    color: 'text.primary',
                  },
                  '&.Mui-selected': {
                    backgroundColor: 'action.selected',
                    color: 'primary.main',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.main',
                    },
                    '& .MuiListItemText-primary': {
                      color: 'primary.main',
                    },
                    '&:hover': {
                      backgroundColor: 'action.selected',
                      color: 'primary.main',
                    },
                  },
                  border: 'none',
                  width: '100%',
                  textAlign: 'left',
                  '&:focus-visible': {
                    outline: `2px solid ${theme.palette.primary.main}`,
                    outlineOffset: theme.spacing(-0.25),
                  },
                }}
                aria-label={`Navigate to ${item.text}`}
                role="menuitem"
              >
                <ListItemIcon sx={{ color: location.pathname === item.path ? 'primary.main' : 'text.primary' }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiListItemText-primary': {
                      color: location.pathname === item.path ? 'primary.main' : 'text.primary',
                    },
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Drawer>
      )}

      {/* Main Content */}
      <Main open={open} isMobile={isMobile} data-testid="appLayout-mainContent">
        {!isMobile && <Toolbar />}

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <Box sx={{ mb: theme.spacing(2) }} data-testid="appLayout-breadcrumbs-container">
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              aria-label="breadcrumb navigation"
            >
              {breadcrumbs.map((crumb, index) => (
                index === breadcrumbs.length - 1 ? (
                  <Typography key={crumb.path} color="text.primary">
                    {crumb.label}
                  </Typography>
                ) : (
                  <Link
                    key={crumb.path}
                    color="inherit"
                    href={crumb.path}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(crumb.path);
                    }}
                    data-testid={`appLayout-breadcrumbLink-${index}`}
                    sx={{
                      textDecoration: 'none',
                      '&:hover': { textDecoration: 'underline' },
                      '&:focus-visible': {
                        outline: `2px solid ${theme.palette.primary.main}`,
                        outlineOffset: theme.spacing(0.25),
                        borderRadius: theme.spacing(0.5),
                      },
                    }}
                  >
                    {crumb.label}
                  </Link>
                )
              ))}
            </Breadcrumbs>
          </Box>
        )}

        {children}
      </Main>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <BottomNavigation
          value={location.pathname}
          onChange={(_, newValue) => {
            navigate(newValue);
          }}
          data-testid="mobile-bottom-navigation"
          sx={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: (theme) => theme.zIndex.appBar,
          }}
          role="navigation"
          aria-label="main navigation"
        >
          {menuItems.map((item) => (
            <BottomNavigationAction
              key={item.path}
              label={item.label}
              value={item.path}
              icon={item.icon}
              aria-label={`Navigate to ${item.text}`}
              data-testid={`mobile-bottom-nav-${item.label.toLowerCase()}`}
            />
          ))}
        </BottomNavigation>
      )}

      {/* Queue Management Popup */}
      <QueueManagementPopup
        open={queuePopupOpen}
        onClose={() => setQueuePopupOpen(false)}
      />
    </Box>
  );
};

export default AppLayout;
