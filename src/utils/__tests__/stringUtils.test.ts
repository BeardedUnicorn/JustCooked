import { describe, test, expect } from '@jest/globals';
import {
  parseTags,
  normalizeString,
  truncateString,
  capitalizeWords,
  stripHtmlTags,
  slugify,
  containsAnyKeyword,
  extractNumbers,
  cleanWhitespace
} from '@utils/stringUtils';

describe('stringUtils', () => {
  describe('parseTags', () => {
    test('should parse comma-separated tags', () => {
      expect(parseTags('tag1, tag2, tag3')).toEqual(['tag1', 'tag2', 'tag3']);
      expect(parseTags('breakfast,lunch,dinner')).toEqual(['breakfast', 'lunch', 'dinner']);
    });

    test('should trim whitespace from tags', () => {
      expect(parseTags('  tag1  ,  tag2  ,  tag3  ')).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('should filter out empty tags', () => {
      expect(parseTags('tag1, , tag3, ')).toEqual(['tag1', 'tag3']);
      expect(parseTags(',,,tag1,,,tag2,,,')).toEqual(['tag1', 'tag2']);
    });

    test('should limit to 10 tags', () => {
      const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i + 1}`).join(', ');
      const result = parseTags(manyTags);
      expect(result).toHaveLength(10);
      expect(result).toEqual(['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7', 'tag8', 'tag9', 'tag10']);
    });

    test('should handle empty or null input', () => {
      expect(parseTags('')).toEqual([]);
      expect(parseTags(null as any)).toEqual([]);
      expect(parseTags(undefined as any)).toEqual([]);
    });
  });

  describe('normalizeString', () => {
    test('should convert to lowercase and trim', () => {
      expect(normalizeString('  Hello World  ')).toBe('hello world');
      expect(normalizeString('UPPERCASE')).toBe('uppercase');
    });

    test('should replace multiple spaces with single space', () => {
      expect(normalizeString('hello    world')).toBe('hello world');
      expect(normalizeString('multiple   spaces   here')).toBe('multiple spaces here');
    });

    test('should handle empty strings', () => {
      expect(normalizeString('')).toBe('');
      expect(normalizeString('   ')).toBe('');
    });
  });

  describe('truncateString', () => {
    test('should truncate long strings', () => {
      expect(truncateString('This is a very long string', 10)).toBe('This is...');
      expect(truncateString('Short', 10)).toBe('Short');
    });

    test('should handle edge cases', () => {
      expect(truncateString('', 10)).toBe('');
      expect(truncateString('abc', 3)).toBe('abc');
      expect(truncateString('abcd', 3)).toBe('...');
    });

    test('should handle strings exactly at limit', () => {
      expect(truncateString('exactly10!', 10)).toBe('exactly10!');
      expect(truncateString('exactly11!!', 10)).toBe('exactly...');
    });
  });

  describe('capitalizeWords', () => {
    test('should capitalize first letter of each word', () => {
      expect(capitalizeWords('hello world')).toBe('Hello World');
      expect(capitalizeWords('the quick brown fox')).toBe('The Quick Brown Fox');
    });

    test('should handle single words', () => {
      expect(capitalizeWords('hello')).toBe('Hello');
      expect(capitalizeWords('a')).toBe('A');
    });

    test('should handle empty strings', () => {
      expect(capitalizeWords('')).toBe('');
      expect(capitalizeWords('   ')).toBe('   ');
    });

    test('should handle mixed case input', () => {
      expect(capitalizeWords('hELLo WoRLd')).toBe('HELLo WoRLd');
    });
  });

  describe('stripHtmlTags', () => {
    test('should remove HTML tags', () => {
      expect(stripHtmlTags('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
      expect(stripHtmlTags('<div><span>Test</span></div>')).toBe('Test');
    });

    test('should handle self-closing tags', () => {
      expect(stripHtmlTags('Line 1<br/>Line 2<hr/>')).toBe('Line 1Line 2');
    });

    test('should handle strings without HTML', () => {
      expect(stripHtmlTags('Plain text')).toBe('Plain text');
      expect(stripHtmlTags('')).toBe('');
    });

    test('should handle malformed HTML', () => {
      expect(stripHtmlTags('<p>Unclosed tag')).toBe('Unclosed tag');
      expect(stripHtmlTags('Text with < and > symbols')).toBe('Text with  symbols'); // < and > are treated as empty tag
    });
  });

  describe('slugify', () => {
    test('should create URL-friendly slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('The Quick Brown Fox')).toBe('the-quick-brown-fox');
    });

    test('should handle special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
      expect(slugify('Test@#$%^&*()String')).toBe('teststring');
    });

    test('should handle multiple spaces and underscores', () => {
      expect(slugify('hello    world')).toBe('hello-world');
      expect(slugify('hello___world')).toBe('hello-world');
      expect(slugify('hello---world')).toBe('hello-world');
    });

    test('should remove leading and trailing hyphens', () => {
      expect(slugify('  hello world  ')).toBe('hello-world');
      expect(slugify('---hello world---')).toBe('hello-world');
    });

    test('should handle empty strings', () => {
      expect(slugify('')).toBe('');
      expect(slugify('   ')).toBe('');
    });
  });

  describe('containsAnyKeyword', () => {
    test('should find matching keywords', () => {
      expect(containsAnyKeyword('Hello World', ['world', 'test'])).toBe(true);
      expect(containsAnyKeyword('The quick brown fox', ['quick', 'slow'])).toBe(true);
    });

    test('should be case insensitive', () => {
      expect(containsAnyKeyword('Hello World', ['WORLD', 'TEST'])).toBe(true);
      expect(containsAnyKeyword('HELLO WORLD', ['world', 'test'])).toBe(true);
    });

    test('should return false when no keywords match', () => {
      expect(containsAnyKeyword('Hello World', ['test', 'example'])).toBe(false);
    });

    test('should handle empty inputs', () => {
      expect(containsAnyKeyword('', ['test'])).toBe(false);
      expect(containsAnyKeyword('Hello World', [])).toBe(false);
    });

    test('should handle partial matches', () => {
      expect(containsAnyKeyword('Hello World', ['wor'])).toBe(true);
      expect(containsAnyKeyword('Testing', ['test'])).toBe(true);
    });
  });

  describe('extractNumbers', () => {
    test('should extract whole numbers', () => {
      expect(extractNumbers('I have 5 apples and 10 oranges')).toEqual([5, 10]);
      expect(extractNumbers('Recipe serves 4 people')).toEqual([4]);
    });

    test('should extract decimal numbers', () => {
      expect(extractNumbers('Use 1.5 cups of flour')).toEqual([1.5]);
      expect(extractNumbers('Temperature: 350.5 degrees')).toEqual([350.5]);
    });

    test('should handle mixed numbers', () => {
      expect(extractNumbers('Mix 2 cups flour with 1.5 cups milk for 10 minutes')).toEqual([2, 1.5, 10]);
    });

    test('should handle strings without numbers', () => {
      expect(extractNumbers('No numbers here')).toEqual([]);
      expect(extractNumbers('')).toEqual([]);
    });

    test('should handle edge cases', () => {
      expect(extractNumbers('3.14159 and 2.71828')).toEqual([3.14159, 2.71828]);
      expect(extractNumbers('0.5 and 0')).toEqual([0.5, 0]);
    });
  });

  describe('cleanWhitespace', () => {
    test('should normalize line endings', () => {
      expect(cleanWhitespace('line1\r\nline2')).toBe('line1\nline2');
      expect(cleanWhitespace('line1\r\nline2\r\nline3')).toBe('line1\nline2\nline3');
    });

    test('should replace tabs with spaces', () => {
      expect(cleanWhitespace('hello\tworld')).toBe('hello world');
      expect(cleanWhitespace('tab\there')).toBe('tab here');
    });

    test('should replace multiple spaces with single space', () => {
      expect(cleanWhitespace('hello     world')).toBe('hello world');
      expect(cleanWhitespace('multiple   spaces')).toBe('multiple spaces');
    });

    test('should trim leading and trailing whitespace', () => {
      expect(cleanWhitespace('  hello world  ')).toBe('hello world');
      expect(cleanWhitespace('\n\t  text  \t\n')).toBe('text');
    });

    test('should handle empty strings', () => {
      expect(cleanWhitespace('')).toBe('');
      expect(cleanWhitespace('   \t\n  ')).toBe('');
    });

    test('should handle complex whitespace combinations', () => {
      expect(cleanWhitespace('  line1\r\n\t  line2   \n  line3  ')).toBe('line1\n line2 \n line3');
    });
  });
});
