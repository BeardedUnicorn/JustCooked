import React from 'react';
import {
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Box,
  Paper,
} from '@mui/material';
import { Ingredient } from '@app-types';
import { formatAmountForDisplay } from '@utils/ingredientUtils';
import { parseIngredientNameAndPreparation } from '@utils/ingredientUtils';

interface SectionedIngredientsProps {
  ingredients: Ingredient[];
  'data-testid'?: string;
}

interface IngredientSection {
  name: string;
  ingredients: Ingredient[];
}

const SectionedIngredients: React.FC<SectionedIngredientsProps> = ({ 
  ingredients, 
  'data-testid': testId = 'sectioned-ingredients' 
}) => {
  // Group ingredients by section
  const sections: IngredientSection[] = React.useMemo(() => {
    const sectionMap = new Map<string, Ingredient[]>();

    ingredients.forEach(ingredient => {
      const sectionName = ingredient.section || 'Ingredients';
      if (!sectionMap.has(sectionName)) {
        sectionMap.set(sectionName, []);
      }
      sectionMap.get(sectionName)!.push(ingredient);
    });

    // Convert to array and sort sections
    const sectionsArray = Array.from(sectionMap.entries()).map(([name, ingredients]) => ({
      name,
      ingredients,
    }));

    // Sort sections: "Ingredients" first (for recipes without sections), then alphabetically
    sectionsArray.sort((a, b) => {
      if (a.name === 'Ingredients' && b.name !== 'Ingredients') return -1;
      if (b.name === 'Ingredients' && a.name !== 'Ingredients') return 1;
      return a.name.localeCompare(b.name);
    });

    return sectionsArray;
  }, [ingredients]);

  return (
    <Box data-testid={testId}>
      {sections.map((section, sectionIndex) => (
        <Box key={section.name} sx={{ mb: sectionIndex < sections.length - 1 ? 4 : 0 }}>
          {/* Section Header - only show if there are multiple sections or section is not "Ingredients" */}
          {(sections.length > 1 || section.name !== 'Ingredients') && (
            <Typography 
              variant="h6" 
              component="h3" 
              gutterBottom
              sx={{ 
                fontWeight: 'bold',
                color: 'primary.main',
                mb: 2,
              }}
              data-testid={`ingredient-section-header-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {section.name}
            </Typography>
          )}
          
          {/* Ingredients Table */}
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table 
              size="small" 
              sx={{ '& .MuiTableCell-root': { border: 'none', py: 1, px: 1.5 } }}
              data-testid={`ingredient-section-table-${section.name.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', fontSize: '0.875rem', width: '20%' }}>
                    Amount
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', fontSize: '0.875rem', width: '50%' }}>
                    Ingredient
                  </TableCell>
                  <TableCell sx={{ fontWeight: 'bold', color: 'text.secondary', fontSize: '0.875rem', width: '30%' }}>
                    Preparation
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {section.ingredients.map((ingredient, index) => {
                  const { ingredient: ingredientName, preparation } = parseIngredientNameAndPreparation(ingredient.name);
                  const amountWithUnit = ingredient.unit 
                    ? `${formatAmountForDisplay(ingredient.amount)} ${ingredient.unit}`
                    : formatAmountForDisplay(ingredient.amount);
                  
                  return (
                    <TableRow 
                      key={`${section.name}-${index}`} 
                      sx={{ '&:hover': { bgcolor: 'action.hover' } }}
                      data-testid={`ingredient-row-${section.name.toLowerCase().replace(/\s+/g, '-')}-${index}`}
                    >
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {amountWithUnit}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography variant="body2">
                          {ingredientName}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: 'top' }}>
                        <Typography 
                          variant="body2" 
                          color="text.secondary" 
                          sx={{ fontStyle: preparation ? 'italic' : 'normal' }}
                        >
                          {preparation || '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Divider between sections (except for the last one) */}
          {sectionIndex < sections.length - 1 && (
            <Divider sx={{ my: 2 }} />
          )}
        </Box>
      ))}
    </Box>
  );
};

export default SectionedIngredients;
