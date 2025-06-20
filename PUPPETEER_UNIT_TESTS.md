**Prerequisites:**

1.  **Puppeteer Setup:** Ensure Puppeteer is installed and configured within your testing framework (e.g., Jest with `jest-puppeteer`, or a custom setup).
2.  **Test Environment:** Have a stable way to run your application locally for Puppeteer to interact with (e.g., `npm run dev`).
3.  **Helper Functions:** Develop common Puppeteer helper functions (e.g., `clickButton(testId)`, `typeInInput(testId, text)`, `waitForElement(testId)`, `getElementText(testId)`, `selectDropdownOption(testId, value)` etc.) to make tests more readable and maintainable.
4.  **Mocking Strategy:** Decide how to mock backend API calls (`invoke`) if needed, to ensure consistent test data and avoid flakiness. For UI/UX interaction tests, you might initially test with real backend calls locally, but for CI, mocks are often preferred.
5.  **Test Data Management:** Plan for how test data will be managed (e.g., seeding a test database, using mock API responses).

---

## Puppeteer UI/UX Interaction Test Creation Task List

**Overall Goal:** Create a suite of Puppeteer tests that validate all key user interactions and UI behaviors across the entire JustCooked application.

---

### **Phase 0: Setup & Foundational Tests**

1.  **Task:** Create Basic Puppeteer Test Setup.
    *   **Details:** Configure `beforeAll`, `afterAll`, `beforeEach`, `afterEach` hooks to launch/close the browser, open new pages, and navigate to the base URL.
    *   Implement basic error handling and screenshot-on-failure.
2.  **Task:** Test Application Launch.
    *   **Details:** Verify the application launches and the main layout (`AppLayout`) renders without errors.
    *   Assert the presence of the main title (e.g., "JustCooked").
3.  **Task:** Test Core Navigation (AppLayout).
    *   **Sub-task:** Test Desktop Drawer Navigation.
        *   Verify drawer toggle button (`appLayout-button-toggleDrawer`) opens and closes the drawer.
        *   Click each navigation item (`appLayout-menuItem-*`) and verify the URL changes and the correct page title/header loads.
    *   **Sub-task:** Test Mobile Bottom Navigation.
        *   Resize viewport to mobile dimensions.
        *   Verify bottom navigation (`appLayout-bottomNav-main`) is visible.
        *   Click each bottom navigation action (`appLayout-bottomNavAction-*`) and verify URL changes and correct page title/header.
    *   **Sub-task:** Test Mobile Drawer Navigation (if different from desktop or used).
        *   Verify mobile drawer opens and closes.
        *   Test navigation items within the mobile drawer.
    *   **Sub-task:** Test Breadcrumb Navigation.
        *   Navigate to a nested page (e.g., Recipe View).
        *   Verify breadcrumbs (`appLayout-breadcrumbs-container`) are displayed.
        *   Click on breadcrumb links (`appLayout-breadcrumbLink-*`) and verify navigation to parent pages.
4.  **Task:** Test Global Queue Status Button and Popup.
    *   **Details:**
        *   Click the queue status button (`queueStatusButton-button-main`).
        *   Verify the `QueueManagementPopup` (`queuePopup-dialog-main`) opens.
        *   Test basic interactions within the popup (e.g., closing it via `queuePopup-button-closeHeader` or `queuePopup-button-closeAction`). (Detailed queue interactions will be tested later).

---

### **Phase 1: Dashboard Hub (`/`) UI/UX Tests**

1.  **Task:** Test Dashboard Initial Load.
    *   **Details:** Navigate to `/`. Verify the dashboard title (`dashboardPage-title-main`) and all widget containers are present.
2.  **Task:** Test "What's for Dinner?" Widget.
    *   **Scenario 1 (Recipe Planned):**
        *   Mock data to show a dinner recipe planned for today.
        *   Verify recipe details are displayed.
        *   Click "View Recipe" button (`dashboardPage-widget-dinner-button-viewRecipe`) and assert navigation to the correct recipe page.
    *   **Scenario 2 (No Recipe Planned):**
        *   Mock data for no dinner recipe.
        *   Verify "No dinner planned" message.
        *   Click "Find a Recipe" button (`dashboardPage-widget-dinner-button-findRecipe`) and assert navigation (e.g., to Cookbook).
