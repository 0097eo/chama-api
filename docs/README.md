# Chama API

A robust and feature-rich backend service for a modern Chama (micro-savings group) management platform. This API provides a comprehensive suite of tools for managing members, contributions, loans, meetings, and financial transactions, with a strong focus on security, auditing, and integration with Kenyan financial services like M-Pesa.

## Features

-   **JWT Authentication:** Secure user registration and login using JSON Web Tokens and bcrypt for password hashing.
-   **Chama Management:** Full CRUD operations for creating and managing chamas, including member invitations and role-based access control (`ADMIN`, `TREASURER`, `SECRETARY`, `MEMBER`).
-   **Financial Tracking:**
    -   **Contributions:** Detailed tracking of member contributions with support for late payment penalties.
    -   **Loans:** A complete loan lifecycle management system, including eligibility checks, approval workflows, disbursement, repayment schedules, and restructuring.
-   **M-Pesa Integration:** Seamlessly handle payments and disbursements using the Safaricom Daraja API.
    -   **STK Push:** for easy member contribution payments.
    -   **B2C:** for disbursing loans directly to members' M-Pesa accounts.
    -   **Callback Handling:** Robust webhooks for processing payment confirmations.
-   **Meeting Management:**
    -   Schedule meetings with agendas and locations.
    -   Track attendance (with support for QR code generation).
    -   Store meeting minutes.
    -   Generate iCalendar (`.ics`) files for easy calendar integration.
-   **File Management:** Securely upload, store, and manage documents (like constitutions, receipts) using Cloudinary.
-   **Reporting & Analytics:** A suite of endpoints for generating financial summaries, contribution reports, loan portfolio analyses, and cash flow statements.
-   **Notification System:** A multi-channel notification system for in-app alerts, with service-level integration for sending SMS (via Africa's Talking) and email (via Nodemailer).
-   **Comprehensive Auditing:** A detailed audit trail that logs all critical create, update, and delete operations across the application, including user IP and device information.

## Tech Stack

-   **Backend:** Node.js, Express.js, TypeScript
-   **Database:** PostgreSQL
-   **ORM:** Prisma
-   **Authentication:** JSON Web Tokens (JWT), bcrypt
-   **File Storage:** Cloudinary
-   **Payment Gateway:** M-Pesa Daraja API
-   **SMS Gateway:** Africa's Talking
-   **Email:** Nodemailer
-   **Validation:** `express-validator`
-   **Containerization:** Docker & Docker Compose for local development

## Getting Started

Follow these instructions to get the project up and running on your local machine for development and testing.

### Prerequisites

-   Node.js (v16 or higher recommended)
-   npm or yarn
-   Docker and Docker Compose
-   A code editor (e.g., VS Code)
-   Postman for API testing

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd chama-api
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up environment variables:**
    Copy the example environment file and fill in your credentials.
    ```bash
    cp .env.example .env
    ```
    Now, open the `.env` file and add your credentials for the database, JWT, Cloudinary, M-Pesa, Africa's Talking, and SMTP.

4.  **Start the database:**
    This command will start a PostgreSQL database in a Docker container.
    ```bash
    docker-compose up -d
    ```

5.  **Run database migrations:**
    This command will create all the necessary tables in your database based on the Prisma schema.
    ```bash
    npx prisma migrate dev
    ```

6.  **Start the development server:**
    ```bash
    npm run dev
    ```
    The server will start on the port specified in your `.env` file (defaults to `3000`) and will automatically restart on file changes.

## Environment Configuration

The `.env` file is crucial for the application to run. Here are the key variables you need to configure:

-   `DATABASE_URL`: The connection string for your PostgreSQL database. The default value should work with the provided `docker-compose.yml`.
-   `PORT`: The port your API server will run on.
-   `CORS_ORIGINS`: The allowed origins
-   `JWT_SECRET`, `JWT_EXPIRES_IN` & `JWT_REFRESH_SECRET`: Long, random, secret strings for signing tokens.
-   `CLOUDINARY_*`: Your credentials from your Cloudinary account.
-   `APP_PUBLIC_URL`: Your public-facing URL from a tunneling service like ngrok or localtunnel (e.g., `https://random.ngrok-free.app`). Required for M-Pesa callbacks.
-   `MPESA_*`: Your M-Pesa Daraja Sandbox credentials.
-   `AT_*`: Your Africa's Talking Sandbox credentials (`AT_USERNAME` is usually `sandbox`).
-   `EMAIL_*`: Your SMTP credentials for sending emails.

## Running the Application

-   **Development Mode:**
    ```bash
    npm run dev
    ```

-   **Production Build:**
    ```bash
    # 1. Compile TypeScript to JavaScript
    npm run build

    # 2. Start the production server
    npm start
    ```

## API Documentation

For detailed information on all available endpoints, request/response examples, and error codes, please refer to the complete API documentation:

[**View Full API Documentation](./docs/api.md)**

### Base URL

-   **Development:** `http://localhost:3000`

### Authorization

All protected endpoints (except for public webhooks like `/api/payments/callback`) require an `Authorization` header with a Bearer token:
`Authorization: Bearer <your_jwt_access_token>`

## Project Structure

The project follows a standard feature-based architecture to keep the code organized and maintainable.
    ```
    /
    ├── docs/               # Project documentation files
    ├── prisma/             # Prisma schema and migration files
    └── src/
        ├── config/         # Configuration files (e.g., Cloudinary)
        ├── controllers/    # Express controllers (handle req/res)
        ├── middleware/     # Custom middleware (auth, permissions, validation)
        ├── routes/         # API route definitions
        ├── services/       # Core business logic
        ├── types/          # Custom TypeScript type definitions
        ├── utils/          # Utility functions (JWT, error handling)
        └── validators/     # Reusable validation rules for express-validator
    ```


## License

This project is licensed under the MIT License. See the `LICENSE` file for details.