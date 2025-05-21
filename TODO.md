# Filadex TODO List

This document contains a list of pending tasks and improvements for the Filadex application.

## User Interface Improvements

### Sharing Page
- [x] **Fix Back Button**: The back button on the sharing page view currently has no function. Implement proper navigation back to the previous page.
- [x] **Display Sharing User**: Add the username of the user who is sharing the filaments to the sharing page view to provide better context.

### Menu and Navigation
- [x] **Menu Structure Cleanup**: Reorganize the menu to have fewer buttons and a more logical structure. Consider grouping related functions.
- [x] **List Menu Icon**: Change the icon of the list menu button from the settings icon to a list icon for better visual representation.

### Filtering and Sorting
- [x] **Reorder Filter Bar**: Change the order of filters in the filament filter bar from "material, vendor, color" to "vendor, material, color" for a more logical flow.

### View Options
- [x] **Table View for Filaments**: Add a table/list view with columns as an alternative to the grid view. Include:
  - Column-based sorting functionality
  - Toggle switch between grid and table views
  - Maintain the current grid view as the default option
  - Ensure the table view shows all relevant filament data in a structured format with sortable columns

## Translations and Text

- [x] **German Translation Fix**: Change the German translation for "spooled" from the current text to "mit Spule" for better accuracy.
- [x] **Missing Translation**: Add missing translation for "filaments.spools" in all languages, which currently shows the key instead of the translated text in statistics.

## Data Management

- [x] **Empty Initial Lists**: When starting the application from scratch, all lists should be empty. Currently, there are prefilled entries. Modify the initialization process to only add data when explicitly requested.
- [x] **Filament Import/Export**: Implement functionality to import and export filament data:
  - Export all filaments to CSV or JSON format for backup purposes
  - Import filaments from CSV or JSON files
  - Provide validation for imported data
  - Handle duplicate detection during import

## Error Handling and Logging

- [x] **Unauthorized Access Errors**: Fix console error messages that appear when accessing the page while not logged in. These should be handled gracefully.
- [x] **General Error Cleanup**: Review and fix all other error messages or warnings that appear in the console to ensure a clean development environment.

## Technical Debt

- [ ] **Code Refactoring**: Identify and refactor any duplicated or complex code to improve maintainability.
- [ ] **Performance Optimization**: Review application performance, especially for larger filament collections, and optimize where necessary.
- [ ] **Test Coverage**: Increase test coverage for critical components and functionality.

## Documentation

- [x] **Update API Documentation**: Ensure all API endpoints are properly documented.
- [ ] **User Guide Updates**: Update the user guide to reflect recent changes and new features.

## Future Enhancements (Backlog)

- [x] **Batch Operations**: Add functionality for batch operations on filaments (delete, update).
- [ ] **Filament Usage History**: Implement tracking of filament usage history.
- [ ] **Print Job Association**: Add ability to associate print jobs with filaments.
- [ ] **Enhanced Sharing Features**: Implement QR code generation, password protection, and temporary links for shared collections.

---

This TODO list is a living document and should be updated as tasks are completed or new requirements are identified.