3.  **Task:** Test "Quick Actions" Widget.
    *   **Details:** For each action card/button:
        *   Click "Import Recipe" (`dashboardPage-widget-quickActions-card-importRecipe`) and verify navigation/dialog opening.
        *   Click "Add to Pantry" (`dashboardPage-widget-quickActions-card-addToPantry`) and verify navigation/dialog opening.
        *   Click "Meal Planning" (`dashboardPage-widget-quickActions-card-mealPlanning`) and verify navigation to the Planner hub.
4.  **Task:** Test "Today's Plan" Widget.
    *   **Scenario 1 (With Planned Meals):**
        *   Mock data for today's meal plan.
        *   Verify planned meal items (`dashboardPage-widget-todaysPlan-listItem-*`) are displayed.
        *   Click "View Full Plan" button (`dashboardPage-widget-todaysPlan-button-viewFullPlan`) and assert navigation to the Planner hub.
    *   **Scenario 2 (No Meals Planned):**
        *   Mock data for no meals planned.
        *   Verify "No meals planned" message.
5.  **Task:** Test "Pantry At-a-Glance" Widget.
    *   **Scenario 1 (With Expiring Items):**
        *   Mock data for expiring pantry items.
        *   Verify expiring items (`dashboardPage-widget-pantry-listItem-expiring-*`) are displayed.
        *   Click "View Pantry" button (`dashboardPage-widget-pantry-button-viewPantry`) and assert navigation to the Pantry hub.
    *   **Scenario 2 (No Expiring Items):**
        *   Mock data for no expiring items.
        *   Verify "No items expiring soon" message.
6.  **Task:** Test "Recently Added Recipes" Widget.
    *   **Scenario 1 (With Recent Recipes):**
        *   Mock data for recent recipes.
        *   Verify `RecipeCard` components are displayed. Test interaction with one card (navigation).
        *   Click "View All" button (`dashboardPage-widget-recentRecipes-button-viewAll`) and assert navigation to the Cookbook hub.
    *   **Scenario 2 (No Recipes):**
        *   Mock data for no recipes.
        *   Verify "No recipes yet!" message.
        *   Click "Import Recipe" button (`dashboardPage-widget-recentRecipes-button-importFirst`) and verify navigation/dialog.

---

### **Phase 2: Cookbook Hub (`/cookbook`) UI/UX Tests**

1.  **Task:** Test Cookbook Hub Initial Load & Tab Navigation.
    *   **Details:** Navigate to `/cookbook`. Verify title (`cookbookPage-title-main`) and tabs.
    *   Click each tab ("All Recipes", "Collections", "Smart Cookbook") and verify the correct content panel is displayed.
2.  **Task:** Test "All Recipes" Tab.
    *   **Sub-task:** Test Search Bar Interaction.
        *   Type search term into `searchBar-input-main`.
        *   Press Enter or trigger search. Verify API call (mocked) and results update (mocked).
        *   Test clear button (`searchBar-button-clear`).
        *   Test history popover (`searchBar-popover-history`) and selecting a history item.
    *   **Sub-task:** Test Advanced Search Modal.
        *   Click advanced search button (`searchBar-button-advanced`).
        *   Verify `AdvancedSearchModal` (`advancedSearchModal-dialog-main`) opens.
        *   Interact with various filters (difficulty `advancedSearchModal-select-difficulty`, tags `advancedSearchModal-autocomplete-tagsInput`, time `advancedSearchModal-select-prepTime`, etc.).
        *   Test "Reset" (`advancedSearchModal-button-reset`) and "Apply Filters" (`advancedSearchModal-button-apply`). Verify modal closes and search is re-triggered with new filters.
    *   **Sub-task:** Test Filters Accordion.
        *   Toggle accordion (`cookbookPage-filters-accordion`).
        *   Apply filters (difficulty `cookbookPage-allRecipes-filter-difficulty`, time `cookbookPage-allRecipes-filter-time`, rating `cookbookPage-allRecipes-filter-rating`) and verify search updates.
        *   Test "Clear Filters" button (`cookbookPage-allRecipes-button-clearFilters`).
    *   **Sub-task:** Test Quick Filter Chips.
        *   Click various quick filter chips (`cookbookPage-allRecipes-chip-quickFilter-*`) and verify search updates.
    *   **Sub-task:** Test Recipe Grid and Cards.
        *   Verify recipe cards (`recipeCard-container-*`) are displayed.
        *   Test interaction with a `RecipeCard`:
            *   Click card action area (`recipeCard-actionArea-*`) -> navigates to recipe view.
            *   Test "Cook Now" button (`recipeCard-button-cookNow-*`).
            *   Test favorite toggle (`recipeCard-button-favorite-*`).
            *   Test share action (`recipeCard-button-share-*`).
            *   Test "More Actions" menu (`recipeCard-button-more-*`):
                *   Add to Meal Plan (opens dialog `recipeCard-dialog-addToMealPlan-*`, test dialog interaction).
                *   Add to Collection (opens dialog `recipeCard-dialog-addToCollection-*`, test dialog interaction).
                *   Delete Recipe (opens confirmation `recipeCard-dialog-deleteConfirm-*`, test confirmation).
    *   **Sub-task:** Test Load More.
        *   If more recipes are available (mocked), verify "Load More" button (`cookbookPage-allRecipes-button-loadMore`) appears.
        *   Click "Load More" and verify new recipes are appended.
    *   **Sub-task:** Test Empty/No Results State.
        *   Perform a search yielding no results. Verify "No recipes found" message (`cookbookPage-allRecipes-text-noResults`).
