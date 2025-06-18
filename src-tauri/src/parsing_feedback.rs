use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tracing::{info, warn, debug};
use chrono::{DateTime, Utc};

/// Confidence level for parsing results
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ConfidenceLevel {
    High,    // > 0.8
    Medium,  // 0.5 - 0.8
    Low,     // < 0.5
    Unknown, // No confidence score available
}

impl ConfidenceLevel {
    /// Convert a confidence score to a confidence level
    pub fn from_score(score: f64) -> Self {
        if score > 0.8 {
            ConfidenceLevel::High
        } else if score >= 0.5 {
            ConfidenceLevel::Medium
        } else {
            ConfidenceLevel::Low
        }
    }
}



/// User feedback on parsing results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingFeedback {
    pub id: String,
    pub original_text: String,
    pub parsed_name: String,
    pub parsed_amount: Option<f64>,
    pub parsed_unit: Option<String>,
    pub parsed_section: Option<String>,
    pub confidence_level: ConfidenceLevel,
    pub user_rating: UserRating,
    pub corrected_name: Option<String>,
    pub corrected_amount: Option<f64>,
    pub corrected_unit: Option<String>,
    pub corrected_section: Option<String>,
    pub user_comments: Option<String>,
    pub timestamp: DateTime<Utc>,
    pub parsing_method: ParsingMethod,
}

/// User rating for parsing accuracy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum UserRating {
    Excellent,  // Perfect parsing
    Good,       // Minor issues
    Fair,       // Some issues but usable
    Poor,       // Major issues
    Terrible,   // Completely wrong
    NotRated,   // User hasn't provided feedback
}

/// Method used for parsing
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ParsingMethod {
    IngredientCrate,
    RegexFallback,
    Manual,
}

/// Parsing correction suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsingCorrection {
    pub original_text: String,
    pub suggested_name: String,
    pub suggested_amount: Option<f64>,
    pub suggested_unit: Option<String>,
    pub suggested_section: Option<String>,
    pub confidence_score: f64,
    pub reason: String,
}

/// Feedback statistics for monitoring parsing quality
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeedbackStatistics {
    pub total_feedback_count: usize,
    pub rating_distribution: HashMap<UserRating, usize>,
    pub method_performance: HashMap<ParsingMethod, f64>, // Average rating score
    pub confidence_accuracy: HashMap<ConfidenceLevel, f64>, // How often high confidence was correct
    pub common_corrections: Vec<(String, String)>, // (original, corrected) pairs
    pub improvement_suggestions: Vec<String>,
}

/// Manager for collecting and analyzing parsing feedback
pub struct ParsingFeedbackManager {
    feedback_history: Arc<Mutex<Vec<ParsingFeedback>>>,
    correction_suggestions: Arc<Mutex<Vec<ParsingCorrection>>>,
}

