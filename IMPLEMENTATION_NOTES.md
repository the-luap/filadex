# Filadex Implementation Notes

This document provides technical guidance for implementing the tasks listed in the TODO.md file.

## User Interface Improvements

### Sharing Page

#### Fix Back Button
- **Files to modify**: `client/src/pages/public-filaments.tsx`
- **Implementation approach**:
  - Add a click handler to the back button that uses the browser's history API
  - Example: `const handleBackClick = () => { window.history.back(); };`
  - Attach this handler to the back button: `<Button onClick={handleBackClick}>Back</Button>`

#### Display Sharing User
- **Files to modify**:
  - `server/routes.js` - Add user information to the API response
  - `client/src/pages/public-filaments.tsx` - Display the username
- **Implementation approach**:
  - Modify the `/api/public/filaments/:userId` endpoint to include user information
  - Add a section in the UI to display "Shared by: [username]"

### Menu and Navigation

#### Menu Structure Cleanup
- **Files to modify**: `client/src/components/Header.tsx`
- **Implementation approach**:
  - Group related menu items under dropdown menus
  - Consider categories like "Inventory", "Settings", "User", etc.
  - Use a component like `DropdownMenu` from your UI library

#### List Menu Icon
- **Files to modify**: `client/src/components/Header.tsx`
- **Implementation approach**:
  - Replace the current settings icon with a list icon
  - Example: `<ListIcon />` instead of `<SettingsIcon />`

### Filtering and Sorting

#### Reorder Filter Bar
- **Files to modify**: `client/src/components/FilamentFilterBar.tsx`
- **Implementation approach**:
  - Reorder the filter components in the JSX
  - Ensure the tab order (tabIndex) is also updated accordingly

### View Options

#### Table View for Filaments
- **Files to modify**:
  - `client/src/pages/FilamentList.tsx` (or equivalent main filament list component)
  - `client/src/components/FilamentTable.tsx` (new component to create)
  - `client/src/store/index.ts` (to store view preference)
- **Implementation approach**:
  - Create a new table component that displays filaments in a column-based format
  - Add a toggle switch in the UI to switch between grid and table views
  - Store the user's view preference in local storage or application state
  - Implement column sorting functionality:
    ```javascript
    // Example sorting function
    const sortByColumn = (column) => {
      const sorted = [...filaments].sort((a, b) => {
        if (a[column] < b[column]) return sortDirection === 'asc' ? -1 : 1;
        if (a[column] > b[column]) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
      setFilaments(sorted);
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    };
    ```
  - Add column headers with sort indicators
  - Ensure the table is responsive and works well on mobile devices

## Translations and Text

#### German Translation Fix
- **Files to modify**: `client/src/i18n/de.json`
- **Implementation approach**:
  - Locate the translation key for "spooled"
  - Change the value to "mit Spule"

#### Missing Translation
- **Files to modify**:
  - `client/src/i18n/en.json`
  - `client/src/i18n/de.json`
- **Implementation approach**:
  - Add the missing key "filaments.spools" to all language files
  - Example: `"filaments.spools": "Spools"` in English
  - Example: `"filaments.spools": "Spulen"` in German

## Data Management

#### Empty Initial Lists
- **Files to modify**:
  - `docker-entrypoint.sh`
  - `init-data.js`
- **Implementation approach**:
  - Modify the initialization logic to only add sample data if explicitly requested
  - Add an environment variable like `INIT_SAMPLE_DATA=true/false`
  - Update the docker-entrypoint.sh script to check this variable before inserting data

#### Filament Import/Export
- **Files to modify**:
  - `client/src/pages/Settings.tsx` (or create a new page for import/export)
  - `client/src/components/ImportExportModal.tsx` (new component)
  - `server/routes.js` (for API endpoints)
  - `server/storage.js` (for database operations)