3.  **Task:** Test "Collections" Tab.
    *   **Sub-task:** Test Create Collection.
        *   Click "Add Collection" button (`cookbookPage-collections-button-add`).
        *   Verify Create Collection dialog (`cookbookPage-dialog-createCollection`) opens.
        *   Fill name (`cookbookPage-dialog-createCollection-input-name`) and description (`cookbookPage-dialog-createCollection-input-description`).
        *   Submit (`cookbookPage-dialog-createCollection-button-submit`) and verify new collection appears in the list.
        *   Test cancel.
    *   **Sub-task:** Test View Collection.
        *   Click a collection card (`cookbookPage-collections-card-*`).
        *   Verify view switches to show recipes within that collection (recipe cards grid `cookbookPage-collections-grid-recipes`).
        *   Verify "Back to Collections" button (`cookbookPage-collections-button-back`) functionality.
    *   **Sub-task:** Test Edit Collection.
        *   Click edit button on a collection card (`cookbookPage-collections-cardButton-edit-*`).
        *   Verify Edit Collection dialog (`cookbookPage-dialog-editCollection`) opens with pre-filled data.
        *   Modify data and submit (`cookbookPage-dialog-editCollection-button-submit`). Verify collection list updates.
        *   Test cancel.
    *   **Sub-task:** Test Delete Collection.
        *   Click delete button on a collection card (`cookbookPage-collections-cardButton-delete-*`).
        *   Verify confirmation dialog opens.
        *   Confirm delete and verify collection is removed. Test cancel.
    *   **Sub-task:** Test Empty States.
        *   No collections: Verify message and "Create First Collection" button (`cookbookPage-collections-button-createFirst`).
        *   Collection with no recipes: Verify message (`cookbookPage-collections-text-noRecipesInCollection`).
4.  **Task:** Test "Smart Cookbook" Tab.
    *   **Details:**
        *   Mock pantry items.
        *   Verify recipes are displayed based on available (mocked) pantry items.
        *   Test interaction with recipe cards.
        *   Test empty state message (`cookbookPage-smartCookbook-text-noResults`) if no matching recipes.
5.  **Task:** Test Import FAB and Dialogs.
    *   **Details:**
        *   Click Import FAB (`cookbookPage-fab-import`). Verify menu (`cookbookPage-menu-import`) opens.
        *   Click "Import from URL" (`cookbookPage-menuItem-importUrl`). Verify single import dialog (`cookbookPage-dialog-singleImport`) opens.
            *   Test URL input (`cookbookPage-dialog-singleImport-input-url`), submission (`cookbookPage-dialog-singleImport-button-submit`), and cancel.
            *   Test error/success messages.
        *   Click "Batch Import" (`cookbookPage-menuItem-batchImport`). Verify `BatchImportDialog` (`batchImportDialog-dialog-main`) opens. (Detailed `BatchImportDialog` tests are separate).

---

### **Phase 3: Planner Hub (`/planner`) UI/UX Tests**

