# Backend Deployment Guide

This guide covers deploying the Cafe Reservation System backend to Render.

## Prerequisites

- GitHub repository with the backend code
- Render account
- Supabase project (production)

## Deployment Steps

### 1. Prepare Environment Variables

Create a `.env.production` file in the backend directory with the following variables:

```bash
# Server Configuration
NODE_ENV=production
PORT=10000

# CORS Configuration
CORS_ORIGIN=https://your-frontend-domain.netlify.app

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production-2024
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production-2024

# Supabase Configuration
SUPABASE_URL=https://your-production-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
SUPABASE_ANON_KEY=your-production-anon-key

# Rate Limiting Configuration
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_AUTH=5
RATE_LIMIT_MAX_RESERVATIONS=20
RATE_LIMIT_MAX_GENERAL=100
```

### 2. Deploy to Render

#### Option A: Using render.yaml (Recommended)

1. Push your code to GitHub
2. In Render dashboard, click "New" → "Blueprint"
3. Connect your GitHub repository
4. Render will automatically detect the `render.yaml` file and configure the service

#### Option B: Manual Configuration

1. In Render dashboard, click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `cafe-reservation-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`

### 3. Environment Variables in Render

Set the following environment variables in Render dashboard:

- `NODE_ENV`: `production`
- `PORT`: `10000`
- `CORS_ORIGIN`: Your frontend URL
- `JWT_SECRET`: Generate a secure random string
- `JWT_REFRESH_SECRET`: Generate a secure random string
- `SUPABASE_URL`: Your production Supabase URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your production service role key
- `SUPABASE_ANON_KEY`: Your production anon key

### 4. Health Checks

The backend includes two health check endpoints:

- `/health` - Simple health check for Render
- `/api/health` - Detailed health check with service status

### 5. Monitoring

The backend includes comprehensive monitoring:

- **Security Logging**: All security events are logged
- **Rate Limiting**: Configurable rate limits for different endpoints
- **Error Tracking**: Detailed error logging and monitoring
- **Performance Monitoring**: Request duration tracking

### 6. Security Features

- JWT-based authentication with refresh tokens
- Rate limiting on all endpoints
- Input validation and sanitization
- CORS protection
- Security headers (Helmet)
- Token blacklisting for secure logout

### 7. Testing the Deployment

After deployment, test the following endpoints:

```bash
# Health check
curl https://your-api.onrender.com/health

# Detailed health check
curl https://your-api.onrender.com/api/health

# API info
curl https://your-api.onrender.com/api
```

### 8. Troubleshooting

#### Common Issues

1. **Health Check Fails**: Ensure the `/health` endpoint returns 200 status
2. **CORS Errors**: Verify `CORS_ORIGIN` is set correctly
3. **Database Connection**: Check Supabase credentials
4. **Rate Limiting**: Monitor rate limit headers in responses

#### Logs

Check Render logs for:

- Application errors
- Security events
- Performance issues
- Database connection problems

### 9. Production Checklist

- [ ] Environment variables configured
- [ ] CORS origin set to frontend domain
- [ ] JWT secrets are secure and unique
- [ ] Supabase production project configured
- [ ] Health checks passing
- [ ] All endpoints responding correctly
- [ ] Security monitoring enabled
- [ ] Rate limiting configured
- [ ] SSL certificate active
- [ ] Custom domain configured (optional)

## Support

For issues with the deployment, check:

1. Render documentation
2. Application logs in Render dashboard
3. Supabase dashboard for database issues
4. Security logs in the application
