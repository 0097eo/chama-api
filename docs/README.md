# Chama API

[![CI](https://github.com/0097eo/chama-api/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/chama-api/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-316192)](https://www.postgresql.org/)

A robust backend service for modern Chama (micro-savings group) management. Built for Kenyan financial services with M-Pesa integration, comprehensive auditing, and enterprise-grade security.

📚 [**Documentation**](./docs/api.md) | 🚀 [**Quickstart**](#getting-started) | 🔧 [**API Reference**](./docs/api.md)

---

## Features

### Security & Authentication
- JWT-based authentication with refresh tokens
- Role-based access control (ADMIN, TREASURER, SECRETARY, MEMBER)
- bcrypt password hashing
- Comprehensive audit trails with IP and device tracking

### Financial Management
- **Contributions:** Track member payments with automated late penalties
- **Loans:** Complete lifecycle management including eligibility checks, approval workflows, disbursement, and repayment schedules
- **Reporting:** Financial summaries, contribution reports, loan portfolio analysis, and cash flow statements

### 📱 M-Pesa Integration
- STK Push for member contributions
- B2C disbursements for loan payments
- Automated callback handling for payment confirmations
- Powered by Safaricom Daraja API

### Meeting Management
- Schedule meetings with agendas and locations
- QR code-based attendance tracking
- Meeting minutes storage
- iCalendar (.ics) export for calendar apps

### Multi-Channel Notifications
- In-app alerts
- SMS via Africa's Talking
- Email via Nodemailer

### Document Management
- Secure file upload and storage via Cloudinary
- Support for constitutions, receipts, and meeting documents

---

## Getting Started

### Prerequisites

- Node.js 16+ 
- Docker & Docker Compose
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repository-url>
cd chama-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start PostgreSQL with Docker
docker-compose up -d

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000`

---

## Configuration

Create a `.env` file with the following variables:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/chama_db"

# Server
PORT=3000
CORS_ORIGINS="http://localhost:3000"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="1d"
JWT_REFRESH_SECRET="your-refresh-secret"

# Cloudinary
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# M-Pesa Daraja
APP_PUBLIC_URL="https://your-ngrok-url.ngrok-free.app"
MPESA_CONSUMER_KEY="your-consumer-key"
MPESA_CONSUMER_SECRET="your-consumer-secret"
MPESA_SHORTCODE="your-shortcode"
MPESA_PASSKEY="your-passkey"

# Africa's Talking
AT_USERNAME="sandbox"
AT_API_KEY="your-api-key"

# Email (SMTP)
EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=587
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
```

---

## Built With

- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** JWT, bcrypt
- **File Storage:** Cloudinary
- **Payments:** M-Pesa Daraja API
- **SMS:** Africa's Talking
- **Email:** Nodemailer
- **Validation:** express-validator
- **Containerization:** Docker, Docker Compose

---

## API Documentation

All protected endpoints require an `Authorization` header:

```
Authorization: Bearer <your_jwt_access_token>
```

For complete API documentation with examples and error codes, see [API Reference](./docs/api.md).

### Base URL

- **Development:** `http://localhost:3000`
- **Production:** Your deployed URL

---

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

---

## Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

For questions or support, please open an issue or contact the maintainers.

---