1.  **Task:** Test Planner Hub Initial Load & Tab Navigation.
    *   **Details:** Navigate to `/planner`. Verify title (`plannerPage-title-main`) and tabs.
    *   Click "Meal Plan" (`plannerPage-tab-mealPlan`) and "Shopping Lists" (`plannerPage-tab-shoppingLists`) tabs and verify content.
2.  **Task:** Test "Meal Plan" Tab.
    *   **Sub-task:** Test Meal Plan Selection.
        *   Interact with meal plan selector (`plannerPage-mealPlan-select-plan`).
        *   Verify `MealPlanView` updates when a different plan is selected.
    *   **Sub-task:** Test Create New Plan Button.
        *   Click "Create New Plan" button (`plannerPage-mealPlan-button-createNewPlan`) and verify navigation (likely to a creation page/dialog not yet detailed in your file list, or it might be part of `/meal-plans` if that was a list page). *Clarify this flow.*
    *   **Sub-task:** Test Embedded `MealPlanView` Interactions.
        *   Verify meal plan details (name, dates, status chip `mealPlanView-chip-status`) are displayed.
        *   "Generate Shopping List" button (`mealPlanView-button-generateShoppingList`):
            *   Verify `ShoppingListGenerator` dialog (`shoppingListGenerator-dialog-main`) opens.
            *   Test dialog: name input (`shoppingListGenerator-input-name`), date pickers, "Preview Ingredients" (`shoppingListGenerator-button-preview`), "Create Shopping List" (`shoppingListGenerator-button-create`).
            *   Test cancel.
        *   "View Shopping Lists" button (`mealPlanView-button-viewShoppingLists`):
            *   Verify dialog (`mealPlanView-dialog-shoppingLists`) opens.
            *   Test viewing a list (`mealPlanView-dialog-shoppingLists-button-view-*`).
        *   "Edit Plan" button (`mealPlanView-button-editPlan`): Verify navigation/dialog for editing. *Clarify this flow.*
        *   Calendar Interactions:
            *   Click an empty slot "Add Recipe" (`mealPlanView-calendar-addRecipe-*`). Verify `RecipeAssignmentDialog` (`recipeAssignmentDialog-dialog-main`) opens.
                *   Test dialog: search (`recipeAssignmentDialog-input-search`), select recipe (`recipeAssignmentDialog-card-recipe-*`), change meal type/servings, assign (`recipeAssignmentDialog-button-assign`), cancel.
            *   Click an assigned recipe (`mealPlanView-calendar-recipeItem-*`). Verify navigation to recipe detail.
            *   Click remove button on an assigned recipe (`mealPlanView-calendar-recipeItem-button-remove-*`). Verify recipe is removed.
    *   **Sub-task:** Test Empty State (No Meal Plans).
        *   Verify message and "Create Meal Plan" button (`plannerPage-mealPlan-button-createFirst`).
3.  **Task:** Test "Shopping Lists" Tab.
    *   **Sub-task:** Test "Create from Meal Plan" Button.
        *   Click button (`plannerPage-shoppingLists-button-createFromMealPlan`) and verify it navigates to "Meal Plan" tab or opens relevant dialog.
    *   **Sub-task:** Test Selecting and Viewing a Shopping List.
        *   Click a shopping list item (`plannerPage-shoppingLists-listItem-*`).
        *   Verify view updates to show `ShoppingListView`.
        *   Test "Back to Shopping Lists" button (`plannerPage-shoppingLists-button-back`).
    *   **Sub-task:** Test Embedded `ShoppingListView` Interactions.
        *   Verify list details (name, date range).
        *   Test Print (`shoppingListView-button-print`) and Share (`shoppingListView-button-share`) buttons.
        *   Test progress bar (`shoppingListView-progressBar-main`) and text update on item check.
        *   Test category collapsing/expanding (`shoppingListView-category-toggle-*`).
        *   Test checking/unchecking an item (`shoppingListView-checkbox-*`).
        *   Test item menu (`shoppingListView-button-itemMenu-*`) and delete action (`shoppingListItemMenu-menuItem-delete-*`).
    *   **Sub-task:** Test Empty State (No Shopping Lists).
        *   Verify message and "Go to Meal Plans" button (`plannerPage-shoppingLists-button-goToMealPlans`).

---

### **Phase 4: Pantry Hub (`/pantry`) UI/UX Tests**

