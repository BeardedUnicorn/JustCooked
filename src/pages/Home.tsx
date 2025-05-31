import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Grid, Button, Divider, Card, CardContent,
  CircularProgress, Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import KitchenIcon from '@mui/icons-material/Kitchen';
import { useNavigate } from 'react-router-dom';
import RecipeCard from '@components/RecipeCard';
import { Recipe } from '@app-types/recipe';
import { getAllRecipes } from '@services/recipeStorage';

interface RecipeCategory {
  name: string;
  count: number;
}

const Home: React.FC = () => {
  const [recentRecipes, setRecentRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRecipes = async () => {
    setLoading(true);
    try {
      const recipes = await getAllRecipes();
      const sorted = [...recipes].sort(
        (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      );
      setRecentRecipes(sorted.slice(0, 6));

      // Calculate categories from recipe tags
      const tagCounts = new Map<string, number>();
      recipes.forEach(recipe => {
        recipe.tags.forEach(tag => {
          const normalizedTag = tag.trim();
          if (normalizedTag) {
            tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
          }
        });
      });

      // Convert to array and sort by count (descending), then by name
      const calculatedCategories: RecipeCategory[] = Array.from(tagCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => {
          if (b.count !== a.count) {
            return b.count - a.count; // Sort by count descending
          }
          return a.name.localeCompare(b.name); // Then by name ascending
        })
        .slice(0, 12); // Limit to top 12 categories

      setCategories(calculatedCategories);
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  const handleRecipeDeleted = () => {
    fetchRecipes();
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', py: 3 }}>
      {/* Recent Recipes Section */}
      <Box sx={{ mb: 5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            Recently Added
          </Typography>
          <Button onClick={() => navigate('/search')}>View All</Button>
        </Box>
        <Divider sx={{ mb: 3 }} />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : recentRecipes.length > 0 ? (
          <Grid container spacing={3}>
            {recentRecipes.map(recipe => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
                <RecipeCard
                  recipe={recipe}
                  onDelete={handleRecipeDeleted}
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Box sx={{ textAlign: 'center', py: 5 }}>
            <KitchenIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes yet!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Start by importing your favorite recipes.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => navigate('/import')}
            >
              Import Recipe
            </Button>
          </Box>
        )}
      </Box>

      {/* Categories Section */}
      {categories.length > 0 && (
        <Box sx={{ mb: 5 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            Recipe Categories
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={2}>
            {categories.map(category => (
              <Grid size={{ xs: 6, sm: 4, md: 2 }} key={category.name}>
                <Card
                  sx={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': { transform: 'translateY(-4px)', transition: '0.2s' },
                  }}
                  onClick={() => navigate(`/search?tag=${encodeURIComponent(category.name)}`)}
                >
                  <CardContent>
                    <Typography variant="h6" component="h3">
                      {category.name}
                    </Typography>
                    <Chip
                      label={`${category.count} recipe${category.count !== 1 ? 's' : ''}`}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Box>
  );
};

export default Home;
