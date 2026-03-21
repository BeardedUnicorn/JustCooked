import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Tabs, Tab, Fab, Menu, MenuItem, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Button, Paper, CircularProgress,
  Alert, Snackbar, Card, CardContent,
  CardActions, Grid, IconButton, Chip, Accordion, AccordionSummary,
  AccordionDetails, Slider, FormControl, InputLabel, Select, Rating,

} from '@mui/material';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  FilterList as FilterListIcon,

  Download as DownloadIcon,
  CloudDownload as CloudDownloadIcon,
  Collections as CollectionsIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { Recipe, SearchFilters, RecipeCollection } from '@app-types';
import { getRecipesPaginated, getRecipeCount, searchRecipesPaginated, getSearchRecipesCount, getAllRecipes } from '@services/recipeStorage';
import { saveSearch } from '@services/searchHistoryStorage';
import { getAllCollections, createCollection, deleteCollection, saveCollection } from '@services/recipeCollectionStorage';
import { importRecipeFromUrl } from '@services/recipeImport';
import { getPantryItems, getExpiringItems } from '@services/pantryStorage';
import {
  getExclusions, excludeIngredient, restoreIngredient,
  excludeRecipe, restoreRecipe, normalizeIngredientKey,
} from '@services/useItUpExclusionsStorage';

import { cleanIngredientName, normalizeUnit } from '@utils/ingredientUtils';
import RecipeCard from '@components/RecipeCard';
import BatchImportDialog from '@components/BatchImportDialog';
import AdvancedSearchModal from '@components/AdvancedSearchModal';
import SearchBar from '@components/SearchBar';