1.  **Task:** Test Pantry Hub Initial Load & Tab Navigation.
    *   **Details:** Navigate to `/pantry`. Verify title (`pantryHubPage-title-main`) and tabs.
    *   Click "My Pantry" (`pantryHubPage-tab-myPantry`) and "Ingredient Database" (`pantryHubPage-tab-ingredientDb`) tabs and verify content.
2.  **Task:** Test "My Pantry" Tab.
    *   **Sub-task:** Test Add Item FAB and Menu.
        *   Click FAB (`pantryHubPage-myPantry-fab-addItem`). Verify menu (`pantryHubPage-myPantry-menu-addItem`) opens.
        *   "Scan Barcode": Verify `BarcodeScanner` opens. (Scanner interaction is complex, test dialog opening/closing).
        *   "Search Product": Verify `ProductSearchModal` (`productSearchModal-dialog-main`) opens.
            *   Test search (`productSearchModal-input-search`), select product (`productSearchModal-listItem-result-*`), configure details (amount, unit), Add to Pantry (`productSearchModal-button-addToPantry`).
            *   Test `IngredientAssociationModal` (`ingredientAssocModal-dialog-main`) flow if triggered.
            *   Test `CreateProductDialog` (`createProductDialog-dialog-main`) flow if triggered from barcode scan.
        *   "Add Manually": Verify `PantryItemDialog` (`pantryItemDialog-dialog-main`) opens.
            *   Test form (name `pantryItemDialog-input-name`, amount, unit, etc.), submit (`pantryItemDialog-button-submit`), cancel.
    *   **Sub-task:** Test `PantryManager` Item Interactions.
        *   Verify items are grouped by category (`pantryManager-header-category-*`).
        *   Edit item (`pantryManager-button-edit-*`): Opens dialog, pre-fills, test update. Test `IngredientAssociationModal` flow if product code present but no mapping.
        *   Delete item (`pantryManager-button-delete-*`): Verify item removal.
        *   Link ingredient (`pantryManager-button-linkIngredient-*`): Opens `IngredientAssociationModal`, test association.
    *   **Sub-task:** Test Empty State (`pantryManager-emptyState-container`).
3.  **Task:** Test "Ingredient Database" Tab.
    *   **Sub-task:** Test Search and Filtering.
        *   Type in search input (`pantryHubPage-ingredientDb-input-search`).
        *   Select category filter (`pantryHubPage-ingredientDb-select-category`).
        *   Verify ingredient list updates.
    *   **Sub-task:** Test Pagination (`pantryHubPage-ingredientDb-pagination`).
    *   **Sub-task:** Test Add Ingredient.
        *   Click FAB (`pantryHubPage-ingredientDb-fab-add`).
        *   Verify dialog (`pantryHubPage-dialog-ingredient`) opens.
        *   Fill form (name `pantryHubPage-dialog-ingredient-input-name`, category, aliases), submit (`pantryHubPage-dialog-ingredient-button-save`), cancel.
        *   Verify new ingredient appears in the list.
    *   **Sub-task:** Test Edit Ingredient.
        *   Click edit button (`pantryHubPage-ingredientDb-button-edit-*`).
        *   Verify dialog opens with pre-filled data. Test update.
    *   **Sub-task:** Test Delete Ingredient.
        *   Click delete button (`pantryHubPage-ingredientDb-button-delete-*`). Verify confirmation (if any) and removal.

---

### **Phase 5: Settings Page (`/settings`) UI/UX Tests**

1.  **Task:** Test Settings Page Initial Load.
    *   **Details:** Navigate to `/settings`. Verify title (`settingsPage-title-main`) and sections.
2.  **Task:** Test Database Management Section.
    *   **Sub-task:** Export Database.
        *   Click export button (`dbManagement-button-export`).
        *   (Difficult to test actual file download in Puppeteer, focus on UI feedback/dialogs if any before actual system dialog).
        *   Test success/error alerts (`dbManagement-alert-success`, `dbManagement-alert-error`).
    *   **Sub-task:** Import Database.
        *   Click import button (`dbManagement-button-import`).
        *   Verify confirmation dialog (`confirmationDialog-database-import-confirm-dialog-dialog`) opens.
        *   Test "Replace existing" switch (`dbManagement-switch-replaceExisting`).
        *   (Difficult to test file selection, mock the file input or test up to the point of dialog).
        *   Test success/error alerts.
    *   **Sub-task:** Reset Database.
        *   Click reset button (`dbManagement-button-reset`).
        *   Verify confirmation dialog (`confirmationDialog-database-reset-confirm-dialog-dialog`) opens.
        *   Confirm reset. Verify success/error alerts.
