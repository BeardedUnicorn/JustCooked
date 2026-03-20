use crate::database::Ingredient;

const BARE_NAME_PATTERN: &str = r"^(?:can|package|cup|cups|clove|cloves|jar|bottle|box|bag|pound|pounds|ounce|ounces|oz|lb|packet|packets|envelope|envelopes)$";
const INVALID_ONLY_PATTERN: &str = r"^(?:hot|plain|light|optional|note|warning)$";

pub fn canonicalize_ingredient_catalog_name(name: &str) -> Option<String> {
    let mut cleaned = normalize_candidate_text(name);
    if cleaned.is_empty() || is_note_row(&cleaned) {
        return None;
    }

    cleaned = truncate_concatenated_text(&cleaned);
    cleaned = regex::Regex::new(r";\s*for table salt.*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();
    cleaned = regex::Regex::new(r";\s*use half as much by volume.*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();
    cleaned = regex::Regex::new(r"\s*,\s*(?:for serving|for garnish|for dusting).*$")
        .unwrap()
        .replace(&cleaned, "")
        .to_string();

    if let Some((before_comma, _)) = cleaned.split_once(',') {
        cleaned = before_comma.trim().to_string();
    }

    cleaned = regex::Regex::new(r"\s*\([^)]*\)\s*")
        .unwrap()
        .replace_all(&cleaned, " ")
        .to_string();
    cleaned = regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string();

    cleaned = strip_leading_catalog_prefixes(&cleaned)
        .trim_matches(|ch| ch == '"' || ch == '\'')
        .trim()
        .to_lowercase();
    cleaned = regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string();

    if cleaned.is_empty() {
        return None;
    }

    if regex::Regex::new(BARE_NAME_PATTERN).unwrap().is_match(&cleaned) {
        return None;
    }

    if regex::Regex::new(INVALID_ONLY_PATTERN).unwrap().is_match(&cleaned) {
        return None;
    }

    if starts_with_invalid_catalog_prefix(&cleaned) {
        return None;
    }

    if !cleaned.chars().any(char::is_alphabetic) {
        return None;
    }

    Some(cleaned)
}

pub fn canonicalize_recipe_ingredient_for_catalog(ingredient: &Ingredient) -> Option<String> {
    canonicalize_ingredient_catalog_name(&ingredient.name)
}

pub fn is_suspicious_catalog_name(name: &str) -> bool {
    let normalized = normalize_candidate_text(name);

    normalized.is_empty()
        || starts_with_invalid_catalog_prefix(&normalized)
        || regex::Regex::new(BARE_NAME_PATTERN).unwrap().is_match(normalized.trim())
        || is_note_row(&normalized)
}

pub fn clean_scraped_ingredient_string(raw: &str) -> String {
    let mut cleaned = normalize_candidate_text(raw);

    if cleaned.is_empty() || is_note_row(&cleaned) {
        return String::new();
    }

    if cleaned.contains('<') && cleaned.contains('>') {
        cleaned = regex::Regex::new(r"<[^>]*>")
            .unwrap()
            .replace_all(&cleaned, "")
            .to_string();
    }

    cleaned = truncate_concatenated_text(&cleaned);

    if let Some(captures) = regex::Regex::new(r"^([a-zA-Z]+)\)\s+(.+)$").unwrap().captures(&cleaned) {
        let unit = &captures[1];
        let rest = &captures[2];
        let amount = match unit.to_lowercase().as_str() {
            "ounce" | "oz" => "8",
            "pound" | "lb" => "1",
            "cup" => "1",
            "tablespoon" | "tbsp" => "2",
            "teaspoon" | "tsp" => "1",
            _ => "1",
        };
        cleaned = format!("{} {} {}", amount, unit, rest);
    }

    cleaned = regex::Regex::new(r"^([a-zA-Z]+)\)\s+")
        .unwrap()
        .replace(&cleaned, "1 $1 ")
        .to_string();

    regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string()
}

fn normalize_candidate_text(raw: &str) -> String {
    let mut cleaned = raw
        .replace("&nbsp;", " ")
        .replace("&#160;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace('\u{00a0}', " ")
        .replace('_', " ")
        .replace('⁄', "/");

    cleaned = regex::Regex::new(r"&#(\d+);?")
        .unwrap()
        .replace_all(&cleaned, |captures: &regex::Captures| {
            captures
                .get(1)
                .and_then(|value| value.as_str().parse::<u32>().ok())
                .and_then(char::from_u32)
                .map(|ch| ch.to_string())
                .unwrap_or_default()
        })
        .to_string();

    cleaned = regex::Regex::new(r"&#x([0-9a-fA-F]+);?")
        .unwrap()
        .replace_all(&cleaned, |captures: &regex::Captures| {
            captures
                .get(1)
                .and_then(|value| u32::from_str_radix(value.as_str(), 16).ok())
                .and_then(char::from_u32)
                .map(|ch| ch.to_string())
                .unwrap_or_default()
        })
        .to_string();

    regex::Regex::new(r"\s+")
        .unwrap()
        .replace_all(&cleaned, " ")
        .trim()
        .to_string()
}

fn truncate_concatenated_text(text: &str) -> String {
    let chars: Vec<(usize, char)> = text.char_indices().collect();
    for (index, (_, ch)) in chars.iter().enumerate() {
        if *ch != ')' {
            continue;
        }

        let mut next_char = None;
        for (_, candidate) in chars.iter().skip(index + 1) {
            if candidate.is_whitespace() {
                continue;
            }

            next_char = Some(*candidate);
            break;
        }

        if let Some(candidate) = next_char {
            if candidate.is_ascii_digit() || is_unicode_fraction(candidate) {
                let end = chars[index].0 + ch.len_utf8();
                return text[..end].trim().to_string();
            }
        }
    }

    text.trim().to_string()
}

fn is_note_row(text: &str) -> bool {
    let normalized = text.trim().to_lowercase();

    normalized.starts_with('*')
        || normalized.starts_with("note:")
        || normalized.starts_with("options:")
        || normalized.starts_with("option:")
        || normalized.starts_with("to make oat flour")
        || normalized.contains("not recommended for the elderly")
        || normalized.contains("if you are concerned")
}

fn starts_with_invalid_catalog_prefix(text: &str) -> bool {
    let trimmed = text.trim_start();
    let mut chars = trimmed.chars();
    let Some(first) = chars.next() else {
        return false;
    };

    if matches!(first, '&' | '-' | '*') {
        return true;
    }

    first.is_ascii_digit() && chars.next() != Some('%')
}

fn is_unicode_fraction(ch: char) -> bool {
    matches!(ch, '¼' | '½' | '¾' | '⅓' | '⅔' | '⅛' | '⅜' | '⅝' | '⅞')
}

fn strip_leading_catalog_prefixes(text: &str) -> String {
    let mut cleaned = text.trim().to_string();

    loop {
        let next = cleaned
            .trim_start_matches(|ch| ch == '"' || ch == '\'')
            .trim()
            .to_string();
        let next = regex::Regex::new(r"^\[[^\]]+\]\s*")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^(?:an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|\d+(?:\.\d+)?|\d+\s+\d+/\d+|\d+/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]+)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^\([^)]*\)\s*")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^-?(?:\d+(?:\.\d+)?|\d+\s+\d+/\d+|\d+/\d+)?-(?:inch|inches|oz|ounce|ounces|lb|lbs|pound|pounds|g|gram|grams|kg|kilogram|kilograms|ml|milliliter|milliliters|l|liter|liters)\.?\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^(?:cups?|tablespoons?|tbsp\.?|teaspoons?|tsp\.?|ounces?|oz\.?|pounds?|lb\.?|lbs\.?|grams?|kilograms?|milliliters?|liters?|cans?|packages?|jars?|bottles?|bags?|boxes?|containers?|cloves?|heads?|bunches?|stalks?|sprigs?|slices?|pieces?|envelopes?|packets?)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^-?(?:inch|inches|knob|piece|pieces|chunk|chunks|length|lengths|segment|segments|section|sections|slice|slices|stick|sticks|round|rounds|cube|cubes|disk|disks|strip|strips|matchstick|matchsticks|packet|packets|envelope|envelopes)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^(?:small|medium|large)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^(?:peeled|seeded|stemmed|trimmed|cut|cubed|halved|quartered|roughly|finely|thinly|thickly|lightly|minced|chopped|diced|sliced|grated|julienned|crushed)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^(?:of|from)\s+")
            .unwrap()
            .replace(&next, "")
            .to_string();
        let next = regex::Regex::new(r"^[-\s]+")
            .unwrap()
            .replace(&next, "")
            .trim()
            .to_string();

        if next == cleaned {
            return next;
        }

        cleaned = next;
    }
}
