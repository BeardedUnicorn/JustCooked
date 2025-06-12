#!/usr/bin/env python3
"""
Analyze ingredient patterns in the raw_ingredients.csv file to identify
all the different formats that need to be handled by the Rust parser.
"""

import csv
import re
from collections import defaultdict, Counter
import json

def analyze_ingredient_patterns():
    patterns = {
        'quantities': set(),
        'units': set(),
        'parenthetical_amounts': [],
        'ranges': [],
        'fractions': [],
        'decimals': [],
        'preparation_methods': set(),
        'special_cases': [],
        'malformed': [],
        'complex_descriptions': []
    }
    
    # Read the CSV file
    with open('ing_data/raw_ingredients.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ingredient = row['raw_text'].strip()
            if not ingredient:
                continue
                
            analyze_single_ingredient(ingredient, patterns)
    
    # Generate report
    generate_analysis_report(patterns)

def analyze_single_ingredient(ingredient, patterns):
    """Analyze a single ingredient string for patterns"""
    
    # Check for parenthetical amounts like "1 (15 oz) can"
    paren_match = re.search(r'\(([^)]+)\)', ingredient)
    if paren_match:
        patterns['parenthetical_amounts'].append(ingredient)
        patterns['units'].add(paren_match.group(1))
    
    # Check for ranges like "2-3 cups" or "1 to 2"
    range_patterns = [
        r'(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)',
        r'(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)'
    ]
    for pattern in range_patterns:
        if re.search(pattern, ingredient):
            patterns['ranges'].append(ingredient)
            break
    
    # Check for fractions
    fraction_patterns = [
        r'\d+\s+\d+/\d+',  # Mixed fractions like "1 1/2"
        r'\d+/\d+',        # Simple fractions like "1/2"
        r'[¼½¾⅓⅔⅛⅜⅝⅞]'  # Unicode fractions
    ]
    for pattern in fraction_patterns:
        if re.search(pattern, ingredient):
            patterns['fractions'].append(ingredient)
            break
    
    # Check for decimal quantities
    if re.search(r'\d+\.\d+', ingredient):
        patterns['decimals'].append(ingredient)
    
    # Extract quantities (numbers at the beginning)
    qty_match = re.match(r'^([\d\s\/¼½¾⅓⅔⅛⅜⅝⅞\.\-–—]+)', ingredient)
    if qty_match:
        patterns['quantities'].add(qty_match.group(1).strip())
    
    # Extract units (common measurement words)
    unit_words = [
        'cup', 'cups', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons', 'tsp',
        'pound', 'pounds', 'lb', 'ounce', 'ounces', 'oz', 'gram', 'grams', 'g',
        'kilogram', 'kilograms', 'kg', 'liter', 'liters', 'l', 'milliliter', 'milliliters', 'ml',
        'pint', 'pints', 'pt', 'quart', 'quarts', 'qt', 'gallon', 'gallons', 'gal',
        'clove', 'cloves', 'slice', 'slices', 'piece', 'pieces', 'can', 'cans',
        'package', 'packages', 'jar', 'jars', 'bottle', 'bottles', 'bag', 'bags',
        'box', 'boxes', 'container', 'containers', 'bunch', 'bunches',
        'head', 'heads', 'stalk', 'stalks', 'sprig', 'sprigs', 'leaf', 'leaves',
        'large', 'medium', 'small', 'whole', 'fresh', 'dried', 'frozen'
    ]
    
    for unit in unit_words:
        if re.search(rf'\b{unit}\b', ingredient, re.IGNORECASE):
            patterns['units'].add(unit)
    
    # Check for preparation methods (after commas)
    if ',' in ingredient:
        parts = ingredient.split(',')
        if len(parts) > 1:
            prep = parts[1].strip()
            if prep:
                patterns['preparation_methods'].add(prep)
    
    # Check for special cases and malformed patterns
    if ingredient.startswith(('ounce)', 'pound)', 'cup)')):
        patterns['malformed'].append(ingredient)
    
    # Check for complex descriptions with multiple descriptors
    if len(ingredient.split()) > 6:
        patterns['complex_descriptions'].append(ingredient)

def generate_analysis_report(patterns):
    """Generate a comprehensive analysis report"""
    
    print("=== INGREDIENT PATTERN ANALYSIS REPORT ===\n")
    
    print(f"QUANTITIES FOUND ({len(patterns['quantities'])}):")
    for qty in sorted(patterns['quantities'])[:20]:  # Show first 20
        print(f"  '{qty}'")
    if len(patterns['quantities']) > 20:
        print(f"  ... and {len(patterns['quantities']) - 20} more")
    print()
    
    print(f"UNITS FOUND ({len(patterns['units'])}):")
    for unit in sorted(patterns['units']):
        print(f"  '{unit}'")
    print()
    
    print(f"PARENTHETICAL AMOUNTS ({len(patterns['parenthetical_amounts'])}):")
    for item in patterns['parenthetical_amounts'][:10]:  # Show first 10
        print(f"  '{item}'")
    if len(patterns['parenthetical_amounts']) > 10:
        print(f"  ... and {len(patterns['parenthetical_amounts']) - 10} more")
    print()
    
    print(f"RANGES ({len(patterns['ranges'])}):")
    for item in patterns['ranges'][:10]:
        print(f"  '{item}'")
    print()
    
    print(f"FRACTIONS ({len(patterns['fractions'])}):")
    for item in patterns['fractions'][:10]:
        print(f"  '{item}'")
    print()
    
    print(f"DECIMALS ({len(patterns['decimals'])}):")
    for item in patterns['decimals'][:10]:
        print(f"  '{item}'")
    print()
    
    print(f"PREPARATION METHODS ({len(patterns['preparation_methods'])}):")
    for prep in sorted(patterns['preparation_methods'])[:20]:
        print(f"  '{prep}'")
    if len(patterns['preparation_methods']) > 20:
        print(f"  ... and {len(patterns['preparation_methods']) - 20} more")
    print()
    
    print(f"MALFORMED PATTERNS ({len(patterns['malformed'])}):")
    for item in patterns['malformed']:
        print(f"  '{item}'")
    print()
    
    print(f"COMPLEX DESCRIPTIONS ({len(patterns['complex_descriptions'])}):")
    for item in patterns['complex_descriptions'][:10]:
        print(f"  '{item}'")
    print()
    
    # Save detailed patterns to JSON for further analysis
    serializable_patterns = {
        'quantities': list(patterns['quantities']),
        'units': list(patterns['units']),
        'parenthetical_amounts': patterns['parenthetical_amounts'],
        'ranges': patterns['ranges'],
        'fractions': patterns['fractions'],
        'decimals': patterns['decimals'],
        'preparation_methods': list(patterns['preparation_methods']),
        'special_cases': patterns['special_cases'],
        'malformed': patterns['malformed'],
        'complex_descriptions': patterns['complex_descriptions']
    }
    
    with open('ingredient_patterns_analysis.json', 'w') as f:
        json.dump(serializable_patterns, f, indent=2)
    
    print("Detailed analysis saved to 'ingredient_patterns_analysis.json'")

if __name__ == "__main__":
    analyze_ingredient_patterns()
