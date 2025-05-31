
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import darkTheme from '@styles/theme';
import AppLayout from '@components/AppLayout';
import Home from '@pages/Home';
import Import from '@pages/Import';
import Search from '@pages/Search';
import Pantry from '@pages/Pantry';
import Ingredients from '@pages/Ingredients';
import RecipeView from '@pages/RecipeView';

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/import" element={<Import />} />
            <Route path="/search" element={<Search />} />
            <Route path="/pantry" element={<Pantry />} />
            <Route path="/ingredients" element={<Ingredients />} />
            <Route path="/recipe/:id" element={<RecipeView />} />
          </Routes>
        </AppLayout>
      </Router>
    </ThemeProvider>
  );
}

export default App;