const PAGE_SIZE = 24; // Number of recipes per page

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`cookbook-tabpanel-${index}`}
      aria-labelledby={`cookbook-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `cookbook-tab-${index}`,
    'aria-controls': `cookbook-tabpanel-${index}`,
  };
}

const Cookbook: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [tabValue, setTabValue] = useState(0);

  // Import FAB state
  const [fabAnchorEl, setFabAnchorEl] = useState<null | HTMLElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [batchImportOpen, setBatchImportOpen] = useState(false);

  // Single import state
  const [importUrl, setImportUrl] = useState('');
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);


  // All Recipes tab state (from Search.tsx)
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filters, setFilters] = useState<SearchFilters>({
    difficulty: [],
    maxTotalTime: 120,
    minRating: 0,
    dietaryRestrictions: [],
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  // Collections tab state
  const [collections, setCollections] = useState<RecipeCollection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [selectedCollection, setSelectedCollection] = useState<RecipeCollection | null>(null);
  const [collectionRecipes, setCollectionRecipes] = useState<Recipe[]>([]);

  // Collection dialogs
  const [createCollectionDialogOpen, setCreateCollectionDialogOpen] = useState(false);
  const [editCollectionDialogOpen, setEditCollectionDialogOpen] = useState(false);
  const [deleteCollectionDialogOpen, setDeleteCollectionDialogOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [editingCollection, setEditingCollection] = useState<RecipeCollection | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [deletingCollection, setDeletingCollection] = useState<RecipeCollection | null>(null);

  // Smart Cookbook tab state
  const [smartRecipes, setSmartRecipes] = useState<Recipe[]>([]);
  const [pantryItems, setPantryItems] = useState<any[]>([]);
  const [smartLoading, setSmartLoading] = useState(false);

  // Use It Up tab state
  interface UseItUpResult {
    recipe: Recipe;
    expiringCount: number;
    missingCount: number;
    bestShare?: { name: string; share: number };
    soonestDaysLeft: number;
  }
  const [useItUpResults, setUseItUpResults] = useState<UseItUpResult[]>([]);
  const [expiringItems, setExpiringItems] = useState<any[]>([]);
  const [useItUpLoading, setUseItUpLoading] = useState(false);
  const [exclusions, setExclusions] = useState(() => getExclusions());
  const [excludedRecipeLabels, setExcludedRecipeLabels] = useState<{ id: string; title: string }[]>([]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);

    // Load data for the selected tab
    if (newValue === 1 && collections.length === 0) {
      loadCollections();
    } else if (newValue === 2) {
      loadSmartCookbookData();
    } else if (newValue === 3) {
      loadUseItUpData();
    }
  };

  // Initialize with search params
  useEffect(() => {
    const query = searchParams.get('q') || '';
    setSearchTerm(query);

    // Load initial data for All Recipes tab
    fetchRecipes(1, false, query);
  }, [searchParams]);



  const fetchRecipes = useCallback(async (page: number, append: boolean = false, searchQuery?: string) => {
    try {
      if (page === 1) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

      const query = searchQuery !== undefined ? searchQuery : searchTerm;
      const hasActiveFilters = query.trim() || selectedTags.length > 0 ||
        (filters.difficulty && filters.difficulty.length > 0) ||
        (filters.maxTotalTime && filters.maxTotalTime < 120) ||
        (filters.minRating && filters.minRating > 0) ||
        (filters.dietaryRestrictions && filters.dietaryRestrictions.length > 0);

      let recipesData: Recipe[];
      let totalRecipes: number;

      if (hasActiveFilters) {
        // For now, use simple query-based search since the backend expects a string
        const searchQuery = query.trim();

        [recipesData, totalRecipes] = await Promise.all([
          searchRecipesPaginated(searchQuery, page, PAGE_SIZE),
          getSearchRecipesCount(searchQuery)
        ]);
      } else {
        [recipesData, totalRecipes] = await Promise.all([
          getRecipesPaginated(page, PAGE_SIZE),
          getRecipeCount()
        ]);
      }

      if (append) {
        setRecipes(prev => [...prev, ...recipesData]);
      } else {
        setRecipes(recipesData);
      }

      setTotalCount(totalRecipes);
      setCurrentPage(page);
      setHasMore(recipesData.length === PAGE_SIZE && (page * PAGE_SIZE) < totalRecipes);

    } catch (err) {
      console.error('Error fetching recipes:', err);
      setError('Failed to load recipes');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchTerm, selectedTags, filters]);

  const loadCollections = async () => {
    try {
      setCollectionsLoading(true);
      const collectionsData = await getAllCollections();
      const sortedCollections = collectionsData.sort((a, b) =>
        new Date(b.dateModified).getTime() - new Date(a.dateModified).getTime()
      );
      setCollections(sortedCollections);
      setCollectionsError(null);
    } catch (err) {
      setCollectionsError('Failed to load collections');
      console.error('Error loading collections:', err);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const loadSmartCookbookData = async () => {
    try {
      setSmartLoading(true);
      const [loadedRecipes, loadedPantry] = await Promise.all([
        getAllRecipes(),
        getPantryItems()
      ]);

      setPantryItems(loadedPantry);

      if (loadedPantry.length === 0) {
        setSmartRecipes([]);
        return;
      }

      const pantrySet = new Set(loadedPantry.map((item: any) => cleanIngredientName(item.name).toLowerCase()));

      const filteredRecipes = loadedRecipes
        .map(recipe => {
          const matched = recipe.ingredients.filter(ing =>
            pantrySet.has(cleanIngredientName(ing.name).toLowerCase())
          ).length;
          const missing = recipe.ingredients.length - matched;
          return { recipe, missing, matched };
        })
        .filter(({ matched }) => matched > 0)
        .sort((a, b) => a.missing - b.missing)
        .map(({ recipe }) => recipe);

      setSmartRecipes(filteredRecipes);
    } catch (error) {
      console.error('Failed to load smart cookbook data:', error);
    } finally {
      setSmartLoading(false);
    }
  };

  const loadUseItUpData = async (overrideExclusions?: ReturnType<typeof getExclusions>) => {
    try {
      setUseItUpLoading(true);
      const [loadedRecipes, rawExpiring] = await Promise.all([
        getAllRecipes(),
        getExpiringItems(7),
      ]);

      const excl = overrideExclusions ?? getExclusions();
      setExclusions(excl);
      const excludedIngredients = new Set(excl.ingredients);
      const excludedRecipeIds = new Set(excl.recipeIds);

      setExcludedRecipeLabels(
        loadedRecipes
          .filter((r) => excludedRecipeIds.has(r.id))
          .map((r) => ({ id: r.id, title: r.title })),
      );

      const loadedExpiring = rawExpiring.filter(
        (item: any) => !excludedIngredients.has(normalizeIngredientKey(item.name)),
      );
      setExpiringItems(loadedExpiring);

      if (loadedExpiring.length === 0) {
        setUseItUpResults([]);
        return;
      }

      const WINDOW_DAYS = 7;
      const DAY_MS = 24 * 60 * 60 * 1000;
      const now = Date.now();
      const daysUntil = (expiry: string): number => {
        const t = Date.parse(expiry);
        if (Number.isNaN(t)) return WINDOW_DAYS;
        return Math.min(WINDOW_DAYS, Math.max(0, (t - now) / DAY_MS));
      };

      interface ExpiringInfo { expiry: string; amount: number; unit: string; name: string; daysLeft: number }
      const expiringByName = new Map<string, ExpiringInfo>();
      for (const item of loadedExpiring) {
        const key = cleanIngredientName(item.name).toLowerCase();
        const existing = expiringByName.get(key);
        if (!existing || (item.expiryDate && item.expiryDate < existing.expiry)) {
          expiringByName.set(key, {
            expiry: item.expiryDate ?? '',
            amount: item.amount ?? 0,
            unit: item.unit ?? '',
            name: item.name,
            daysLeft: daysUntil(item.expiryDate ?? ''),
          });
        }
      }

      // When recipe and pantry units can't be compared, assume a neutral
      // contribution so incomparable matches are neither rewarded as
      // meaningful nor punished below known-weak matches.
      const NEUTRAL_SHARE = 0.25;

      // Urgency weight: items expiring sooner contribute more. Linear decay
      // from ~8 (expires today) down to 1 (expires at the edge of the window).
      const urgencyWeight = (daysLeft: number) => 1 + (WINDOW_DAYS - daysLeft);

      const ranked = loadedRecipes
        .map((recipe) => {
          let expiringCount = 0;
          let soonestExpiry = '';
          let soonestDaysLeft = Infinity;
          let urgencyScore = 0;
          let bestShare: { name: string; share: number } | undefined;
          for (const ing of recipe.ingredients) {
            const key = cleanIngredientName(ing.name).toLowerCase();
            const info = expiringByName.get(key);
            if (!info) continue;
            expiringCount += 1;
            if (!soonestExpiry || (info.expiry && info.expiry < soonestExpiry)) {
              soonestExpiry = info.expiry;
            }
            if (info.daysLeft < soonestDaysLeft) {
              soonestDaysLeft = info.daysLeft;
            }

            const pantryUnit = normalizeUnit(info.unit).toLowerCase();
            const recipeUnit = normalizeUnit(ing.unit ?? '').toLowerCase();
            const comparable =
              pantryUnit && recipeUnit && pantryUnit === recipeUnit &&
              info.amount > 0 && ing.amount > 0;

            const weight = urgencyWeight(info.daysLeft);
            if (comparable) {
              const share = Math.min(ing.amount / info.amount, 1);
              urgencyScore += share * weight;
              if (!bestShare || share > bestShare.share) {
                bestShare = { name: info.name, share };
              }
            } else {
              urgencyScore += NEUTRAL_SHARE * weight;
            }
          }
          const missingCount = recipe.ingredients.length - expiringCount;
          return { recipe, expiringCount, missingCount, soonestExpiry, soonestDaysLeft, urgencyScore, bestShare };
        })
        .filter((r) => r.expiringCount > 0 && !excludedRecipeIds.has(r.recipe.id))
        .sort((a, b) => {
          if (b.expiringCount !== a.expiringCount) return b.expiringCount - a.expiringCount;
          if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
          if (a.missingCount !== b.missingCount) return a.missingCount - b.missingCount;
          if (a.soonestExpiry !== b.soonestExpiry) return a.soonestExpiry.localeCompare(b.soonestExpiry);
          return a.recipe.title.localeCompare(b.recipe.title);
        })
        .map(({ recipe, expiringCount, missingCount, bestShare, soonestDaysLeft }) =>
          ({ recipe, expiringCount, missingCount, bestShare, soonestDaysLeft }));

      setUseItUpResults(ranked);
    } catch (error) {
      console.error('Failed to load Use It Up data:', error);
    } finally {
      setUseItUpLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom data-testid="cookbook-title">
        Cookbook
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }} data-testid="cookbookPage-tabs-main">
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="cookbook tabs">
          <Tab label="All Recipes" {...a11yProps(0)} data-testid="cookbook-tab-all-recipes" />
          <Tab label="Collections" {...a11yProps(1)} data-testid="cookbook-tab-collections" />
          <Tab label="Smart Cookbook" {...a11yProps(2)} data-testid="cookbook-tab-smart" />
          <Tab label="Use It Up" {...a11yProps(3)} data-testid="cookbook-tab-use-it-up" />
        </Tabs>
      </Box>

      {/* All Recipes Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Search Bar */}
        <Box sx={{ mb: 3 }}>
          <SearchBar
            onSearch={(term) => {
              setSearchTerm(term);
              fetchRecipes(1, false, term);
              if (term.trim()) {
                saveSearch(term, { ...filters, query: term, tags: selectedTags });
              }
            }}
            onAdvancedSearch={() => setAdvancedSearchOpen(true)}
            placeholder="Search recipes..."
            data-testid="cookbook-search-bar"
          />

        </Box>

        {/* Advanced Filters */}
        <Accordion sx={{ mb: 3 }}>
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            aria-controls="filters-content"
            id="filters-header"
            data-testid="cookbook-filters-accordion"
          >
            <FilterListIcon sx={{ mr: 1 }} />
            <Typography>Advanced Filters</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>Difficulty</InputLabel>
                  <Select
                    multiple
                    value={filters.difficulty}
                    onChange={(e) => setFilters(prev => ({ ...prev, difficulty: e.target.value as string[] }))}
                    data-testid="cookbook-difficulty-filter"
                  >
                    <MenuItem value="Easy">Easy</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="Hard">Hard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography gutterBottom>Max Total Time (minutes)</Typography>
                <Slider
                  value={filters.maxTotalTime}
                  onChange={(_, value) => setFilters(prev => ({ ...prev, maxTotalTime: value as number }))}
                  min={15}
                  max={240}
                  step={15}
                  marks={[
                    { value: 15, label: '15m' },
                    { value: 60, label: '1h' },
                    { value: 120, label: '2h' },
                    { value: 240, label: '4h' },
                  ]}
                  valueLabelDisplay="auto"
                  data-testid="cookbook-time-filter"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography gutterBottom>Minimum Rating</Typography>
                <Rating
                  value={filters.minRating}
                  onChange={(_, value) => setFilters(prev => ({ ...prev, minRating: value || 0 }))}
                  data-testid="cookbook-rating-filter"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedTags([]);
                    setFilters({
                      difficulty: [],
                      maxTotalTime: 120,
                      minRating: 0,
                      dietaryRestrictions: [],
                    });
                    fetchRecipes(1, false, '');
                  }}
                  data-testid="cookbook-clear-filters-button"
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        {/* Quick Filters */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Quick Filters
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {['Easy', 'Medium', 'Hard'].map((difficulty) => (
              <Chip
                key={difficulty}
                label={difficulty}
                clickable
                variant={filters.difficulty?.includes(difficulty) ? 'filled' : 'outlined'}
                color={filters.difficulty?.includes(difficulty) ? 'primary' : 'default'}
                onClick={() => {
                  const currentDifficulty = filters.difficulty || [];
                  const newDifficulty = currentDifficulty.includes(difficulty)
                    ? currentDifficulty.filter(d => d !== difficulty)
                    : [...currentDifficulty, difficulty];
                  setFilters(prev => ({ ...prev, difficulty: newDifficulty }));
                  fetchRecipes(1, false);
                }}
                data-testid={`cookbook-quick-filter-${difficulty.toLowerCase()}`}
              />
            ))}
          </Box>
        </Box>

        {/* Results Summary */}
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="body1" color="text.secondary" data-testid="cookbookPage-allRecipes-text-resultsSummary">
            {loading ? 'Loading...' : `${recipes.length} of ${totalCount} recipe${totalCount !== 1 ? 's' : ''} shown`}
          </Typography>

          {searchTerm && (
            <Typography variant="body2" color="text.secondary">
              Searching for: "{searchTerm}"
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} data-testid="cookbookPage-alert-error">
            {error}
          </Alert>
        )}

        {/* Loading Indicator */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }} data-testid="cookbookPage-allRecipes-loading">
            <CircularProgress />
          </Box>
        )}

        {/* Results Grid */}
        <Grid container spacing={3} data-testid="cookbookPage-allRecipes-grid-recipes">
          {recipes.length > 0 ? (
            recipes.map(recipe => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
                <RecipeCard
                  recipe={recipe}
                  onDelete={() => fetchRecipes(1, false)}
                  onUpdate={() => fetchRecipes(1, false)}
                />
              </Grid>
            ))
          ) : !loading ? (
            <Grid size={12}>
              <Paper sx={{ p: 6, textAlign: 'center' }} data-testid="cookbookPage-allRecipes-text-noResults">
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No recipes found
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Try adjusting your search terms or filters.
                </Typography>
              </Paper>
            </Grid>
          ) : null}
        </Grid>

        {/* Load More Button */}
        {hasMore && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={() => fetchRecipes(currentPage + 1, true)}
              disabled={loadingMore}
              startIcon={loadingMore && <CircularProgress size={20} />}
              data-testid="cookbook-load-more-button"
            >
              {loadingMore ? 'Loading...' : 'Load More'}
            </Button>
          </Box>
        )}
      </TabPanel>

      {/* Collections Tab */}
      <TabPanel value={tabValue} index={1}>
        {selectedCollection ? (
          /* Collection View */
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <IconButton
                onClick={() => {
                  setSelectedCollection(null);
                  setCollectionRecipes([]);
                }}
                data-testid="cookbook-collections-back-button"
              >
                <ArrowBackIcon />
              </IconButton>
              <Typography variant="h5" sx={{ ml: 1 }}>
                {selectedCollection.name}
              </Typography>
            </Box>

            {selectedCollection.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {selectedCollection.description}
              </Typography>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {selectedCollection.recipeIds.length} recipe{selectedCollection.recipeIds.length !== 1 ? 's' : ''}
            </Typography>

            {collectionRecipes.length > 0 ? (
              <Grid container spacing={3} data-testid="cookbookPage-collections-grid-recipes">
                {collectionRecipes.map(recipe => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
                    <RecipeCard
                      recipe={recipe}
                      onDelete={() => {
                        // Reload collection recipes
                        const loadCollectionRecipes = async () => {
                          const allRecipes = await getAllRecipes();
                          const filteredRecipes = allRecipes.filter(recipe =>
                            selectedCollection.recipeIds.includes(recipe.id)
                          );
                          setCollectionRecipes(filteredRecipes);
                        };
                        loadCollectionRecipes();
                      }}
                      onUpdate={() => {
                        // Reload collection recipes
                        const loadCollectionRecipes = async () => {
                          const allRecipes = await getAllRecipes();
                          const filteredRecipes = allRecipes.filter(recipe =>
                            selectedCollection.recipeIds.includes(recipe.id)
                          );
                          setCollectionRecipes(filteredRecipes);
                        };
                        loadCollectionRecipes();
                      }}
                    />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper sx={{ p: 6, textAlign: 'center' }} data-testid="cookbookPage-collections-text-noRecipesInCollection">
                <CollectionsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No recipes in this collection
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  Add recipes to this collection from the recipe details page.
                </Typography>
              </Paper>
            )}
          </Box>
        ) : (
          /* Collections List */
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h5">
                Collections
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCreateCollectionDialogOpen(true)}
                data-testid="cookbook-collections-add-button"
              >
                Add Collection
              </Button>
            </Box>

            {collectionsError && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setCollectionsError(null)}>
                {collectionsError}
              </Alert>
            )}

            {collectionsLoading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px" data-testid="cookbookPage-collections-loading">
                <CircularProgress />
              </Box>
            ) : collections.length > 0 ? (
              <Grid container spacing={3}>
                {collections.map((collection) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={collection.id}>
                    <Card
                      sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        cursor: 'pointer',
                        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                      onClick={async () => {
                        setSelectedCollection(collection);
                        // Load recipes for this collection
                        const allRecipes = await getAllRecipes();
                        const filteredRecipes = allRecipes.filter(recipe =>
                          collection.recipeIds.includes(recipe.id)
                        );
                        setCollectionRecipes(filteredRecipes);
                      }}
                      data-testid={`cookbook-collection-card-${collection.id}`}
                    >
                      <CardContent sx={{ flexGrow: 1 }}>
                        <Box display="flex" alignItems="center" mb={2}>
                          <CollectionsIcon sx={{ mr: 1, color: 'primary.main' }} />
                          <Typography variant="h6" component="h2" noWrap>
                            {collection.name}
                          </Typography>
                        </Box>

                        {collection.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {collection.description}
                          </Typography>
                        )}

                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Chip
                            label={`${collection.recipeIds.length} recipe${collection.recipeIds.length !== 1 ? 's' : ''}`}
                            size="small"
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(collection.dateModified).toLocaleDateString()}
                          </Typography>
                        </Box>
                      </CardContent>

                      <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCollection(collection);
                            setEditName(collection.name);
                            setEditDescription(collection.description || '');
                            setEditCollectionDialogOpen(true);
                          }}
                          aria-label="Edit collection"
                          data-testid={`cookbook-collection-${collection.id}-edit-button`}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingCollection(collection);
                            setDeleteCollectionDialogOpen(true);
                          }}
                          aria-label="Delete collection"
                          data-testid={`cookbook-collection-${collection.id}-delete-button`}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Card data-testid="cookbookPage-collections-text-noCollections">
                <CardContent sx={{ textAlign: 'center', py: 8 }}>
                  <CollectionsIcon sx={{ fontSize: 80, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    No collections yet
                  </Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    Create your first collection to organize your favorite recipes!
                  </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateCollectionDialogOpen(true)}
                    data-testid="cookbook-collections-create-first-button"
                  >
                    Create Collection
                  </Button>
                </CardContent>
              </Card>
            )}
          </Box>
        )}
      </TabPanel>

      {/* Smart Cookbook Tab */}
      <TabPanel value={tabValue} index={2}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Smart Cookbook
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Recipes you can make with your pantry items. Sorted by fewest missing ingredients.
        </Typography>

        {smartLoading ? (
          <Box sx={{ textAlign: 'center', py: 6 }} data-testid="cookbookPage-smartCookbook-loading">
            <CircularProgress />
          </Box>
        ) : smartRecipes.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }} data-testid="cookbookPage-smartCookbook-text-noResults">
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No matching recipes
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Add items to your pantry or import more recipes to see suggestions.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3} data-testid="cookbookPage-smartCookbook-grid-recipes">
            {smartRecipes.map((recipe) => {
              // Calculate missing ingredients
              const pantrySet = new Set(pantryItems.map((item: any) => cleanIngredientName(item.name).toLowerCase()));
              const matched = recipe.ingredients.filter(ing =>
                pantrySet.has(cleanIngredientName(ing.name).toLowerCase())
              ).length;
              const missing = recipe.ingredients.length - matched;

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
                  <Box>
                    <RecipeCard
                      recipe={recipe}
                      onDelete={() => loadSmartCookbookData()}
                      onUpdate={() => loadSmartCookbookData()}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {missing === 0 ? 'All ingredients available' : `${missing} ingredients missing`}
                    </Typography>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </TabPanel>

      {/* Use It Up Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Use It Up
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
          Recipes that use pantry items expiring in the next 7 days.
        </Typography>

        {/* Expiring ingredient chips – click × to exclude */}
        {expiringItems.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {Array.from(
              new Map(
                expiringItems.map((i: any) => [normalizeIngredientKey(i.name), i.name]),
              ).entries(),
            ).map(([key, label]) => {
              const onExclude = () => {
                const next = excludeIngredient(label);
                setExclusions(next);
                loadUseItUpData(next);
              };
              return (
                <Chip
                  key={key}
                  label={label}
                  onDelete={onExclude}
                  deleteIcon={
                    <DeleteIcon data-testid={`cookbookPage-useItUp-excludeIngredient-${key}`} />
                  }
                />
              );
            })}
          </Box>
        )}

        {/* Review strip for excluded items */}
        {(exclusions.ingredients.length > 0 || excludedRecipeLabels.length > 0) && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }} data-testid="cookbookPage-useItUp-exclusionsReview">
            <Typography variant="subtitle2" gutterBottom>
              Excluded
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {exclusions.ingredients.map((key) => (
                <Chip
                  key={`ing-${key}`}
                  label={key}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const next = restoreIngredient(key);
                    setExclusions(next);
                    loadUseItUpData(next);
                  }}
                  data-testid={`cookbookPage-useItUp-excludedIngredient-${key}`}
                  deleteIcon={<AddIcon data-testid={`cookbookPage-useItUp-restoreIngredient-${key}`} />}
                  onDelete={() => {
                    const next = restoreIngredient(key);
                    setExclusions(next);
                    loadUseItUpData(next);
                  }}
                />
              ))}
              {excludedRecipeLabels.map(({ id, title }) => (
                <Chip
                  key={`rec-${id}`}
                  label={title}
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    const next = restoreRecipe(id);
                    setExclusions(next);
                    loadUseItUpData(next);
                  }}
                  data-testid={`cookbookPage-useItUp-excludedRecipe-${id}`}
                  deleteIcon={<AddIcon data-testid={`cookbookPage-useItUp-restoreRecipe-${id}`} />}
                  onDelete={() => {
                    const next = restoreRecipe(id);
                    setExclusions(next);
                    loadUseItUpData(next);
                  }}
                />
              ))}
            </Box>
          </Paper>
        )}

        {useItUpLoading ? (
          <Box sx={{ textAlign: 'center', py: 6 }} data-testid="cookbookPage-useItUp-loading">
            <CircularProgress />
          </Box>
        ) : expiringItems.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }} data-testid="cookbookPage-useItUp-text-noExpiring">
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No expiring pantry items
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Nothing in your pantry is expiring in the next 7 days.
            </Typography>
          </Paper>
        ) : useItUpResults.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }} data-testid="cookbookPage-useItUp-text-noMatches">
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes match your expiring items
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Try importing more recipes that use{' '}
              {expiringItems.map((i: any) => i.name).join(', ')}.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={3} data-testid="cookbookPage-useItUp-grid-recipes">
            {useItUpResults.map(({ recipe, expiringCount, missingCount, bestShare, soonestDaysLeft }) => {
              let explanation: string | null = null;
              if (bestShare && bestShare.share >= 0.9) {
                explanation = `Uses most of your ${bestShare.name}`;
              } else if (bestShare && bestShare.share >= 0.5) {
                explanation = `Consumes ${Math.round(bestShare.share * 100)}% of expiring ${bestShare.name}`;
              }
              let urgencyHint: string | null = null;
              if (soonestDaysLeft <= 1) {
                urgencyHint = 'Uses item expiring tomorrow';
              } else if (soonestDaysLeft <= 2) {
                urgencyHint = `Uses item expiring in ${Math.ceil(soonestDaysLeft)} days`;
              }
              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={recipe.id}>
                  <Box data-testid={`cookbookPage-useItUp-result-${recipe.id}`}>
                    <RecipeCard
                      recipe={recipe}
                      onDelete={() => loadUseItUpData()}
                      onUpdate={() => loadUseItUpData()}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      Uses {expiringCount} expiring {expiringCount === 1 ? 'item' : 'items'} ·{' '}
                      {missingCount} {missingCount === 1 ? 'ingredient' : 'ingredients'} missing
                    </Typography>
                    {urgencyHint && (
                      <Typography
                        variant="caption"
                        color="warning.main"
                        sx={{ display: 'block' }}
                        data-testid={`cookbookPage-useItUp-urgency-${recipe.id}`}
                      >
                        {urgencyHint}
                      </Typography>
                    )}
                    {explanation && (
                      <Typography
                        variant="caption"
                        color="primary"
                        sx={{ display: 'block' }}
                        data-testid={`cookbookPage-useItUp-explanation-${recipe.id}`}
                      >
                        {explanation}
                      </Typography>
                    )}
                    <Button
                      size="small"
                      color="inherit"
                      sx={{ mt: 0.5, textTransform: 'none' }}
                      onClick={() => {
                        const next = excludeRecipe(recipe.id);
                        setExclusions(next);
                        loadUseItUpData(next);
                      }}
                      data-testid={`cookbookPage-useItUp-excludeRecipe-${recipe.id}`}
                    >
                      Hide this recipe
                    </Button>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        )}
      </TabPanel>

      {/* Import FAB */}
      <Fab
        color="primary"
        aria-label="import recipe"
        data-testid="cookbook-import-fab"
        sx={{
          position: 'fixed',
          bottom: 80, // Above bottom navigation on mobile
          right: 16,
        }}
        onClick={(event) => setFabAnchorEl(event.currentTarget)}
      >
        <AddIcon />
      </Fab>

      {/* Import Menu */}
      <Menu
        anchorEl={fabAnchorEl}
        open={Boolean(fabAnchorEl)}
        onClose={() => setFabAnchorEl(null)}
        data-testid="cookbook-import-menu"
      >
        <MenuItem
          onClick={() => {
            setFabAnchorEl(null);
            setImportDialogOpen(true);
          }}
          data-testid="cookbook-import-url-menu-item"
        >
          <DownloadIcon sx={{ mr: 1 }} />
          Import from URL
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFabAnchorEl(null);
            setBatchImportOpen(true);
          }}
          data-testid="cookbook-batch-import-menu-item"
        >
          <CloudDownloadIcon sx={{ mr: 1 }} />
          Batch Import
        </MenuItem>
      </Menu>

      {/* Single Import Dialog */}
      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} maxWidth="sm" fullWidth data-testid="cookbookPage-dialog-singleImport">
        <DialogTitle>Import Recipe from URL</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Recipe URL"
            fullWidth
            variant="outlined"
            type="url"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            disabled={importLoading}
            placeholder="https://www.allrecipes.com/recipe/... or any supported site"
            data-testid="cookbook-import-url-input"
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="text.secondary">
            Supported sites: AllRecipes, Food Network, BBC Good Food, Serious Eats, Epicurious, Food.com, Taste of Home, Delish, Bon Appétit, Simply Recipes
          </Typography>
          {importError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {importError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)} disabled={importLoading}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              const trimmedUrl = importUrl.trim();
              if (!trimmedUrl) {
                setImportError('Please enter a valid URL');
                return;
              }

              setImportLoading(true);
              setImportError(null);

              try {
                await importRecipeFromUrl(trimmedUrl);
                setImportSuccess(true);
                setImportUrl('');
                setImportDialogOpen(false);
                // Refresh recipes if on All Recipes tab
                if (tabValue === 0) {
                  fetchRecipes(1, false);
                }
              } catch (err) {
                setImportError(err instanceof Error ? err.message : 'Failed to import recipe');
              } finally {
                setImportLoading(false);
              }
            }}
            variant="contained"
            disabled={importLoading || !importUrl.trim()}
            startIcon={importLoading && <CircularProgress size={20} color="inherit" />}
            data-testid="cookbook-import-submit-button"
          >
            {importLoading ? 'Importing...' : 'Import Recipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Batch Import Dialog */}
      <BatchImportDialog
        open={batchImportOpen}
        onClose={() => setBatchImportOpen(false)}
      />

      {/* Success Snackbar */}
      <Snackbar
        open={importSuccess}
        autoHideDuration={5000}
        onClose={() => setImportSuccess(false)}
        message="Recipe imported successfully!"
        data-testid="cookbookPage-snackbar-importSuccess"
      />

      {/* Create Collection Dialog */}
      <Dialog open={createCollectionDialogOpen} onClose={() => setCreateCollectionDialogOpen(false)} maxWidth="sm" fullWidth data-testid="cookbookPage-dialog-createCollection">
        <DialogTitle>Create New Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            sx={{ mb: 2 }}
            placeholder="e.g., Weeknight Dinners, Holiday Desserts"
            data-testid="cookbook-collections-create-name-input"
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newCollectionDescription}
            onChange={(e) => setNewCollectionDescription(e.target.value)}
            placeholder="Describe what this collection is for..."
            data-testid="cookbook-collections-create-description-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateCollectionDialogOpen(false);
            setNewCollectionName('');
            setNewCollectionDescription('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!newCollectionName.trim()) return;

              try {
                const newCollection = await createCollection(
                  newCollectionName.trim(),
                  newCollectionDescription.trim() || undefined
                );
                setCollections(prev => [newCollection, ...prev]);
                setCreateCollectionDialogOpen(false);
                setNewCollectionName('');
                setNewCollectionDescription('');
                setCollectionsError(null);
              } catch (err) {
                setCollectionsError('Failed to create collection');
                console.error('Error creating collection:', err);
              }
            }}
            variant="contained"
            disabled={!newCollectionName.trim()}
            data-testid="cookbook-collections-create-submit-button"
          >
            Create Collection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Collection Dialog */}
      <Dialog open={editCollectionDialogOpen} onClose={() => setEditCollectionDialogOpen(false)} maxWidth="sm" fullWidth data-testid="cookbookPage-dialog-editCollection">
        <DialogTitle>Edit Collection</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Collection Name"
            fullWidth
            variant="outlined"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            sx={{ mb: 2 }}
            data-testid="cookbook-collections-edit-name-input"
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            data-testid="cookbook-collections-edit-description-input"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditCollectionDialogOpen(false);
            setEditingCollection(null);
            setEditName('');
            setEditDescription('');
          }}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!editingCollection || !editName.trim()) return;

              try {
                const updatedCollection: RecipeCollection = {
                  ...editingCollection,
                  name: editName.trim(),
                  description: editDescription.trim() || undefined,
                };

                await saveCollection(updatedCollection);
                setCollections(prev =>
                  prev.map(col => col.id === updatedCollection.id ? updatedCollection : col)
                );
                setEditCollectionDialogOpen(false);
                setEditingCollection(null);
                setEditName('');
                setEditDescription('');
                setCollectionsError(null);
              } catch (err) {
                setCollectionsError('Failed to update collection');
                console.error('Error updating collection:', err);
              }
            }}
            variant="contained"
            disabled={!editName.trim()}
            data-testid="cookbook-collections-edit-submit-button"
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Collection Dialog */}
      <Dialog open={deleteCollectionDialogOpen} onClose={() => setDeleteCollectionDialogOpen(false)}>
        <DialogTitle>Delete Collection</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deletingCollection?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setDeleteCollectionDialogOpen(false);
            setDeletingCollection(null);
          }}>
            Cancel
          </Button>
          <Button
            onClick={async () => {
              if (!deletingCollection) return;

              try {
                await deleteCollection(deletingCollection.id);
                setCollections(prev => prev.filter(col => col.id !== deletingCollection.id));
                setDeleteCollectionDialogOpen(false);
                setDeletingCollection(null);
                setCollectionsError(null);
              } catch (err) {
                setCollectionsError('Failed to delete collection');
                console.error('Error deleting collection:', err);
              }
            }}
            color="error"
            variant="contained"
            data-testid="cookbook-collections-delete-confirm-button"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Advanced Search Modal */}
      <AdvancedSearchModal
        open={advancedSearchOpen}
        onClose={() => setAdvancedSearchOpen(false)}
        onSearch={(searchFilters) => {
          setFilters(searchFilters);
          fetchRecipes(1, false);
        }}
        initialFilters={filters}
      />
    </Box>
  );
};

export default Cookbook;