impl ParsingFeedbackManager {
    pub fn new() -> Self {
        Self {
            feedback_history: Arc::new(Mutex::new(Vec::new())),
            correction_suggestions: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Submit user feedback for a parsing result
    pub fn submit_feedback(&self, feedback: ParsingFeedback) -> Result<(), String> {
        let mut history = self.feedback_history.lock()
            .map_err(|_| "Failed to acquire feedback history lock")?;
        
        info!("Received user feedback for ingredient '{}': {:?}", 
            feedback.original_text, feedback.user_rating);
        
        history.push(feedback);
        
        // Limit history size to prevent memory issues
        if history.len() > 10000 {
            history.drain(0..1000); // Remove oldest 1000 entries
            warn!("Feedback history trimmed to prevent memory issues");
        }
        
        Ok(())
    }

    /// Get feedback statistics
    pub fn get_statistics(&self) -> Result<FeedbackStatistics, String> {
        let history = self.feedback_history.lock()
            .map_err(|_| "Failed to acquire feedback history lock")?;
        
        let total_count = history.len();
        
        // Calculate rating distribution
        let mut rating_distribution = HashMap::new();
        for feedback in history.iter() {
            *rating_distribution.entry(feedback.user_rating.clone()).or_insert(0) += 1;
        }
        
        // Calculate method performance (average rating score)
        let mut method_totals: HashMap<ParsingMethod, (f64, usize)> = HashMap::new();
        for feedback in history.iter() {
            let score = match feedback.user_rating {
                UserRating::Excellent => 5.0,
                UserRating::Good => 4.0,
                UserRating::Fair => 3.0,
                UserRating::Poor => 2.0,
                UserRating::Terrible => 1.0,
                UserRating::NotRated => continue,
            };
            
            let entry = method_totals.entry(feedback.parsing_method.clone()).or_insert((0.0, 0));
            entry.0 += score;
            entry.1 += 1;
        }
        
        let method_performance: HashMap<ParsingMethod, f64> = method_totals
            .into_iter()
            .map(|(method, (total, count))| (method, total / count as f64))
            .collect();
        
        // Calculate confidence accuracy
        let mut confidence_totals: HashMap<ConfidenceLevel, (usize, usize)> = HashMap::new();
        for feedback in history.iter() {
            let is_accurate = matches!(feedback.user_rating, UserRating::Excellent | UserRating::Good);
            let entry = confidence_totals.entry(feedback.confidence_level.clone()).or_insert((0, 0));
            entry.1 += 1; // Total count
            if is_accurate {
                entry.0 += 1; // Accurate count
            }
        }
        
        let confidence_accuracy: HashMap<ConfidenceLevel, f64> = confidence_totals
            .into_iter()
            .map(|(level, (accurate, total))| (level, accurate as f64 / total as f64))
            .collect();
        
        // Find common corrections
        let mut corrections: HashMap<String, String> = HashMap::new();
        for feedback in history.iter() {
            if let Some(corrected_name) = &feedback.corrected_name {
                if corrected_name != &feedback.parsed_name {
                    corrections.insert(feedback.parsed_name.clone(), corrected_name.clone());
                }
            }
        }
        
        let common_corrections: Vec<(String, String)> = corrections
            .into_iter()
            .take(10) // Top 10 most common corrections
            .collect();
        
        // Generate improvement suggestions
        let improvement_suggestions = self.generate_improvement_suggestions(&history);
        
        Ok(FeedbackStatistics {
            total_feedback_count: total_count,
            rating_distribution,
            method_performance,
            confidence_accuracy,
            common_corrections,
            improvement_suggestions,
        })
    }

    /// Generate improvement suggestions based on feedback patterns
    fn generate_improvement_suggestions(&self, history: &[ParsingFeedback]) -> Vec<String> {
        let mut suggestions = Vec::new();
        
        // Analyze poor ratings
        let poor_ratings = history.iter()
            .filter(|f| matches!(f.user_rating, UserRating::Poor | UserRating::Terrible))
            .count();
        
        let total_ratings = history.iter()
            .filter(|f| !matches!(f.user_rating, UserRating::NotRated))
            .count();
        
        if total_ratings > 0 {
            let poor_percentage = (poor_ratings as f64 / total_ratings as f64) * 100.0;
            
            if poor_percentage > 20.0 {
                suggestions.push("Consider adjusting confidence threshold - high rate of poor ratings".to_string());
            }
            
            if poor_percentage > 30.0 {
                suggestions.push("Consider switching to more accurate model or enabling fallback mode".to_string());
            }
        }
        
        // Analyze confidence vs accuracy
        let high_confidence_wrong = history.iter()
            .filter(|f| f.confidence_level == ConfidenceLevel::High && 
                matches!(f.user_rating, UserRating::Poor | UserRating::Terrible))
            .count();
        
        if high_confidence_wrong > 5 {
            suggestions.push("High confidence predictions are often wrong - consider model retraining".to_string());
        }
        
        // Analyze method performance
        let ingredient_crate_poor = history.iter()
            .filter(|f| f.parsing_method == ParsingMethod::IngredientCrate &&
                matches!(f.user_rating, UserRating::Poor | UserRating::Terrible))
            .count();

        let fallback_good = history.iter()
            .filter(|f| f.parsing_method == ParsingMethod::RegexFallback &&
                matches!(f.user_rating, UserRating::Good | UserRating::Excellent))
            .count();

        if ingredient_crate_poor > fallback_good && ingredient_crate_poor > 10 {
            suggestions.push("Regex fallback performing better than ingredient crate - consider adjusting parsing strategy".to_string());
        }
        
        suggestions
    }

    /// Add a parsing correction suggestion
    pub fn add_correction_suggestion(&self, correction: ParsingCorrection) -> Result<(), String> {
        let mut suggestions = self.correction_suggestions.lock()
            .map_err(|_| "Failed to acquire correction suggestions lock")?;
        
        debug!("Added correction suggestion for '{}': '{}'", 
            correction.original_text, correction.suggested_name);
        
        suggestions.push(correction);
        
        // Limit suggestions size
        if suggestions.len() > 1000 {
            suggestions.drain(0..100); // Remove oldest 100 entries
        }
        
        Ok(())
    }

    /// Get correction suggestions for a given ingredient text
    pub fn get_correction_suggestions(&self, ingredient_text: &str) -> Result<Vec<ParsingCorrection>, String> {
        let suggestions = self.correction_suggestions.lock()
            .map_err(|_| "Failed to acquire correction suggestions lock")?;
        
        let matches: Vec<ParsingCorrection> = suggestions
            .iter()
            .filter(|s| s.original_text.to_lowercase().contains(&ingredient_text.to_lowercase()) ||
                ingredient_text.to_lowercase().contains(&s.original_text.to_lowercase()))
            .cloned()
            .collect();
        
        Ok(matches)
    }

    /// Clear all feedback history (for testing or privacy)
    pub fn clear_feedback_history(&self) -> Result<(), String> {
        let mut history = self.feedback_history.lock()
            .map_err(|_| "Failed to acquire feedback history lock")?;
        
        history.clear();
        info!("Feedback history cleared");
        
        Ok(())
    }

    /// Export feedback data for analysis
    pub fn export_feedback_data(&self) -> Result<String, String> {
        let history = self.feedback_history.lock()
            .map_err(|_| "Failed to acquire feedback history lock")?;
        
        serde_json::to_string_pretty(&*history)
            .map_err(|e| format!("Failed to serialize feedback data: {}", e))
    }
}

impl Default for ParsingFeedbackManager {
    fn default() -> Self {
        Self::new()
    }
}

// Global feedback manager instance
static GLOBAL_FEEDBACK_MANAGER: std::sync::OnceLock<ParsingFeedbackManager> = std::sync::OnceLock::new();

/// Get the global parsing feedback manager
pub fn get_parsing_feedback_manager() -> &'static ParsingFeedbackManager {
    GLOBAL_FEEDBACK_MANAGER.get_or_init(|| ParsingFeedbackManager::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_confidence_level_from_score() {
        assert_eq!(ConfidenceLevel::from_score(0.9), ConfidenceLevel::High);
        assert_eq!(ConfidenceLevel::from_score(0.7), ConfidenceLevel::Medium);
        assert_eq!(ConfidenceLevel::from_score(0.3), ConfidenceLevel::Low);
    }

    #[test]
    fn test_feedback_manager() {
        let manager = ParsingFeedbackManager::new();
        
        let feedback = ParsingFeedback {
            id: "test-1".to_string(),
            original_text: "2 cups flour".to_string(),
            parsed_name: "flour".to_string(),
            parsed_amount: Some(2.0),
            parsed_unit: Some("cups".to_string()),
            parsed_section: None,
            confidence_level: ConfidenceLevel::High,
            user_rating: UserRating::Excellent,
            corrected_name: None,
            corrected_amount: None,
            corrected_unit: None,
            corrected_section: None,
            user_comments: None,
            timestamp: Utc::now(),
            parsing_method: ParsingMethod::IngredientCrate,
        };
        
        assert!(manager.submit_feedback(feedback).is_ok());
        
        let stats = manager.get_statistics().unwrap();
        assert_eq!(stats.total_feedback_count, 1);
        assert_eq!(stats.rating_distribution.get(&UserRating::Excellent), Some(&1));
    }
}
