### **Project Refactor Checklist: JustCooked UI/UX Redesign**

**Goal:** Refactor the application's UI/UX from a flat, feature-list navigation to a more intuitive, hub-based architecture. This will streamline user workflows, improve discoverability, and create a more cohesive user experience.

---

### **Phase 1: Foundational Navigation Refactor** ✅ COMPLETED

*Objective: Restructure the main application layout and routing to support the new hub-based navigation.*

*   [x] **1.1. Create New Hub Page Files:**
    *   Create new, empty React component files for the main hubs in the `src/pages/` directory:
        *   `src/pages/Dashboard.tsx`
        *   `src/pages/Cookbook.tsx`
        *   `src/pages/Planner.tsx`
        *   `src/pages/PantryHub.tsx` (Use `PantryHub` to avoid naming conflict with the existing `Pantry.tsx` for now).

*   [x] **1.2. Refactor `AppLayout.tsx`:**
    *   Open `src/components/AppLayout.tsx`.
    *   Modify the `menuItems` array to reflect the new 5-hub structure. The old list should be completely replaced.
        ```typescript
        // New menuItems array in AppLayout.tsx
        const menuItems = [
          { text: 'Dashboard', icon: <HomeIcon />, path: '/', label: 'Dashboard' },
          { text: 'Cookbook', icon: <BookIcon />, path: '/cookbook', label: 'Cookbook' },
          { text: 'Planner', icon: <CalendarMonthIcon />, path: '/planner', label: 'Planner' },
          { text: 'Pantry', icon: <KitchenIcon />, path: '/pantry', label: 'Pantry' },
          { text: 'Settings', icon: <SettingsIcon />, path: '/settings', label: 'Settings' },
        ];
        ```
    *   Ensure the `BottomNavigation` (mobile view) also uses this new, shorter `menuItems` list.
    *   **Temporarily remove** the global `<SearchBar />` from the `AppBar`. It will be re-integrated into the Cookbook hub later.
    *   Remove the "Import Recipe" item from the navigation logic entirely.

*   [x] **1.3. Update `App.tsx` Router:**
    *   Open `src/App.tsx`.
    *   Update the `Routes` to map the new hub paths to their corresponding new components.
    *   Keep the old routes (`/search`, `/collections`, etc.) for now to allow for incremental refactoring, but they will no longer be accessible from the main navigation.
        ```tsx
        // Example of new routes to add in App.tsx
        <Route path="/" element={<Dashboard />} />
        <Route path="/cookbook" element={<Cookbook />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/pantry" element={<PantryHub />} />
        // The /settings route already exists and can be kept.
        ```

### **Phase 2: Building the Hubs**

*Objective: Consolidate existing pages and features into the new hub components.*

*   [x] **2.1. Build the Dashboard Hub (`Dashboard.tsx`):**
    *   This is a new page.
    *   Create a layout using MUI `Grid` and `Card` components for a widget-based dashboard.
    *   **Widget: "Today's Plan":** Fetch data from `mealPlanStorage` for the current day and display scheduled recipes.
    *   **Widget: "Shopping List Preview":** Fetch data from `shoppingListStorage` for the latest list and display the top 5-7 unchecked items.
    *   **Widget: "Pantry At-a-Glance":** Fetch data from `pantryStorage` to show items expiring soon.
    *   **Widget: "Quick Actions":** Add large, clear `Button` components for "Import Recipe", "Add to Pantry", and "Create Meal Plan".
    *   **Widget: "Recently Added":** Move the logic from the old `Home.tsx` to display the 4-6 most recent recipes using the `RecipeCard` component.

