
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { store } from '@store';
import darkTheme from '@styles/theme';
import AppLayout from '@components/AppLayout';
import Dashboard from '@pages/Dashboard';
import Cookbook from '@pages/Cookbook';
import Planner from '@pages/Planner';
import PantryHub from '@pages/PantryHub';
import MealPlanView from '@pages/MealPlanView';
import RecipeView from '@pages/RecipeView';
import CookingMode from '@pages/CookingMode';
import Settings from '@pages/Settings';
import { migrateJsonRecipes } from '@services/recipeStorage';

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
                  <Route path="/meal-plans/:id" element={<MealPlanView />} />
                  <Route path="/recipe/:id" element={<RecipeView />} />
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