- **Implementation approach**:
  - **Export functionality**:
    - Create a new API endpoint for exporting filaments: `GET /api/filaments/export`
    - Implement a function to convert filaments to CSV or JSON format
    - Add a download button in the UI that triggers the export
    ```javascript
    // Example export function (client-side)
    const exportFilaments = async (format = 'csv') => {
      try {
        const response = await fetch(`/api/filaments/export?format=${format}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `filadex-export-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error('Export failed:', error);
        // Show error notification
      }
    };
    ```

  - **Import functionality**:
    - Create a new API endpoint for importing filaments: `POST /api/filaments/import`
    - Implement a file upload component in the UI
    - Add validation for the imported data
    - Implement duplicate detection logic
    - Allow users to select which filaments to import
    ```javascript
    // Example import function (server-side)
    app.post('/api/filaments/import', authenticate, upload.single('file'), async (req, res) => {
      try {
        const fileContent = req.file.buffer.toString();
        let filaments = [];

        if (req.file.mimetype === 'application/json') {
          filaments = JSON.parse(fileContent);
        } else if (req.file.mimetype === 'text/csv') {
          filaments = parseCSV(fileContent);
        } else {
          return res.status(400).json({ message: 'Unsupported file format' });
        }

        // Validate filaments
        const validationErrors = validateFilaments(filaments);
        if (validationErrors.length > 0) {
          return res.status(400).json({ message: 'Validation errors', errors: validationErrors });
        }

        // Check for duplicates
        const existingFilaments = await storage.getFilaments(req.userId);
        const duplicates = findDuplicates(filaments, existingFilaments);

        // Return preview data with duplicate flags
        res.json({
          filaments: filaments.map(f => ({
            ...f,
            isDuplicate: duplicates.some(d => d.name === f.name && d.manufacturer === f.manufacturer)
          }))
        });
      } catch (error) {
        logger.error('Import error:', error);
        res.status(500).json({ message: 'Import failed' });
      }
    });
    ```

  - **UI Components**:
    - Create a modal dialog for import/export operations
    - Add file input for import
    - Add format selection for export (CSV/JSON)
    - Implement a preview table for imported filaments
    - Add checkboxes to select which filaments to import
    - Show validation errors and duplicate warnings

## Error Handling and Logging

#### Unauthorized Access Errors
- **Files to modify**:
  - `client/src/App.tsx`
  - `client/src/api/index.ts`
- **Implementation approach**:
  - Add proper error handling for unauthorized requests
  - Implement a global error boundary in React
  - Add conditional checks before making API calls that require authentication

#### General Error Cleanup
- **Implementation approach**:
  - Use browser developer tools to identify all console errors and warnings
  - Address each error individually
  - Common fixes include:
    - Adding null checks
    - Handling promise rejections
    - Fixing React key warnings
    - Addressing accessibility issues

## Technical Debt

#### Code Refactoring
- **Implementation approach**:
  - Identify duplicated code and extract into reusable functions or components
  - Apply the DRY (Don't Repeat Yourself) principle
  - Consider using custom hooks for common functionality

#### Performance Optimization
- **Implementation approach**:
  - Use React.memo for components that render frequently but rarely change
  - Implement virtualization for long lists using libraries like react-window
  - Optimize database queries for large datasets

#### Test Coverage
- **Implementation approach**:
  - Add unit tests for critical components using Jest and React Testing Library
  - Add integration tests for key user flows
  - Set up CI/CD to run tests automatically

## Documentation

#### Update API Documentation
- **Implementation approach**:
  - Document all API endpoints with:
    - URL
    - Method (GET, POST, etc.)
    - Required parameters
    - Response format
    - Authentication requirements
    - Example requests and responses

#### User Guide Updates
- **Implementation approach**:
  - Update screenshots to reflect the current UI
  - Add sections for new features
  - Ensure all user flows are documented

## Development Process

When implementing these changes, consider the following approach:

1. **Create a branch**: Create a new branch for each task or related group of tasks
2. **Write tests**: Add tests before making changes when possible
3. **Make changes**: Implement the required changes
4. **Test locally**: Ensure everything works as expected
5. **Update documentation**: Update relevant documentation
6. **Create a pull request**: Submit your changes for review

## Priority Order

Consider implementing these changes in the following order:

1. Error handling and logging issues (these affect user experience)
2. UI improvements (back button, menu structure)
3. Translation fixes
4. Data management issues
5. Technical debt
6. Documentation updates

This order prioritizes user-facing issues first, followed by developer experience improvements.
