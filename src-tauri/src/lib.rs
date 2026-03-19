#[allow(non_snake_case)]
pub mod recipe_import;
pub mod image_storage;
pub mod database;
pub mod logging;
pub mod batch_import;
pub mod import_queue;
pub mod ingredient_parsing;
pub mod parsing_feedback;
pub mod conversions;
mod app;

#[cfg(test)]
mod ingredient_parsing_tests;

#[cfg(test)]
mod e2e_tests;

#[cfg(test)]
pub(crate) use app::{
    clean_ingredient_name,
    is_measurement_unit,
    parse_enhanced_amount,
    parse_ingredient_string_fallback,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    app::run_app();
}
