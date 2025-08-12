# Production Database Setup Guide

This guide covers setting up a production Supabase database for the Cafe Reservation System with proper security, backup, and performance configurations.

## Prerequisites

- Supabase account
- Production project created
- Admin access to Supabase dashboard

## 1. Production Project Setup

### Create Production Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Choose your organization
4. Set project name: `cafe-reservation-prod`
5. Set database password (use a strong password)
6. Choose region closest to your users
7. Click "Create new project"

### Project Configuration

1. **Settings → General**

   - Set project name and description
   - Note the project URL and API keys

2. **Settings → API**
   - Copy the following keys:
     - Project URL
     - Anon (public) key
     - Service role key (keep this secret)

## 2. Database Schema Migration

### Run Production Migrations

1. **Connect to production database**

   ```bash
   # Set production environment variables
   export SUPABASE_URL=https://your-production-project.supabase.co
   export SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
   ```

2. **Run schema setup**
   ```bash
   # Create tables and functions
   node scripts/setup-production-db.js
   ```

### Verify Schema

Check that all tables are created:

- `users`
- `cafe_tables`
- `reservations`
- `reservation_conflicts`

## 3. Security Configuration

### Row Level Security (RLS)

All tables have RLS enabled with the following policies:

#### Users Table

```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Only admins can insert/delete users
CREATE POLICY "Only admins can manage users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Cafe Tables Table

```sql
-- Anyone can view available tables
CREATE POLICY "Anyone can view tables" ON cafe_tables
  FOR SELECT USING (true);

-- Only admins can manage tables
CREATE POLICY "Only admins can manage tables" ON cafe_tables
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

#### Reservations Table

```sql
-- Users can view their own reservations
CREATE POLICY "Users can view own reservations" ON reservations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own reservations
CREATE POLICY "Users can create reservations" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reservations
CREATE POLICY "Users can update own reservations" ON reservations
  FOR UPDATE USING (auth.uid() = user_id);

-- Staff and admins can view all reservations
CREATE POLICY "Staff can view all reservations" ON reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );

-- Staff and admins can update all reservations
CREATE POLICY "Staff can update all reservations" ON reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role IN ('staff', 'admin')
    )
  );
```

### API Security

1. **Enable RLS on all tables**
2. **Set up proper CORS in Supabase**
3. **Configure API rate limiting**
4. **Enable audit logging**

## 4. Backup Configuration

### Automated Backups

1. **Go to Settings → Database**
2. **Enable Point-in-Time Recovery (PITR)**

   - This provides continuous backup
   - Allows recovery to any point in time
   - Retention: 7 days (recommended)

3. **Configure Backup Schedule**
   - Daily backups at 2:00 AM UTC
   - Weekly backups on Sundays
   - Monthly backups on the 1st

### Manual Backups

Create a backup script:

```bash
#!/bin/bash
# backup-production-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cafe_reservation_backup_${DATE}.sql"

echo "Creating backup: ${BACKUP_FILE}"

# Export schema and data
pg_dump \
  --host=your-production-project.supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  --schema=public \
  --data-only \
  --file="${BACKUP_FILE}"

echo "Backup completed: ${BACKUP_FILE}"
```

## 5. Performance Optimization

### Database Indexes

Create performance indexes:

```sql
-- Users table indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Reservations table indexes
CREATE INDEX idx_reservations_user_id ON reservations(user_id);
CREATE INDEX idx_reservations_table_id ON reservations(table_id);
CREATE INDEX idx_reservations_date ON reservations(reservation_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_date_time ON reservations(reservation_date, start_time, end_time);

-- Cafe tables indexes
CREATE INDEX idx_cafe_tables_status ON cafe_tables(status);
CREATE INDEX idx_cafe_tables_capacity ON cafe_tables(capacity);
```

### Connection Pooling

1. **Enable connection pooling in Supabase**
2. **Set pool size**: 10-20 connections
3. **Configure connection timeout**: 30 seconds

### Query Optimization

1. **Monitor slow queries**
2. **Use prepared statements**
3. **Implement query caching where appropriate**

## 6. Monitoring and Alerting

### Database Monitoring

1. **Enable Supabase Analytics**
2. **Set up query performance monitoring**
3. **Monitor connection usage**
4. **Track storage usage**

### Alerting Rules

Set up alerts for:

- High CPU usage (>80%)
- High memory usage (>80%)
- Slow queries (>5 seconds)
- Connection pool exhaustion
- Storage approaching limits

## 7. Data Retention and Archiving

### Retention Policies

```sql
-- Archive old reservations (older than 1 year)
CREATE OR REPLACE FUNCTION archive_old_reservations()
RETURNS void AS $$
BEGIN
  INSERT INTO reservations_archive
  SELECT * FROM reservations
  WHERE reservation_date < CURRENT_DATE - INTERVAL '1 year';

  DELETE FROM reservations
  WHERE reservation_date < CURRENT_DATE - INTERVAL '1 year';
END;
$$ LANGUAGE plpgsql;

-- Schedule archiving (run monthly)
SELECT cron.schedule(
  'archive-old-reservations',
  '0 2 1 * *', -- First day of month at 2 AM
  'SELECT archive_old_reservations();'
);
```

## 8. Environment Variables

Set these in your production environment:

```bash
# Production Database
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Database Configuration
DB_CONNECTION_POOL_SIZE=10
DB_CONNECTION_TIMEOUT=30000
DB_QUERY_TIMEOUT=30000
```

## 9. Testing Production Database

### Health Checks

```bash
# Test database connection
curl -X GET "https://your-production-project.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key"

# Test authentication
curl -X POST "https://your-production-project.supabase.co/auth/v1/signup" \
  -H "apikey: your-anon-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
```

### Load Testing

Use tools like Artillery or k6 to test:

- Concurrent user connections
- Reservation creation performance
- Real-time subscription handling

## 10. Disaster Recovery

### Recovery Procedures

1. **Database Corruption**

   - Use PITR to restore to last known good state
   - Verify data integrity
   - Update application if needed

2. **Accidental Data Deletion**

   - Restore from backup
   - Identify and fix the root cause
   - Implement safeguards

3. **Performance Issues**
   - Analyze slow queries
   - Optimize indexes
   - Scale resources if needed

### Recovery Testing

1. **Test backup restoration monthly**
2. **Verify PITR functionality**
3. **Document recovery procedures**
4. **Train team on recovery processes**

## 11. Security Checklist

- [ ] RLS enabled on all tables
- [ ] Proper policies configured
- [ ] Service role key secured
- [ ] API rate limiting enabled
- [ ] Audit logging enabled
- [ ] Regular security updates
- [ ] Access monitoring enabled
- [ ] Backup encryption enabled
- [ ] SSL/TLS enforced
- [ ] Database firewall configured

## 12. Maintenance Schedule

### Daily

- Monitor performance metrics
- Check error logs
- Verify backup completion

### Weekly

- Review slow queries
- Analyze usage patterns
- Update security patches

### Monthly

- Test backup restoration
- Review and optimize indexes
- Update retention policies
- Security audit

### Quarterly

- Performance review
- Capacity planning
- Disaster recovery testing
- Security assessment

## Support

For database issues:

1. Check Supabase documentation
2. Review application logs
3. Monitor Supabase dashboard
4. Contact Supabase support if needed
