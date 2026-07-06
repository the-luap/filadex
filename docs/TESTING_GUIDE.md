# Testing Guide - Post Cleanup

This guide helps verify that all cleanup and refactoring changes work correctly.

## Prerequisites

1. Ensure PostgreSQL is running
2. Copy `.env.example` to `.env` and configure `DATABASE_URL`
3. Install dependencies: `npm install`

## Testing Steps

### 1. Type Checking ✅
```bash
npm run check
```
**Expected**: No TypeScript errors

### 2. Development Server ✅
```bash
npm run dev
```
**Expected**: 
- Server starts on port 5000
- No console errors
- Application accessible at http://localhost:5000

### 3. Database Initialization ✅
```bash
npm run db:init
```
**Expected**:
- Database tables created (if needed)
- Initial data inserted (if INIT_SAMPLE_DATA=true)
- Lock file created

### 4. Production Build ✅
```bash
npm run build
```
**Expected**:
- Frontend builds successfully
- Backend builds successfully
- `dist/` directory created with compiled files

### 5. API Endpoint Testing

Test each endpoint group:

#### Authentication Endpoints
- [ ] `POST /api/auth/login` - Login with credentials
- [ ] `POST /api/auth/logout` - Logout
- [ ] `GET /api/auth/me` - Get current user
- [ ] `POST /api/auth/change-password` - Change password

#### User Management Endpoints
- [ ] `POST /api/users/language` - Update language preference
- [ ] `GET /api/users` - List users (admin only)
- [ ] `POST /api/users` - Create user (admin only)
- [ ] `PUT /api/users/:id` - Update user (admin only)
- [ ] `DELETE /api/users/:id` - Delete user (admin only)
- [ ] `GET /api/user-sharing` - Get sharing settings
- [ ] `POST /api/user-sharing` - Update sharing settings

#### Filament Endpoints
- [ ] `GET /api/filaments` - List filaments
- [ ] `GET /api/filaments?export=csv` - Export CSV
- [ ] `GET /api/filaments?export=json` - Export JSON
- [ ] `GET /api/filaments/:id` - Get single filament
- [ ] `POST /api/filaments` - Create filament
- [ ] `POST /api/filaments?import=csv` - Import CSV
- [ ] `POST /api/filaments?import=json` - Import JSON
- [ ] `PATCH /api/filaments/:id` - Update filament
- [ ] `DELETE /api/filaments/:id` - Delete filament

#### Batch Operations
- [ ] `DELETE /api/filaments/batch` - Batch delete
- [ ] `PATCH /api/filaments/batch` - Batch update

#### Settings Endpoints
- [ ] `GET /api/manufacturers` - List manufacturers
- [ ] `POST /api/manufacturers` - Create manufacturer
- [ ] `DELETE /api/manufacturers/:id` - Delete manufacturer
- [ ] `PATCH /api/manufacturers/:id/order` - Update order
- [ ] Similar tests for materials, colors, diameters, storage-locations

#### Statistics Endpoint
- [ ] `GET /api/statistics` - Get statistics

#### Theme Endpoint
- [ ] `GET /api/theme` - Get theme
- [ ] `POST /api/theme` - Update theme

#### Public/Sharing Endpoints
- [ ] `GET /api/public/filaments/:userId` - Get public filaments
- [ ] `GET /api/sharing` - Get sharing settings
- [ ] `POST /api/sharing` - Update sharing settings

### 6. Docker Testing (Optional)

```bash
# Build Docker image
docker build -t filadex .

# Run container
docker run -p 8080:8080 filadex

# Or use docker-compose
docker-compose up
```

**Expected**:
- Docker image builds successfully
- Container starts without errors
- Application accessible
- Database migrations run successfully

### 7. Migration Testing

Test that migrations work:
```bash
# Run migration script
npx tsx run-migration.ts
```

**Expected**:
- Migration runs successfully
- No errors
- Database schema updated correctly

## Common Issues & Solutions

### Issue: TypeScript compilation errors
**Solution**: Run `npm install` to ensure all dependencies are installed

### Issue: Database connection errors
**Solution**: Check `DATABASE_URL` in `.env` file

### Issue: Port already in use
**Solution**: Change port in `.env` or kill process using port 5000

### Issue: Migration errors
**Solution**: Ensure database is accessible and user has proper permissions

## Success Criteria

✅ All TypeScript files compile without errors
✅ Development server starts successfully
✅ Production build completes successfully
✅ All API endpoints respond correctly
✅ Database operations work (CRUD)
✅ CSV import/export works
✅ Batch operations work
✅ Docker build succeeds (if applicable)

## Notes

- All routes should work exactly as before cleanup
- No breaking changes should be introduced
- Backward compatibility is maintained
- Type safety is improved throughout

