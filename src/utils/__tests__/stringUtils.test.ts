import { describe, test, expect } from 'vitest';
import {
  parseTags,
  normalizeString,
  truncateString,
  capitalizeWords,
  stripHtmlTags,
  slugify,
  containsAnyKeyword,
  extractNumbers,
  cleanWhitespace,
  decodeHtmlEntities,
  decodeAllHtmlEntities
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

  describe('decodeHtmlEntities', () => {
    test('should decode common named HTML entities', () => {
      expect(decodeHtmlEntities('&amp;')).toBe('&');
      expect(decodeHtmlEntities('&lt;')).toBe('<');
      expect(decodeHtmlEntities('&gt;')).toBe('>');
      expect(decodeHtmlEntities('&quot;')).toBe('"');
      expect(decodeHtmlEntities('&apos;')).toBe("'");
    });

    test('should decode numeric HTML entities', () => {
      expect(decodeHtmlEntities('&#39;')).toBe("'");
      expect(decodeHtmlEntities('&#34;')).toBe('"');
      expect(decodeHtmlEntities('&#38;')).toBe('&');
      expect(decodeHtmlEntities('&#60;')).toBe('<');
      expect(decodeHtmlEntities('&#62;')).toBe('>');
    });

    test('should decode hexadecimal HTML entities', () => {
      expect(decodeHtmlEntities('&#x27;')).toBe("'");
      expect(decodeHtmlEntities('&#x22;')).toBe('"');
      expect(decodeHtmlEntities('&#x26;')).toBe('&');
    });

    test('should handle mixed content', () => {
      expect(decodeHtmlEntities('Tom&apos;s Recipe')).toBe("Tom's Recipe");
      expect(decodeHtmlEntities('&lt;div&gt;Hello &amp; Goodbye&lt;/div&gt;')).toBe('<div>Hello & Goodbye</div>');
    });

    test('should handle empty or null input', () => {
      expect(decodeHtmlEntities('')).toBe('');
      expect(decodeHtmlEntities(null as any)).toBe(null);
      expect(decodeHtmlEntities(undefined as any)).toBe(undefined);
    });

    test('should handle strings without entities', () => {
      expect(decodeHtmlEntities('Plain text')).toBe('Plain text');
      expect(decodeHtmlEntities('No entities here')).toBe('No entities here');
    });
  });

  describe('decodeAllHtmlEntities', () => {
    test('should decode malformed entities like &amp;#39', () => {
      expect(decodeAllHtmlEntities('&amp;#39')).toBe("'");
      expect(decodeAllHtmlEntities('&amp;#39;')).toBe("'");
      expect(decodeAllHtmlEntities('Tom&amp;#39s Recipe')).toBe("Tom's Recipe");
    });

    test('should decode malformed hex entities', () => {
      expect(decodeAllHtmlEntities('&amp;#x27')).toBe("'");
      expect(decodeAllHtmlEntities('&amp;#x27;')).toBe("'");
      expect(decodeAllHtmlEntities('&amp;#x22')).toBe('"');
    });

    test('should handle complex recipe text with multiple entity types', () => {
      const input = 'Mom&amp;#39s Famous &quot;Chocolate&quot; Cake &amp; Cookies';
      const expected = 'Mom\'s Famous "Chocolate" Cake & Cookies';
      expect(decodeAllHtmlEntities(input)).toBe(expected);
    });

    test('should recursively decode doubly-encoded named entities', () => {
      expect(decodeAllHtmlEntities('This doesn&amp;#39;t taste bland &amp;amp; stays chewy'))
        .toBe("This doesn't taste bland & stays chewy");
    });

    test('should handle ingredient lists with entities', () => {
      const input = '2 cups all-purpose flour&amp;#44; sifted';
      const expected = '2 cups all-purpose flour, sifted';
      expect(decodeAllHtmlEntities(input)).toBe(expected);
    });

    test('should handle instruction text with entities', () => {
      const input = 'Preheat oven to 350&amp;#176;F &amp; bake for 25&amp;#45;30 minutes';
      const expected = 'Preheat oven to 350°F & bake for 25-30 minutes';
      expect(decodeAllHtmlEntities(input)).toBe(expected);
    });

    test('should handle multiple consecutive entities', () => {
      expect(decodeAllHtmlEntities('&amp;#39;&amp;#39;')).toBe("''");
      expect(decodeAllHtmlEntities('&amp;#34;&amp;#34;')).toBe('""');
    });

    test('should handle regular HTML entities alongside malformed ones', () => {
      const input = '&lt;p&gt;Tom&amp;#39s &amp; Mary&apos;s Recipe&lt;/p&gt;';
      const expected = '<p>Tom\'s & Mary\'s Recipe</p>';
      expect(decodeAllHtmlEntities(input)).toBe(expected);
    });

    test('should handle empty or null input', () => {
      expect(decodeAllHtmlEntities('')).toBe('');
      expect(decodeAllHtmlEntities(null as any)).toBe(null);
      expect(decodeAllHtmlEntities(undefined as any)).toBe(undefined);
    });

    test('should handle strings without entities', () => {
      expect(decodeAllHtmlEntities('Plain text')).toBe('Plain text');
      expect(decodeAllHtmlEntities('No entities here')).toBe('No entities here');
    });

    test('should handle common recipe-specific numeric entities', () => {
      // Common entities found in recipe imports using numeric codes
      expect(decodeAllHtmlEntities('&amp;#8217;')).toBe(String.fromCharCode(8217)); // Right single quotation mark
      expect(decodeAllHtmlEntities('&amp;#8220;')).toBe(String.fromCharCode(8220)); // Left double quotation mark
      expect(decodeAllHtmlEntities('&amp;#8221;')).toBe(String.fromCharCode(8221)); // Right double quotation mark
      expect(decodeAllHtmlEntities('&amp;#8211;')).toBe(String.fromCharCode(8211)); // En dash
      expect(decodeAllHtmlEntities('&amp;#8212;')).toBe(String.fromCharCode(8212)); // Em dash
    });

    test('should handle fractions and special characters', () => {
      expect(decodeAllHtmlEntities('&amp;#189;')).toBe(String.fromCharCode(189)); // 1/2 fraction
      expect(decodeAllHtmlEntities('&amp;#188;')).toBe(String.fromCharCode(188)); // 1/4 fraction
      expect(decodeAllHtmlEntities('&amp;#190;')).toBe(String.fromCharCode(190)); // 3/4 fraction
      expect(decodeAllHtmlEntities('&amp;#176;')).toBe(String.fromCharCode(176)); // Degree symbol
    });
  });
});
