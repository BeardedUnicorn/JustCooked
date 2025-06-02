import { createTheme } from '@mui/material/styles';

// Extend the theme interface to include custom properties
declare module '@mui/material/styles' {
  interface Theme {
    navigation: {
      drawerWidth: number;
      transitions: {
        drawerOpen: string;
        drawerClose: string;
      };
    };
  }
  interface ThemeOptions {
    navigation?: {
      drawerWidth?: number;
      transitions?: {
        drawerOpen?: string;
        drawerClose?: string;
      };
    };
  }
}

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#5D9CEC',
      light: '#8BB5F0',
      dark: '#4A7BC8',
    },
    secondary: {
      main: '#AC92EC',
      light: '#C4A8F0',
      dark: '#8A6BC8',
    },
    success: {
      main: '#4CAF50',
      light: '#81C784',
      dark: '#388E3C',
    },
    warning: {
      main: '#FF9800',
      light: '#FFB74D',
      dark: '#F57C00',
    },
    error: {
      main: '#F44336',
      light: '#EF5350',
      dark: '#D32F2F',
    },
    info: {
      main: '#2196F3',
      light: '#64B5F6',
      dark: '#1976D2',
    },
    background: {
      default: '#141A22',
      paper: '#1C2331',
    },
    text: {
      primary: '#FFFFFF', // Improved contrast
      secondary: '#B0B0B0', // Better contrast than #A0A0A0
    },
    action: {
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(93, 156, 236, 0.12)',
      disabled: 'rgba(255, 255, 255, 0.26)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
      focus: 'rgba(93, 156, 236, 0.12)',
    },
    divider: 'rgba(255, 255, 255, 0.12)',
  },
  // Custom navigation properties
  navigation: {
    drawerWidth: 240,
    transitions: {
      drawerOpen: 'margin 195ms cubic-bezier(0.0, 0, 0.2, 1) 0ms',
      drawerClose: 'margin 225ms cubic-bezier(0.4, 0, 0.6, 1) 0ms',
    },
  },
  typography: {
    fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
    h1: {
      fontWeight: 600,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 500,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          padding: theme.spacing(1, 2),
          minHeight: theme.spacing(5.5), // Better touch target
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: theme.spacing(0.25),
          },
        }),
      },
    },
    MuiCard: {
      styleOverrides: {
        root: () => ({
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
          },
        }),
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          minWidth: theme.spacing(5.5),
          minHeight: theme.spacing(5.5),
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: theme.spacing(0.25),
          },
        }),
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiInputBase-root': {
            minHeight: theme.spacing(5.5),
          },
        }),
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderTop: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: ({ theme }) => ({
          minWidth: theme.spacing(8),
          '&.Mui-selected': {
            color: theme.palette.primary.main,
          },
        }),
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: theme.spacing(-0.25),
            borderRadius: theme.shape.borderRadius,
          },
          // Ensure proper text color for button ListItems
          '&.MuiListItem-button': {
            color: theme.palette.text.primary,
            '&:hover': {
              color: theme.palette.text.primary,
            },
            '&.Mui-selected': {
              color: theme.palette.primary.main,
              '& .MuiListItemIcon-root': {
                color: theme.palette.primary.main,
              },
              '& .MuiListItemText-primary': {
                color: theme.palette.primary.main,
              },
            },
          },
        }),
      },
    },
    MuiListItemText: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiListItemText-primary': {
            color: theme.palette.text.primary,
          },
          '& .MuiListItemText-secondary': {
            color: theme.palette.text.secondary,
          },
        }),
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: ({ theme }) => ({
          color: theme.palette.text.primary,
          minWidth: theme.spacing(5),
        }),
      },
    },
    MuiLink: {
      styleOverrides: {
        root: ({ theme }) => ({
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: theme.spacing(0.25),
            borderRadius: theme.spacing(0.5),
          },
        }),
      },
    },
  },
});

export default darkTheme;
