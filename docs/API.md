# Filadex API Documentation

This document provides comprehensive documentation for the Filadex API endpoints. The API allows you to manage filaments, materials, colors, manufacturers, and other resources in the Filadex application.

## Table of Contents

1. [Authentication](#authentication)
2. [Filaments](#filaments)
3. [Materials](#materials)
4. [Colors](#colors)
5. [Manufacturers](#manufacturers)
6. [Diameters](#diameters)
7. [Storage Locations](#storage-locations)
8. [Custom Fields](#custom-fields)
9. [User Management](#user-management)
10. [Notifications](#notifications)
11. [Sharing](#sharing)
12. [Community Filament Database](#community-filament-database)
13. [Printer Integration](#printer-integration)
14. [Statistics](#statistics)
15. [Theme](#theme)

## Authentication

### Login

Authenticates a user and returns a JWT token as a cookie.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "number",
    "username": "string",
    "isAdmin": "boolean"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials
  - `500 Internal Server Error`: Server error

### Logout

Logs out the current user by clearing the authentication cookie.

- **URL**: `/api/auth/logout`
- **Method**: `POST`
- **Authentication**: Required
- **Response**: `204 No Content`
- **Error Responses**:
  - `500 Internal Server Error`: Server error

### Get Current User

Returns information about the currently authenticated user.

- **URL**: `/api/auth/me`
- **Method**: `GET`
- **Authentication**: Required
- **Response**: `200 OK`
  ```json
  {
    "id": "number",
    "username": "string",
    "isAdmin": "boolean",
    "forceChangePassword": "boolean",
    "language": "string",
    "createdAt": "string",
    "lastLogin": "string"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: User not found
  - `500 Internal Server Error`: Server error

### Change Password

Changes the password for the currently authenticated user.

- **URL**: `/api/auth/change-password`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Password changed successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Incorrect current password
  - `500 Internal Server Error`: Server error

## Filaments

### Get All Filaments

Returns all filaments for the authenticated user.

- **URL**: `/api/filaments`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv' or 'json', returns the filaments in the specified format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "userId": "number",
      "name": "string",
      "manufacturer": "string",
      "material": "string",
      "colorName": "string",
      "colorCode": "string",
      "diameter": "string",
      "printTemp": "string",
      "totalWeight": "string",
      "remainingPercentage": "string",
      "purchaseDate": "string",
      "purchasePrice": "string",
      "status": "string",
      "spoolType": "string",
      "dryerCount": "number",
      "lastDryingDate": "string",
      "storageLocation": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch filaments

### Get Filament by ID

Returns a specific filament by ID.

- **URL**: `/api/filaments/:id`
- **Method**: `GET`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the filament
- **Response**: `200 OK`
  ```json
  {
    "id": "number",
    "userId": "number",
    "name": "string",
    "manufacturer": "string",
    "material": "string",
    "colorName": "string",
    "colorCode": "string",
    "diameter": "string",
    "printTemp": "string",
    "totalWeight": "string",
    "remainingPercentage": "string",
    "purchaseDate": "string",
    "purchasePrice": "string",
    "status": "string",
    "spoolType": "string",
    "dryerCount": "number",
    "lastDryingDate": "string",
    "storageLocation": "string",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid filament ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Filament not found
  - `500 Internal Server Error`: Failed to fetch filament

### Create Filament

Creates a new filament.

- **URL**: `/api/filaments`
- **Method**: `POST`
- **Authentication**: Required
- **Query Parameters**:
  - `import`: (optional) If set to 'csv' or 'json', imports filaments from the provided data
- **Request Body** (for single filament):
  ```json
  {
    "name": "string",
    "manufacturer": "string",
    "material": "string",
    "colorName": "string",
    "colorCode": "string",
    "diameter": "string",
    "printTemp": "string",
    "totalWeight": "number",
    "remainingPercentage": "number",
    "purchaseDate": "string",
    "purchasePrice": "number",
    "status": "string",
    "spoolType": "string",
    "dryerCount": "number",
    "lastDryingDate": "string",
    "storageLocation": "string",
    "customFieldValues": "object"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
- **Request Body** (for JSON import):
  ```json
  {
    "jsonData": "string"
  }
  ```
- **Response** (for single filament): `201 Created`
  ```json
  {
    "id": "number",
    "userId": "number",
    "filamentTypeId": "number",
    "name": "string",
    "manufacturer": "string",
    "material": "string",
    "colorName": "string",
    "colorCode": "string",
    "diameter": "string",
    "printTemp": "string",
    "totalWeight": "string",
    "remainingPercentage": "string",
    "purchaseDate": "string",
    "purchasePrice": "string",
    "status": "string",
    "spoolType": "string",
    "dryerCount": "number",
    "lastDryingDate": "string",
    "storageLocation": "string",
    "customFieldValues": "object",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create filament

### Update Filament

Updates an existing filament. If `remainingPercentage` is included and changes value, an entry is automatically recorded in the filament's usage log (see [Get Filament Usage Log](#get-filament-usage-log)) - pass an optional `note` describing why (e.g. what was printed).

- **URL**: `/api/filaments/:id`
- **Method**: `PATCH`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the filament
- **Request Body** (all fields optional; only included fields are updated):
  ```json
  {
    "name": "string",
    "manufacturer": "string",
    "material": "string",
    "colorName": "string",
    "colorCode": "string",
    "diameter": "string",
    "printTemp": "string",
    "totalWeight": "number",
    "remainingPercentage": "number",
    "note": "string",
    "purchaseDate": "string",
    "purchasePrice": "number",
    "status": "string",
    "spoolType": "string",
    "dryerCount": "number",
    "lastDryingDate": "string",
    "storageLocation": "string",
    "customFieldValues": "object"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "number",
    "userId": "number",
    "filamentTypeId": "number",
    "name": "string",
    "manufacturer": "string",
    "material": "string",
    "colorName": "string",
    "colorCode": "string",
    "diameter": "string",
    "printTemp": "string",
    "totalWeight": "string",
    "remainingPercentage": "string",
    "purchaseDate": "string",
    "purchasePrice": "string",
    "status": "string",
    "spoolType": "string",
    "dryerCount": "number",
    "lastDryingDate": "string",
    "storageLocation": "string",
    "customFieldValues": "object",
    "createdAt": "string",
    "updatedAt": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid filament ID or validation error
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Filament not found
  - `500 Internal Server Error`: Failed to update filament

### Delete Filament

Deletes a filament.

- **URL**: `/api/filaments/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the filament
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid filament ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Filament not found
  - `500 Internal Server Error`: Failed to delete filament

### Batch Delete Filaments

Deletes multiple filaments at once.

- **URL**: `/api/filaments/batch`
- **Method**: `DELETE`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "ids": [1, 2, 3]
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Successfully deleted 3 filaments",
    "deletedCount": 3
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid request format
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to delete filaments

### Batch Update Filaments

Updates multiple filaments at once with the same values.

- **URL**: `/api/filaments/batch`
- **Method**: `PATCH`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "ids": [1, 2, 3],
    "updates": {
      "material": "PLA",
      "status": "opened",
      "remainingPercentage": 75
    }
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Successfully updated 3 filaments",
    "updatedCount": 3
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid request format
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to update filaments

### Get Filament Usage Log

Returns the history of remaining-percentage changes for a filament, most recent first. A new entry is created automatically whenever [Update Filament](#update-filament) changes `remainingPercentage`, and whenever [Printer Usage Event](#record-printer-usage-event) or the [Moonraker-compatible endpoints](#printer-integration) report usage.

- **URL**: `/api/filaments/:id/usage-log`
- **Method**: `GET`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the filament
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "filamentId": "number",
      "userId": "number",
      "deltaWeight": "string",
      "remainingPercentageAfter": "string",
      "note": "string",
      "source": "string",
      "createdAt": "string"
    }
  ]
  ```
  - `deltaWeight` is in grams; negative values mean filament was consumed, positive values mean the spool was topped up/corrected.
  - `source` is one of `manual` (edited in the app) or `printer` (reported via the printer integration).
- **Error Responses**:
  - `400 Bad Request`: Invalid filament ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Filament not found
  - `500 Internal Server Error`: Failed to fetch filament usage log

## Materials

### Get All Materials

Returns all materials.

- **URL**: `/api/materials`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv', returns the materials in CSV format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "name": "string",
      "density": "string",
      "isHygroscopic": "boolean"
    }
  ]
  ```
  - `density` (g/cm³) is nullable and used to compute an estimated remaining filament length in the UI.
  - `isHygroscopic` drives the [drying-reminder email check](#notifications) - set it for moisture-sensitive materials (PETG, Nylon/PA, PVA, ASA, etc.).
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch materials

### Create Material

Creates a new material (admin only; non-admins should use the catalog request flow - see `POST /api/catalog-requests`).

- **URL**: `/api/materials`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Query Parameters**:
  - `import`: (optional) If set to 'csv', imports materials from the provided CSV data
- **Request Body** (for single material):
  ```json
  {
    "name": "string",
    "density": "string",
    "isHygroscopic": "boolean"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
  CSV columns: `name,density,isHygroscopic` (header row optional; `density` and `isHygroscopic` may be left blank).
- **Response** (for single material): `201 Created`
  ```json
  {
    "id": "number",
    "name": "string",
    "density": "string",
    "isHygroscopic": "boolean"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create material

### Delete Material

Deletes a material.

- **URL**: `/api/materials/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the material
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid material ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Material not found
  - `500 Internal Server Error`: Failed to delete material

## Colors

### Get All Colors

Returns all colors.

- **URL**: `/api/colors`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv', returns the colors in CSV format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "name": "string",
      "code": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch colors

### Create Color

Creates a new color.

- **URL**: `/api/colors`
- **Method**: `POST`
- **Authentication**: Required
- **Query Parameters**:
  - `import`: (optional) If set to 'csv', imports colors from the provided CSV data
- **Request Body** (for single color):
  ```json
  {
    "name": "string",
    "code": "string"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
- **Response** (for single color): `201 Created`
  ```json
  {
    "id": "number",
    "name": "string",
    "code": "string"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create color

### Delete Color

Deletes a color.

- **URL**: `/api/colors/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the color
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid color ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Color not found
  - `500 Internal Server Error`: Failed to delete color

## Manufacturers

### Get All Manufacturers

Returns all manufacturers.

- **URL**: `/api/manufacturers`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv', returns the manufacturers in CSV format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "name": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch manufacturers

### Create Manufacturer

Creates a new manufacturer.

- **URL**: `/api/manufacturers`
- **Method**: `POST`
- **Authentication**: Required
- **Query Parameters**:
  - `import`: (optional) If set to 'csv', imports manufacturers from the provided CSV data
- **Request Body** (for single manufacturer):
  ```json
  {
    "name": "string"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
- **Response** (for single manufacturer): `201 Created`
  ```json
  {
    "id": "number",
    "name": "string"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create manufacturer

### Delete Manufacturer

Deletes a manufacturer.

- **URL**: `/api/manufacturers/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the manufacturer
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid manufacturer ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Manufacturer not found
  - `500 Internal Server Error`: Failed to delete manufacturer

## Diameters

### Get All Diameters

Returns all diameters.

- **URL**: `/api/diameters`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv', returns the diameters in CSV format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "value": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch diameters

### Create Diameter

Creates a new diameter.

- **URL**: `/api/diameters`
- **Method**: `POST`
- **Authentication**: Required
- **Query Parameters**:
  - `import`: (optional) If set to 'csv', imports diameters from the provided CSV data
- **Request Body** (for single diameter):
  ```json
  {
    "value": "string"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
- **Response** (for single diameter): `201 Created`
  ```json
  {
    "id": "number",
    "value": "string"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create diameter

### Delete Diameter

Deletes a diameter.

- **URL**: `/api/diameters/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the diameter
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid diameter ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Diameter not found
  - `500 Internal Server Error`: Failed to delete diameter

## Storage Locations

### Get All Storage Locations

Returns all storage locations.

- **URL**: `/api/storage-locations`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `export`: (optional) If set to 'csv', returns the storage locations in CSV format
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "name": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch storage locations

### Create Storage Location

Creates a new storage location.

- **URL**: `/api/storage-locations`
- **Method**: `POST`
- **Authentication**: Required
- **Query Parameters**:
  - `import`: (optional) If set to 'csv', imports storage locations from the provided CSV data
- **Request Body** (for single storage location):
  ```json
  {
    "name": "string"
  }
  ```
- **Request Body** (for CSV import):
  ```json
  {
    "csvData": "string"
  }
  ```
- **Response** (for single storage location): `201 Created`
  ```json
  {
    "id": "number",
    "name": "string"
  }
  ```
- **Response** (for import): `201 Created`
  ```json
  {
    "created": "number",
    "duplicates": "number",
    "errors": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create storage location

### Delete Storage Location

Deletes a storage location.

- **URL**: `/api/storage-locations/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the storage location
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid storage location ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Storage location not found
  - `500 Internal Server Error`: Failed to delete storage location

## Custom Fields

Lets a user define their own tracked attributes for filaments (e.g. "Shelf", "Batch number") without a schema change. Definitions are per-user; values live on each filament's `customFieldValues` object, keyed by the definition's `id` (as a string).

### Get Custom Field Definitions

Returns the authenticated user's custom field definitions.

- **URL**: `/api/custom-fields`
- **Method**: `GET`
- **Authentication**: Required
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "userId": "number",
      "entityType": "filament",
      "name": "string",
      "fieldType": "text | number | boolean | date",
      "createdAt": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch custom field definitions

### Create Custom Field Definition

- **URL**: `/api/custom-fields`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "name": "string",
    "fieldType": "text | number | boolean | date"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "number",
    "userId": "number",
    "entityType": "filament",
    "name": "string",
    "fieldType": "string",
    "createdAt": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create custom field definition

### Delete Custom Field Definition

- **URL**: `/api/custom-fields/:id`
- **Method**: `DELETE`
- **Authentication**: Required
- **URL Parameters**:
  - `id`: The ID of the custom field definition
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid custom field ID
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: Custom field definition not found
  - `500 Internal Server Error`: Failed to delete custom field definition

## User Management

### Get All Users

Returns all users (admin only).

- **URL**: `/api/users`
- **Method**: `GET`
- **Authentication**: Required (Admin)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "username": "string",
      "isAdmin": "boolean",
      "forceChangePassword": "boolean",
      "language": "string",
      "createdAt": "string",
      "lastLogin": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `500 Internal Server Error`: Server error

### Create User

Creates a new user (admin only).

- **URL**: `/api/users`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Request Body**:
  ```json
  {
    "username": "string",
    "password": "string",
    "isAdmin": "boolean"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "number",
    "username": "string",
    "isAdmin": "boolean",
    "forceChangePassword": "boolean",
    "language": "string",
    "createdAt": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `409 Conflict`: Username already exists
  - `500 Internal Server Error`: Server error

### Update User

Updates an existing user (admin only).

- **URL**: `/api/users/:id`
- **Method**: `PUT`
- **Authentication**: Required (Admin)
- **URL Parameters**:
  - `id`: The ID of the user
- **Request Body**:
  ```json
  {
    "username": "string",
    "isAdmin": "boolean",
    "forceChangePassword": "boolean",
    "language": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "number",
    "username": "string",
    "isAdmin": "boolean",
    "forceChangePassword": "boolean",
    "language": "string",
    "createdAt": "string",
    "lastLogin": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `404 Not Found`: User not found
  - `409 Conflict`: Username already exists
  - `500 Internal Server Error`: Server error

### Reset User Password

Resets a user's password (admin only).

- **URL**: `/api/users/:id/reset-password`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **URL Parameters**:
  - `id`: The ID of the user
- **Request Body**:
  ```json
  {
    "password": "string"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Password reset successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `404 Not Found`: User not found
  - `500 Internal Server Error`: Server error

### Delete User

Deletes a user (admin only).

- **URL**: `/api/users/:id`
- **Method**: `DELETE`
- **Authentication**: Required (Admin)
- **URL Parameters**:
  - `id`: The ID of the user
- **Response**: `204 No Content`
- **Error Responses**:
  - `400 Bad Request`: Invalid user ID
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `404 Not Found`: User not found
  - `500 Internal Server Error`: Server error

## Notifications

Low-stock and drying-reminder email alerts. A background check runs every 6 hours, batching all qualifying spools into a single email per user per run (requires SMTP to be configured - see the admin Email settings). Preferences are per-user.

### Update Notification Preferences

- **URL**: `/api/users/notification-preferences`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body** (all fields optional; only included fields are updated):
  ```json
  {
    "lowStockThresholdPercent": "number",
    "notifyLowStock": "boolean",
    "notifyDryingReminder": "boolean",
    "dryingReminderDays": "number"
  }
  ```
  - `lowStockThresholdPercent`: 0-100, default 15. A low-stock email is sent once when a spool's `remainingPercentage` drops to or below this, and is not repeated until the spool is topped back up.
  - `dryingReminderDays`: default 30. Applies to filaments whose material is flagged `isHygroscopic` (see [Materials](#materials)); reminders are throttled to at most once/day per spool.
- **Response**: `200 OK`
  ```json
  {
    "message": "Notification preferences updated successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error (e.g. threshold out of range)
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Server error

Current preference values are included in the response of `GET /api/auth/me` (`lowStockThresholdPercent`, `notifyLowStock`, `notifyDryingReminder`, `dryingReminderDays`).

## Sharing

### Get User Sharing Settings

Returns the sharing settings for the authenticated user.

- **URL**: `/api/user-sharing`
- **Method**: `GET`
- **Authentication**: Required
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "userId": "number",
      "isPublic": "boolean",
      "materialId": "number",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Server error

### Update User Sharing Settings

Updates the sharing settings for the authenticated user.

- **URL**: `/api/sharing`
- **Method**: `POST`
- **Authentication**: Required
- **Request Body**:
  ```json
  {
    "shareAll": "boolean",
    "materials": [
      {
        "id": "number",
        "isPublic": "boolean"
      }
    ]
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "message": "Sharing preferences updated"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Server error

### Get Sharing Settings

Returns the sharing settings for the authenticated user.

- **URL**: `/api/sharing`
- **Method**: `GET`
- **Authentication**: Required
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "userId": "number",
      "isPublic": "boolean",
      "materialId": "number",
      "createdAt": "string",
      "updatedAt": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Server error

### Get Public Filaments

Returns the public filaments for a specific user, according to their sharing settings (globally public, or scoped to specific materials via `POST /api/sharing`).

- **URL**: `/api/public/filaments/:userId`
- **Method**: `GET`
- **Authentication**: None
- **URL Parameters**:
  - `userId`: The ID of the user
- **Response**: `200 OK`
  ```json
  {
    "user": {
      "id": "number",
      "username": "string"
    },
    "filaments": [
      {
        "id": "number",
        "userId": "number",
        "filamentTypeId": "number",
        "name": "string",
        "manufacturer": "string",
        "material": "string",
        "colorName": "string",
        "colorCode": "string",
        "diameter": "string",
        "printTemp": "string",
        "totalWeight": "string",
        "remainingPercentage": "string",
        "purchaseDate": "string",
        "purchasePrice": "string",
        "status": "string",
        "spoolType": "string",
        "dryerCount": "number",
        "lastDryingDate": "string",
        "storageLocation": "string",
        "customFieldValues": "object",
        "createdAt": "string",
        "updatedAt": "string"
      }
    ]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Invalid user ID
  - `404 Not Found`: User not found, or the user has no public sharing enabled
  - `500 Internal Server Error`: Server error

## Community Filament Database

A locally-cached copy of vendor filament profiles from [SpoolmanDB](https://github.com/Donkie/SpoolmanDB) (MIT licensed), used to pre-fill manufacturer/material/color/diameter when adding a new spool instead of typing them in by hand. The cache is refreshed by an admin action, not automatically (it fetches from GitHub), and search reads from the cache only.

### Search Community Filaments

- **URL**: `/api/community-filaments/search`
- **Method**: `GET`
- **Authentication**: Required
- **Query Parameters**:
  - `q`: Search term, matched against manufacturer, product name, and color name (case-insensitive substring match). Returns `[]` if omitted or empty.
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "manufacturer": "string",
      "material": "string",
      "name": "string",
      "colorName": "string",
      "colorCode": "string",
      "density": "string",
      "diameter": "string",
      "extruderTemp": "number",
      "bedTemp": "number",
      "updatedAt": "string"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to search community filaments

### Get Community Filament Cache Status

- **URL**: `/api/community-filaments/status`
- **Method**: `GET`
- **Authentication**: Required (Admin)
- **Response**: `200 OK`
  ```json
  {
    "count": "number",
    "lastUpdated": "string | null"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `500 Internal Server Error`: Failed to fetch community filament cache status

### Refresh Community Filament Cache

Fetches the latest filament profiles from SpoolmanDB and replaces the local cache. Takes several seconds (fetches ~50 vendor files).

- **URL**: `/api/community-filaments/refresh`
- **Method**: `POST`
- **Authentication**: Required (Admin)
- **Response**: `200 OK`
  ```json
  {
    "count": "number"
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `403 Forbidden`: Not an admin
  - `500 Internal Server Error`: Failed to refresh community filament cache

## Printer Integration

Lets a print server (Klipper/Moonraker, or a custom integration) report filament usage automatically instead of requiring a manual `remainingPercentage` update after every print. Authenticated separately from the browser session cookie, via a per-user **API token**.

### API Tokens

API tokens authenticate the endpoints below in place of the session cookie. Send the token as `Authorization: Bearer <token>`, `X-Api-Key: <token>`, or a `?token=<token>` query parameter (support varies by print-server client).

#### List API Tokens

- **URL**: `/api/api-tokens`
- **Method**: `GET`
- **Authentication**: Required (session cookie)
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "number",
      "userId": "number",
      "label": "string",
      "createdAt": "string",
      "lastUsedAt": "string | null"
    }
  ]
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to fetch API tokens

#### Create API Token

The plaintext `token` is only ever returned in this response - it's stored hashed and cannot be recovered afterwards. Revoke and recreate it if lost.

- **URL**: `/api/api-tokens`
- **Method**: `POST`
- **Authentication**: Required (session cookie)
- **Request Body**:
  ```json
  {
    "label": "string"
  }
  ```
- **Response**: `201 Created`
  ```json
  {
    "id": "number",
    "label": "string",
    "createdAt": "string",
    "token": "string"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to create API token

#### Revoke API Token

- **URL**: `/api/api-tokens/:id`
- **Method**: `DELETE`
- **Authentication**: Required (session cookie)
- **URL Parameters**:
  - `id`: The ID of the API token
- **Response**: `204 No Content`
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `404 Not Found`: API token not found
  - `500 Internal Server Error`: Failed to delete API token

### Record Printer Usage Event

Generic, ecosystem-agnostic ingestion endpoint - any print server can push a usage event here. Updates `remainingPercentage` and records an entry in the [filament usage log](#get-filament-usage-log) with `source: "printer"`.

- **URL**: `/api/integrations/usage`
- **Method**: `POST`
- **Authentication**: Required (API token)
- **Request Body**:
  ```json
  {
    "filamentId": "number",
    "deltaWeight": "number",
    "externalJobId": "string"
  }
  ```
  - `deltaWeight` is in grams; negative values mean filament was consumed (e.g. `-12.5` for 12.5g used).
- **Response**: `200 OK` - the updated filament (same shape as [Update Filament](#update-filament)'s response)
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `401 Unauthorized`: Missing or invalid API token
  - `404 Not Found`: Filament not found
  - `500 Internal Server Error`: Failed to record printer usage event

### Moonraker / Spoolman Compatibility

Implements the subset of [Spoolman](https://github.com/Donkie/Spoolman)'s REST API that Moonraker's `[spoolman]` config module calls, mapped onto Filadex's own filaments/usage-log tables. Point Moonraker's `server` config at this base URL with an API token, and Filadex acts as a drop-in Moonraker spoolman endpoint with no changes needed on the Klipper/Mainsail/Fluidd side. This is a best-effort compatibility layer, not a full Spoolman API implementation - only the fields Moonraker's integration actually reads/writes are covered.

All endpoints below require an API token (see [API Tokens](#api-tokens)) and are mounted under `/api/spoolman-compat/v1`.

- **`GET /v1/spool/:id`** - Returns one spool in Spoolman's shape (`id`, `registered`, `price`, `initial_weight`, `remaining_weight`, `used_weight`, `location`, `archived`, `filament: { id, name, material, price, diameter, color_hex, vendor: { name } }`).
- **`GET /v1/spool`** - Returns all of the authenticated user's spools in the same shape.
- **`PATCH /v1/spool/:id`** - Accepts `{ "remaining_weight": number }` (grams) to set the spool's remaining weight directly.
- **`PUT /v1/spool/:id/use`** and **`POST /v1/spool/:id/use`** (both accepted, for compatibility with different Moonraker versions) - Accepts `{ "use_weight": number }` (grams), deducts it from the spool and records a usage-log entry.

- **Error Responses** (all endpoints):
  - `401 Unauthorized`: Missing or invalid API token
  - `404 Not Found`: Spool not found
  - `500 Internal Server Error`: Server error

## Statistics

### Get Statistics

Returns statistics for the authenticated user's filaments.

- **URL**: `/api/statistics`
- **Method**: `GET`
- **Authentication**: Required
- **Response**: `200 OK`
  ```json
  {
    "totalSpools": "number",
    "totalWeight": "string",
    "remainingWeight": "string",
    "averageRemaining": "number",
    "lowStockCount": "number",
    "materialDistribution": [
      {
        "material": "string",
        "count": "number",
        "percentage": "number"
      }
    ],
    "topMaterials": [
      {
        "material": "string",
        "count": "number"
      }
    ],
    "topColors": [
      {
        "color": "string",
        "count": "number"
      }
    ],
    "estimatedValue": "number",
    "totalPurchaseValue": "number",
    "averageAge": "number",
    "oldestFilament": {
      "name": "string",
      "age": "number"
    },
    "newestFilament": {
      "name": "string",
      "age": "number"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Not authenticated
  - `500 Internal Server Error`: Failed to calculate statistics

## Theme

### Get Theme

Returns the current theme settings.

- **URL**: `/api/theme`
- **Method**: `GET`
- **Authentication**: None
- **Response**: `200 OK`
  ```json
  {
    "variant": "string",
    "primary": "string",
    "appearance": "string",
    "radius": "number"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Theme file not found
  - `500 Internal Server Error`: Failed to read theme

### Update Theme

Updates the theme settings.

- **URL**: `/api/theme`
- **Method**: `POST`
- **Authentication**: None
- **Request Body**:
  ```json
  {
    "variant": "string",
    "primary": "string",
    "appearance": "string",
    "radius": "number"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "variant": "string",
    "primary": "string",
    "appearance": "string",
    "radius": "number"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation error
  - `500 Internal Server Error`: Failed to update theme

## Error Responses

All API endpoints may return the following error responses:

### 400 Bad Request

Returned when the request is malformed or contains invalid data.

```json
{
  "message": "string"
}
```

### 401 Unauthorized

Returned when authentication is required but not provided or is invalid.

```json
{
  "message": "Not authenticated"
}
```

### 403 Forbidden

Returned when the authenticated user does not have permission to access the resource.

```json
{
  "message": "Access denied"
}
```

### 404 Not Found

Returned when the requested resource does not exist.

```json
{
  "message": "string"
}
```

### 409 Conflict

Returned when the request conflicts with the current state of the server.

```json
{
  "message": "string"
}
```

### 500 Internal Server Error

Returned when an unexpected error occurs on the server.

```json
{
  "message": "string"
}
```

## Authentication

Most endpoints require authentication. To authenticate, include the JWT token in a cookie named `token`. The token is obtained by calling the `/api/auth/login` endpoint.

The [Printer Integration](#printer-integration) endpoints (`/api/integrations/usage` and `/api/spoolman-compat/v1/*`) use a separate mechanism instead, since a print server can't hold a browser session cookie: a per-user **API token**, sent as `Authorization: Bearer <token>`, `X-Api-Key: <token>`, or a `?token=` query parameter. See [API Tokens](#api-tokens) for how to create one.

### Admin-Only Endpoints

Some endpoints are only accessible to users with admin privileges. These endpoints will return a `403 Forbidden` response if accessed by a non-admin user.

## Query Parameters

### Export Parameter

Many GET endpoints support an `export` query parameter that allows you to export the data in CSV or JSON format. For example:

```
GET /api/filaments?export=csv
```

### Import Parameter

Many POST endpoints support an `import` query parameter that allows you to import data from CSV or JSON. For example:

```
POST /api/filaments?import=csv
```

## Data Formats

### CSV Format

When exporting data as CSV, the first line contains the column headers, and each subsequent line contains the data for one record. Fields are separated by commas, and text fields that contain commas are enclosed in double quotes.

When importing data from CSV, the file should follow the same format. The first line may contain column headers, which will be used to map the data to the appropriate fields. If the first line does not contain headers, the data will be mapped based on the order of the columns.

### JSON Format

When exporting data as JSON, the response is a JSON array containing objects representing each record.

When importing data from JSON, the request body should contain a `jsonData` field with a JSON string representing an array of objects.

## Pagination

Currently, the API does not support pagination. All endpoints return all matching records.

## Rate Limiting

Currently, the API does not implement rate limiting.

## Versioning

The API does not currently use versioning in the URL path. Future versions may introduce versioning to maintain backward compatibility.
