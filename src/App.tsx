
import { Button, Box, Typography } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route, Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { store } from '@store';
import darkTheme from '@styles/theme';
import AppLayout from '@components/AppLayout';
import Dashboard from '@pages/Dashboard';
import Cookbook from '@pages/Cookbook';
import Planner from '@pages/Planner';
import PantryHub from '@pages/PantryHub';
import RecipeView from '@pages/RecipeView';
import CookingMode from '@pages/CookingMode';
import Settings from '@pages/Settings';
import { migrateJsonRecipes } from '@services/recipeStorage';

function LegacyMealPlanRedirect() {
  const { id } = useParams<{ id: string }>();
  const searchParams = new URLSearchParams({ tab: 'meal-plans' });

  if (id) {
    searchParams.set('mealPlanId', id);
  }

  return <Navigate replace to={`/planner?${searchParams.toString()}`} />;
}

function LegacyShoppingListRedirect() {
  const { id } = useParams<{ id: string }>();
  const searchParams = new URLSearchParams({ tab: 'shopping-lists' });

  if (id) {
    searchParams.set('shoppingListId', id);
  }

  return <Navigate replace to={`/planner?${searchParams.toString()}`} />;
}

function NotFoundPage() {
  return (
    <Box sx={{ py: 8, textAlign: 'center', maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Page not found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        The page you requested does not exist. Use one of the main areas below to continue.
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Button component={RouterLink} to="/" variant="contained">
          Dashboard
        </Button>
        <Button component={RouterLink} to="/cookbook" variant="outlined">
          Cookbook
        </Button>
      </Box>
    </Box>
  );
}

function App() {
  // Run migration on app startup
  useEffect(() => {
    const runMigration = async () => {
      try {
        const migratedCount = await migrateJsonRecipes();
        if (migratedCount > 0) {
          console.log(`Successfully migrated ${migratedCount} recipes from JSON to database`);
        }
      } catch (error) {
        console.error('Failed to run recipe migration:', error);
      }
    };

    runMigration();
  }, []);
  return (
    <Provider store={store}>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Router>
          <Routes>
            {/* Cooking mode route without AppLayout for fullscreen experience */}
            <Route path="/recipe/:id/cook" element={<CookingMode />} />
            <Route path="/search" element={<Navigate replace to="/cookbook" />} />
            <Route path="/meal-plans" element={<Navigate replace to="/planner" />} />
            <Route path="/meal-plans/:id" element={<LegacyMealPlanRedirect />} />
            <Route path="/shopping-lists/:id" element={<LegacyShoppingListRedirect />} />

            {/* All other routes with AppLayout */}
            <Route path="/*" element={
              <AppLayout>
                <Routes>
                  {/* Hub Routes */}
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/cookbook" element={<Cookbook />} />
                  <Route path="/planner" element={<Planner />} />
                  <Route path="/pantry" element={<PantryHub />} />
                  <Route path="/settings" element={<Settings />} />

                  {/* Individual Item Routes */}
                  <Route path="/recipe/:id" element={<RecipeView />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </AppLayout>
            } />
          </Routes>
        </Router>
      </ThemeProvider>
    </Provider>
  );
}

export default App;
