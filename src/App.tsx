
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@store';
import darkTheme from '@styles/theme';
import AppLayout from '@components/AppLayout';
import Home from '@pages/Home';
import Import from '@pages/Import';
import Search from '@pages/Search';
import Collections from '@pages/Collections';
import CollectionView from '@pages/CollectionView';
import Pantry from '@pages/Pantry';
import Ingredients from '@pages/Ingredients';
import RecipeView from '@pages/RecipeView';
import CookingMode from '@pages/CookingMode';

function App() {
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