*   [x] **2.2. Build the Cookbook Hub (`Cookbook.tsx`):**
    *   Use MUI `Tabs` to create a three-tab layout.
    *   **Tab 1: "All Recipes"**:
        *   Move the entire contents and logic from `src/pages/Search.tsx` into this tab.
        *   Integrate the `<SearchBar />` and advanced filter controls directly into this tab's view, removing them from the global `AppLayout`.
    *   **Tab 2: "Collections"**:
        *   Move the collection list logic from `src/pages/Collections.tsx` here.
        *   **Implement new UX:** When a user clicks on a collection card, do **not** navigate to `/collections/:id`. Instead, update the state of the `Cookbook.tsx` component to display the recipes from the selected collection within the same tab view. Add a "Back to Collections" button.
        *   The logic from `CollectionView.tsx` will be merged into this conditional rendering.
    *   **Tab 3: "Smart Cookbook"**:
        *   Move the contents and logic from `src/pages/SmartCookbook.tsx` into this tab.
    *   **Implement Import FAB:**
        *   Add an MUI `<Fab>` (Floating Action Button) with an `AddIcon` to the `Cookbook.tsx` page.
        *   On click, this FAB should open an MUI `<Menu>` with two items:
            1.  "Import from URL": Opens a dialog containing the single URL import form (from the old `Import.tsx`).
            2.  "Batch Import": Opens the `BatchImportDialog`.

*   [x] **2.3. Build the Planner Hub (`Planner.tsx`):**
    *   Use MUI `Tabs` or another layout control to manage the two main views.
    *   **Tab 1: "Meal Plan"**:
        *   This tab's content will be the `MealPlanView.tsx` component.
        *   Add a dropdown (`Select` component) to switch between different meal plans. This replaces the need for the `MealPlans.tsx` list page.
        *   Ensure primary actions like "Generate Shopping List" are accessible here.
    *   **Tab 2: "Shopping Lists"**:
        *   This tab will list all generated shopping lists (from `getShoppingListsByMealPlan`).
        *   Clicking a list renders the `ShoppingListView.tsx` component for that list within this tab.

*   [x] **2.4. Build the Pantry Hub (`PantryHub.tsx`):**
    *   Use MUI `Tabs` for the layout.
    *   **Tab 1: "My Pantry"**:
        *   This tab will contain the `PantryManager` component from the existing `Pantry.tsx` page.
        *   Modify the "Add Item" flow to present a menu with "Scan Barcode", "Search Product", and "Add Manually" options. The `ProductSearchModal` and `BarcodeScanner` will be launched from here.
    *   **Tab 2: "Ingredient Database"**:
        *   Move the contents and logic from `src/pages/Ingredients.tsx` here. This view allows users to manage the master list of all ingredients known to the app.

### **Phase 3: Component-Level Enhancements** ✅ COMPLETED

*Objective: Implement smaller, targeted UX improvements to key components.*

*   [x] **3.1. Enhance `RecipeCard.tsx`:**
    *   Open `src/components/RecipeCard.tsx`.
    *   Add "Add to Meal Plan" and "Add to Collection" to the three-dot `Menu`. This will likely involve opening a dialog to select the target plan/collection.

*   [x] **3.2. Refine `CookingMode.tsx`:**
    *   Open `src/pages/CookingMode.tsx`.
    *   Increase the `fontSize` and `lineHeight` of the current instruction text to make it the primary focus.
    *   For mobile views (`isMobile` is true), refactor the ingredients list to be in a collapsible drawer or bottom sheet, so it can be hidden to maximize screen space for the current step.

### **Phase 4: Cleanup and Finalization** ✅ COMPLETED

*Objective: Remove redundant code and verify the new flows are working correctly.*

*   [x] **4.1. Delete Redundant Page Files:**
    *   Once the hubs are fully functional, delete the following old page files from `src/pages/`:
        *   `Home.tsx`
        *   `Search.tsx`
        *   `Collections.tsx`
        *   `CollectionView.tsx`
        *   `SmartCookbook.tsx`
        *   `Import.tsx`
        *   `MealPlans.tsx`
        *   `ShoppingListPage.tsx`
        *   `Pantry.tsx`
        *   `Ingredients.tsx`

*   [x] **4.2. Clean Up `App.tsx` Router:**
    *   Remove all routes corresponding to the deleted pages. The router should now be much simpler, primarily pointing to the hub components.

*   [x] **4.3. Final UI/UX Review:**
    *   Click through every button, link, and tab in the application.
    *   Verify all navigation works as expected.
    *   Check for consistent styling and layout across the new hubs.
    *   Ensure there are no dead ends or broken user flows.
