# Cafe Table Web Reservation System

A modern web application for managing cafe table reservations with real-time availability, user authentication, and administrative dashboard.

## 🚀 Features

- **Real-time Reservation System**: Live table availability and booking confirmation
- **User Authentication**: Role-based access (Customer/Staff/Admin) with Supabase Auth
- **Responsive Design**: Mobile-first approach with TailwindCSS
- **Admin Dashboard**: Staff management interface for reservations and table configuration
- **Security**: JWT authentication, input validation, rate limiting, and HTTPS enforcement
- **Modern Stack**: Astro frontend, Node.js/Express backend, Supabase database

## 🛠️ Tech Stack

### Frontend
- **Framework**: Astro with TypeScript
- **Styling**: TailwindCSS
- **Authentication**: Supabase Auth
- **Deployment**: Netlify

### Backend
- **Runtime**: Node.js with Express
- **Database**: Supabase (PostgreSQL)
- **Real-time**: WebSocket integration
- **Deployment**: Render

### Infrastructure
- **Database**: Supabase
- **Authentication**: Supabase Auth
- **Hosting**: Netlify (Frontend) + Render (Backend)
- **CI/CD**: Git-based deployment

## 📁 Project Structure

```
cafe-reservation-system/
├── frontend/                 # Astro application
│   ├── src/
│   ├── public/
│   └── package.json
├── backend/                  # Node.js/Express API
│   ├── src/
│   ├── routes/
│   └── package.json
├── scripts/                  # Project scripts
│   └── prd.txt              # Product Requirements Document
├── .taskmaster/             # Task Master configuration
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- Node.js v20.19.0+
- Git
- Supabase account
- Netlify account
- Render account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd cafe-reservation-system
   ```

2. **Install dependencies**
   ```bash
   # Frontend
   cd frontend
   npm install
   
   # Backend
   cd ../backend
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Copy environment templates
   cp .env.example .env
   # Configure your environment variables
   ```

4. **Start development servers**
   ```bash
   # Frontend (Astro)
   cd frontend
   npm run dev
   
   # Backend (Express)
   cd ../backend
   npm run dev
   ```

## 🔧 Development

### Frontend Development
```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Backend Development
```bash
cd backend
npm run dev          # Start development server
npm run test         # Run tests
npm run build        # Build for production
```

## 🚀 Deployment

### Frontend (Netlify)
- Connected to Git repository
- Automatic deployment on push to main branch
- Build command: `npm run build`
- Publish directory: `dist`

### Backend (Render)
- Web service connected to Git repository
- Auto-deploy from main branch
- Build command: `npm install && npm run build`
- Start command: `npm start`

## 🔐 Environment Variables

### Frontend (.env)
```env
PUBLIC_SUPABASE_URL=your_supabase_url
PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
PUBLIC_API_URL=your_backend_api_url
```

### Backend (.env)
```env
PORT=3000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
JWT_SECRET=your_jwt_secret
NODE_ENV=production
```

## 📋 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Reservations
- `GET /api/reservations` - Get all reservations
- `POST /api/reservations` - Create new reservation
- `PUT /api/reservations/:id` - Update reservation
- `DELETE /api/reservations/:id` - Cancel reservation

### Tables
- `GET /api/tables` - Get all tables
- `POST /api/tables` - Add new table
- `PUT /api/tables/:id` - Update table configuration

## 🧪 Testing

```bash
# Frontend tests
cd frontend
npm run test

# Backend tests
cd backend
npm run test

# End-to-end tests
npm run test:e2e
```

## 📊 Monitoring

- **Health Checks**: `/api/health`
- **Status Page**: Available at deployment URL
- **Logs**: Available in Netlify and Render dashboards

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support, email support@cafe-reservation.com or create an issue in the repository.

---

**Built with ❤️ using Astro, Node.js, and Supabase** 