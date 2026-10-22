# Instagram-level Profile System Migration Troubleshooting Guide

## Problem: Database Connectivity Issues with Neon PostgreSQL

The migration script hangs at "Testing database connection..." when trying to connect to the Neon PostgreSQL instance.

### Root Cause Analysis
1. **Neon PostgreSQL instance may be paused or inactive**
2. **Network/firewall blocking the connection**
3. **Incorrect connection string parameters**
4. **SSL/TLS configuration issues**
5. **IP address not whitelisted in Neon security settings**

## Solution Options

### Option 1: Manual SQL Migration (RECOMMENDED)
Since automated migration is failing, use the manual SQL approach:

**Steps:**
1. **Get your Neon connection string:**
   - Go to [Neon Console](https://console.neon.tech)
   - Select your project
   - Click "Connect" → "Connection string"
   - Copy the PostgreSQL connection string

2. **Connect using one of these methods:**

   **A. Using psql (command line):**
   ```bash
   psql "postgresql://neondb_owner:npg_MhIiCaHs3L9g@ep-twilight-feather-ahenzckl-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
   ```

   **B. Using pgAdmin or another GUI tool:**
   - Use the connection details from your .env file
   - Host: `ep-twilight-feather-ahenzckl-pooler.c-3.us-east-1.aws.neon.tech`
   - Port: `5432` (default)
   - Database: `neondb`
   - Username: `neondb_owner`
   - Password: `npg_MhIiCaHs3L9g`
   - SSL: `require`

3. **Run the SQL migration file:**
   ```sql
   \i backend/database/migrate_privacy_columns.sql
   ```
   Or copy-paste the SQL commands from the file.

### Option 2: Use Neon Console SQL Editor
1. Go to [Neon Console](https://console.neon.tech)
2. Select your project
3. Click "SQL Editor"
4. Copy and run the SQL from `backend/database/migrate_privacy_columns.sql`

### Option 3: Recreate Database with Updated Schema
If you can't connect but can recreate the database:

1. **Update `createTables.js`** - Already done! The script now includes the privacy columns.
2. **Run database creation:**
   ```bash
   cd backend
   npm run create
   ```
   ⚠️ **WARNING**: This will DROP ALL EXISTING TABLES and recreate them.

### Option 4: Test Connection with Simple Script
Run this to diagnose connection issues:
```bash
cd backend
node scratch/simple_test.js
```

## Verification Steps

After migration, verify the columns exist:

**SQL Verification:**
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='posts' 
AND column_name IN (
    'hide_respect_count', 
    'hide_share_count', 
    'comments_enabled', 
    'reuse_enabled', 
    'content_type'
);
```

**Expected Result:** Should return 5 rows, one for each column.

## Common Neon PostgreSQL Issues

### 1. Instance is Paused
Neon automatically pauses instances after inactivity. Check if your instance is active in the Neon Console.

### 2. Connection Pooler Issues
The connection string uses a pooler endpoint (`...-pooler.c-3.us-east-1.aws.neon.tech`). Try:
- Removing `?sslmode=require&uselibpqcompat=true` temporarily
- Using direct connection (get from Neon Console → Connection Details)

### 3. SSL Certificate Issues
Try adding this to your Pool configuration:
```javascript
ssl: { 
  rejectUnauthorized: false,
  ca: fs.readFileSync('path/to/neon-cert.pem').toString()
}
```

### 4. Firewall/Network Issues
- Check if your IP is allowed in Neon IP allowlist
- Try connecting from a different network
- Use Neon's "Test Connection" feature in the console

## Fallback Solution: Update Application Logic

If database migration is impossible, you can modify the application to handle missing columns gracefully:

1. **Modify privacy API endpoint** to check for column existence
2. **Add fallback logic** when columns don't exist
3. **Log warnings** instead of throwing errors

However, this is a temporary workaround and the columns should be added for full functionality.

## Success Criteria
- [ ] All 5 privacy columns exist in posts table
- [ ] `content_type` column exists with default 'photo'
- [ ] Migration is idempotent (can run multiple times)
- [ ] Rollback script created (`rollback_phase12_7.js`)
- [ ] Privacy API returns 200 OK instead of 404

## Next Steps After Migration
1. Test the privacy API: `PUT /api/posts/:id/privacy`
2. Verify profile grid shows correct content
3. Check that deleted posts are properly filtered
4. Test engagement synchronization

## Support
If issues persist:
1. Check Neon documentation: https://neon.tech/docs
2. Review Neon status: https://status.neon.tech
3. Contact Neon support through console
4. Check application logs for detailed error messages