3.  **Task:** Test Logging Section.
    *   **Details:**
        *   Verify log path field (`loggingSection-textField-logPath`) displays a path.
        *   Test "Copy Path" button (`loggingSection-button-copyPath`). (Verify clipboard content if possible, or just click).
        *   Test "Open Log Folder" button (`loggingSection-button-openDir`). (Difficult to verify, test click and UI feedback).
        *   Test success/error alerts.

---

### **Phase 6: Individual Recipe & Cooking Mode UI/UX Tests**

1.  **Task:** Test Recipe View Page (`/recipe/:id`).
    *   **Details:** Navigate to a recipe page.
    *   Verify `RecipeDetail` component renders correctly.
        *   Test servings adjustment controls (`recipeDetail-button-decreaseServings-*`, `recipeDetail-button-increaseServings-*`, input `recipeDetail-input-servings-*`).
        *   Test "Open Source URL" link (`recipeDetail-link-sourceUrl-*`).
        *   Test "Edit" button (`recipeDetail-button-edit-*`) (if applicable, navigation/dialog).
        *   Test "Re-import Recipe" button (`recipeDetail-button-reimport-*`) and subsequent snackbars (`recipeDetail-snackbar-reimportSuccess`, `recipeDetail-snackbar-reimportError`).
    *   Test "Start Cooking" button (`recipeViewPage-button-startCooking`) navigates to cooking mode.
    *   Test "Print" button (`recipeViewPage-button-print`).
    *   Test "Delete" button (`recipeViewPage-button-delete`) and confirmation dialog (`recipeViewPage-dialog-deleteConfirm`).
2.  **Task:** Test Cooking Mode Page (`/recipe/:id/cook`).
    *   **Details:** Navigate to cooking mode for a recipe.
    *   Verify header elements (title `cookingMode-text-title`, exit button `cookingMode-button-exit`, fullscreen button `cookingMode-button-fullscreen`).
    *   Test step navigation: "Previous" (`cookingMode-button-prevStep`) and "Next" (`cookingMode-button-nextStep`). Verify step text (`cookingMode-text-currentInstruction`) and progress bar (`cookingMode-progressBar-steps`) update.
    *   Test ingredients panel/drawer:
        *   Open/close mobile drawer (`cookingMode-fab-ingredientsMobile`, `cookingMode-drawer-button-closeIngredients`).
        *   Check/uncheck ingredients (`cookingMode-checkbox-ingredient-*`) and verify strikethrough style.
    *   Test timer functionality:
        *   Open timer dialog (`cookingMode-button-openTimerDialog`).
        *   Select preset timer (`cookingMode-dialog-timer-preset-*`).
        *   Verify timer display (`cookingMode-text-timerDisplay`) counts down.
        *   Test play/pause (`cookingMode-button-timerPlayPause`) and stop (`cookingMode-button-timerStop`) timer controls.
    *   Test fullscreen toggle.
    *   Test "Exit Cooking" button.

---

### **Phase 7: Cross-Cutting Concerns & Finalization**

1.  **Task:** Test Responsive Design for Key Pages.
    *   **Details:** For major pages (Dashboard, Cookbook All Recipes, Recipe View, Cooking Mode), resize viewport to common breakpoints (mobile, tablet, desktop) and assert key layout elements are correctly displayed/hidden/rearranged.
2.  **Task:** Test Global Error Handling (if applicable).
    *   **Details:** If there's a global error boundary or notification system, try to trigger a general error and verify its display.
3.  **Task:** Test for Basic Accessibility.
    *   **Details:** On key pages, use Puppeteer's accessibility tree snapshot or manually check for focus management, keyboard navigability (tabbing to all interactive elements).
4.  **Task:** Test Suite Organization and Reporting.
    *   **Details:** Organize tests into logical suites/files. Ensure test reports are clear and provide actionable feedback on failures.
5.  **Task:** Review and Refine Tests.
    *   **Details:** Review all written tests for clarity, stability, and maintainability. Remove redundant tests. Optimize selectors.

---

This list is extensive. It's recommended to tackle it iteratively, starting with the most critical user flows and gradually increasing coverage. Good luck!
