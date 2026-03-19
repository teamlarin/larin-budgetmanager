

## Auto-create project Drive folder on quote approval

### Overview
When a quote is approved and a project is created, automatically create a subfolder in the client's Google Drive folder with a specific naming convention.

### Folder naming convention
Format: `{year}_{quote_number} - {client_name} - {project_name}`

Example: `2026_042/2026 - Adico - Gestione e manutenzione sito web`

The year is extracted from the project's `start_date`. If no start date exists, the current year is used.

### Changes

**File: `src/components/QuoteStatusSelector.tsx`**

After the project is created from the budget (around line 137, after `finalProjectId = newProject.id`):

1. Fetch the quote's `quote_number` (already available from the quote record being updated)
2. Fetch the client's `drive_folder_id` and `name` from the `clients` table using `budgetData.client_id`
3. Build the folder name: extract year from `budgetData.start_date` (or current year), combine with quote number, client name, and project name
4. If the client has a `drive_folder_id`, call the existing `google-drive-folders` edge function with:
   - `action: "create-folder"`
   - `folderName`: the formatted name
   - `parentFolderId`: the client's `drive_folder_id`
5. On success, update the project record's `drive_folder_id` and `drive_folder_name` with the newly created folder
6. On failure, log a warning and show a toast — do not block the approval flow

### Additional data needed
- The `quote_number` must be passed as a prop to `QuoteStatusSelector` or fetched from the `quotes` table during the approval flow (it's already being updated by ID, so we can select it)
- The client name needs to be fetched alongside the `drive_folder_id`

### No database or edge function changes required
The existing `google-drive-folders` edge function already supports the `create-folder` action with `folderName` and `parentFolderId` parameters.

