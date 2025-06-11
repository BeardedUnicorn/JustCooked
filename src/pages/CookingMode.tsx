import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, IconButton, LinearProgress, Paper,
  List, ListItem, ListItemText, Checkbox,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, useTheme, useMediaQuery
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBackIos as ArrowBackIosIcon,
  Timer as TimerIcon,
  CheckCircle as CheckCircleIcon,
  PlayArrow as PlayArrowIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';
import { Recipe } from '@app-types';
import { getRecipeById } from '@services/recipeStorage';

import { formatIngredientForDisplay } from '@utils/ingredientUtils';

const CookingMode: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerDialogOpen, setTimerDialogOpen] = useState(false);


  useEffect(() => {
    const fetchRecipe = async () => {
      if (!id) {
        navigate('/');
        return;
      }

      try {
        const recipeData = await getRecipeById(id);
        if (recipeData) {
          setRecipe(recipeData);
        } else {
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to load recipe:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [id, navigate]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer !== null && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev === null || prev <= 1) {
            setIsTimerRunning(false);
            // Timer finished - could add notification here
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  const handleIngredientCheck = (index: number) => {
    const newChecked = new Set(checkedIngredients);
    if (newChecked.has(index)) {
      newChecked.delete(index);
    } else {
      newChecked.add(index);
    }
    setCheckedIngredients(newChecked);
  };

  const handleNextStep = () => {
    if (recipe && currentStep < recipe.instructions.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStartTimer = (minutes: number) => {
    setTimer(minutes * 60);
    setIsTimerRunning(true);
    setTimerDialogOpen(false);
  };

  const handleStopTimer = () => {
    setTimer(null);
    setIsTimerRunning(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (!recipe) return 0;
    return ((currentStep + 1) / recipe.instructions.length) * 100;
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Loading recipe...</Typography>
      </Box>
    );
  }

  if (!recipe) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Typography>Recipe not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{
      minHeight: '100vh',
      backgroundColor: 'background.default',
      position: 'relative',
      p: isMobile ? 1 : 2,
    }}>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        mb: 2,
        position: 'sticky',
        top: 0,
        backgroundColor: 'background.default',
        zIndex: 1,
        py: 1,
      }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/recipe/${id}`)}
          variant="outlined"
          size={isMobile ? 'small' : 'medium'}
          data-testid="cooking-mode-exit-button"
        >
          Exit Cooking
        </Button>
        
        <Typography variant={isMobile ? 'h6' : 'h5'} sx={{ 
          textAlign: 'center', 
          flex: 1, 
          mx: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {recipe.title}
        </Typography>
        
        <IconButton onClick={toggleFullscreen} size={isMobile ? 'small' : 'medium'} data-testid="cooking-mode-fullscreen-button">
          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </IconButton>
      </Box>

      {/* Progress Bar */}
      <Box sx={{ mb: 3 }}>
        <LinearProgress 
          variant="determinate" 
          value={getProgress()} 
          sx={{ height: 8, borderRadius: 4 }}
        />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          Step {currentStep + 1} of {recipe.instructions.length}
        </Typography>
      </Box>

      {/* Timer Display */}
      {timer !== null && (
        <Paper sx={{ p: 2, mb: 3, textAlign: 'center', backgroundColor: timer <= 60 ? 'error.dark' : 'primary.dark' }}>
          <Typography variant="h4" color="white">
            {formatTime(timer)}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <IconButton
              onClick={() => setIsTimerRunning(!isTimerRunning)}
              sx={{ color: 'white', mr: 1 }}
              data-testid="cooking-mode-timer-play-pause"
            >
              {isTimerRunning ? <PauseIcon /> : <PlayArrowIcon />}
            </IconButton>
            <IconButton onClick={handleStopTimer} sx={{ color: 'white' }} data-testid="cooking-mode-timer-stop">
              <StopIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 3 }}>
        {/* Ingredients Panel */}
        <Paper sx={{ 
          flex: isMobile ? 'none' : '0 0 300px', 
          p: 2, 
          height: 'fit-content',
          position: isMobile ? 'static' : 'sticky',
          top: isMobile ? 'auto' : '120px',
        }}>
          <Typography variant="h6" gutterBottom>
            Ingredients
          </Typography>
          <List dense>
            {recipe.ingredients.map((ingredient, index) => (
              <ListItem key={index} dense data-testid={`cooking-mode-ingredient-${index}`}>
                <Checkbox
                  checked={checkedIngredients.has(index)}
                  onChange={() => handleIngredientCheck(index)}
                  size="small"
                  data-testid={`cooking-mode-ingredient-checkbox-${index}`}
                />
                <ListItemText
                  primary={formatIngredientForDisplay(ingredient)}
                  sx={{
                    textDecoration: checkedIngredients.has(index) ? 'line-through' : 'none',
                    opacity: checkedIngredients.has(index) ? 0.6 : 1,
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>

        {/* Instructions Panel */}
        <Box sx={{ flex: 1 }}>
          <Paper sx={{ p: 3, minHeight: '400px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Step {currentStep + 1}
              </Typography>
              <Chip 
                label={`${recipe.instructions.length - currentStep - 1} steps remaining`}
                size="small"
                color="primary"
              />
            </Box>
            
            <Typography variant="body1" sx={{ 
              fontSize: isMobile ? '1.1rem' : '1.25rem',
              lineHeight: 1.6,
              mb: 3,
            }}>
              {recipe.instructions[currentStep]}
            </Typography>

            {/* Navigation Buttons */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              mt: 4,
            }}>
              <Button
                startIcon={<ArrowBackIosIcon />}
                onClick={handlePrevStep}
                disabled={currentStep === 0}
                variant="outlined"
                size="large"
                data-testid="cooking-mode-previous-step"
              >
                Previous
              </Button>

              <Button
                onClick={() => setTimerDialogOpen(true)}
                startIcon={<TimerIcon />}
                variant="outlined"
                size="large"
                data-testid="cooking-mode-timer-button"
              >
                Timer
              </Button>

              <Button
                endIcon={currentStep === recipe.instructions.length - 1 ? <CheckCircleIcon /> : <ArrowForwardIcon />}
                onClick={handleNextStep}
                disabled={currentStep === recipe.instructions.length - 1}
                variant="contained"
                size="large"
                color={currentStep === recipe.instructions.length - 1 ? 'success' : 'primary'}
                data-testid="cooking-mode-next-step"
              >
                {currentStep === recipe.instructions.length - 1 ? 'Complete' : 'Next'}
              </Button>
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Timer Dialog */}
      <Dialog open={timerDialogOpen} onClose={() => setTimerDialogOpen(false)} data-testid="cooking-mode-timer-dialog">
        <DialogTitle>Set Timer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {[1, 5, 10, 15, 20, 30].map(minutes => (
              <Button
                key={minutes}
                variant="outlined"
                onClick={() => handleStartTimer(minutes)}
                size="small"
                data-testid={`cooking-mode-timer-${minutes}min`}
              >
                {minutes}m
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimerDialogOpen(false)} data-testid="cooking-mode-timer-cancel">Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CookingMode;
