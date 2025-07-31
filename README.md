# TaxReturnPro - Australian Tax Management Platform

A comprehensive financial management and tax preparation platform built specifically for Australian users, featuring bank integration, AI-powered insights, and ATO compliance.

## 🚀 Features

### Core Functionality
- **Dashboard**: Real-time financial overview with key metrics
- **Bank Integration**: Connect multiple Australian bank accounts via BASIQ API
- **Transaction Management**: Automatic categorization and tracking
- **Goal Setting**: Set and track financial objectives
- **Tax Profile**: Manage ABN, TFN, and business information
- **Receipt Processing**: AI-powered receipt scanning and categorization

### Australian Compliance
- **ATO Integration**: Compliant with Australian tax regulations
- **ABN/TFN Validation**: Built-in validation for Australian tax numbers
- **GST Management**: Track GST registration and calculations
- **Financial Year Support**: Australian financial year (July-June)
- **State-specific Features**: Support for all Australian states and territories

### Security & Privacy
- **NextAuth Authentication**: Secure user authentication
- **Data Encryption**: Sensitive data protection
- **Audit Logging**: Comprehensive activity tracking
- **Rate Limiting**: API protection and abuse prevention

## 🛠️ Technology Stack

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **Headless UI**: Accessible UI components
- **React Hot Toast**: User notifications

### Backend
- **Next.js API Routes**: Serverless API endpoints
- **Prisma ORM**: Database management
- **PostgreSQL**: Primary database
- **NextAuth**: Authentication system
- **bcryptjs**: Password hashing

### External Services
- **BASIQ API**: Australian bank data aggregation
- **OpenAI API**: AI-powered insights and processing
- **DigitalOcean**: Cloud hosting and database

## 📋 Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- BASIQ API credentials
- OpenAI API key (optional, for AI features)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/TaaxDog/TAAXDOG-CODING.git
cd TAAXDOG-CODING
npm install
```

### 2. Environment Setup
Copy `.env.example` to `.env.local` and update with your credentials:
```bash
cp .env.example .env.local
```

Key environment variables:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/taaxdog_db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
BASIQ_API_KEY="your-basiq-api-key"
OPENAI_API_KEY="your-openai-api-key"
```

### 3. Database Setup
Run the automated database setup:
```bash
npm run setup
```

Or manually:
```bash
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema to database
npm run db:seed        # Seed demo data
```

### 4. Start Development
```bash
npm run dev
```

Visit http://localhost:3000

## 📂 Project Structure

```
TAAXDOG-CODING/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── (auth)/          # Authenticated pages
│   │   ├── api/             # API routes
│   │   └── layout.tsx       # Root layout
│   ├── components/          # Reusable components
│   │   ├── ui/              # UI components
│   │   └── forms/           # Form components
│   └── styles/              # Global styles
├── lib/                     # Utility functions and services
│   ├── auth.ts              # Authentication utilities
│   ├── basiq/               # BASIQ integration
│   ├── ai/                  # AI service integration
│   └── utils.ts             # Helper functions
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Database seeding
├── scripts/                 # Utility scripts
│   ├── setup-database.sh    # Database setup
│   └── deploy.sh            # Deployment script
└── tests/                   # Test files
```

## 🧪 Testing

Run tests:
```bash
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

Example test files are provided in:
- `src/components/__tests__/` - Component tests
- `src/app/api/__tests__/` - API tests

## 📊 Demo Account

After seeding, use these credentials:
- **Email**: demo@taxreturnpro.com.au
- **Password**: demo123

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/signin` - User login
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signout` - User logout

### Financial Data
- `GET /api/dashboard` - Dashboard overview
- `GET /api/banking/accounts` - List bank accounts
- `GET /api/goals` - Get financial goals
- `GET /api/financial/net-income` - Income summary
- `GET /api/financial/total-expenses` - Expense summary

### User Management
- `GET /api/tax/profile` - Get tax profile
- `PUT /api/tax/profile` - Update tax profile
- `GET /api/user/settings` - Get user settings
- `PUT /api/user/settings` - Update user settings

## 🚀 Deployment

### DigitalOcean App Platform
```bash
npm run deploy
```

### Manual Production Build
```bash
npm run build
npm start
```

## 🔒 Security Considerations

- All sensitive data is encrypted
- API endpoints require authentication
- Rate limiting on all endpoints
- CSRF protection enabled
- SQL injection prevention via Prisma
- XSS protection with React

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with Next.js and Tailwind CSS
- Banking integration powered by BASIQ
- AI features powered by OpenAI
- Hosted on DigitalOcean

## 📞 Support

For support, email support@taxreturnpro.com.au or create an issue in the repository.

---

Made with ❤️ for Australian taxpayers