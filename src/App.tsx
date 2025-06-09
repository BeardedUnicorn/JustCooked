
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { useEffect } from 'react';
import { store } from '@store';
import darkTheme from '@styles/theme';
import AppLayout from '@components/AppLayout';
import Home from '@pages/Home';
import Import from '@pages/Import';
import Search from '@pages/Search';
import SmartCookbook from '@pages/SmartCookbook';
import Collections from '@pages/Collections';
import CollectionView from '@pages/CollectionView';
import Pantry from '@pages/Pantry';
import Ingredients from '@pages/Ingredients';
import RecipeView from '@pages/RecipeView';
import CookingMode from '@pages/CookingMode';
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
                  <Route path="/" element={<Home />} />
                  <Route path="/import" element={<Import />} />
                  <Route path="/search" element={<Search />} />
                  <Route path="/smart-cookbook" element={<SmartCookbook />} />
                  <Route path="/collections" element={<Collections />} />
                  <Route path="/collections/:id" element={<CollectionView />} />
                  <Route path="/pantry" element={<Pantry />} />
                  <Route path="/ingredients" element={<Ingredients />} />
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
