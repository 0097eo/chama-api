import { Express, Request, Response } from "express";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { version } from "../../package.json";
import logger from "../config/logger";

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Chama API",
      version,
      description: "API documentation for Chama application",
      contact: {
        name: "API Support",
        email: "emmanuelokello294@gmail.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Development server",
      },
    //   {
    //     url: "https://api.chama.com/api",
    //     description: "Production server",
    //   },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token in the format: Bearer <token>",
        },
      },
      responses: {
        UnauthorizedError: {
          description: "Access token is missing or invalid",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Unauthorized",
                  },
                  message: {
                    type: "string",
                    example: "Invalid or missing authentication token",
                  },
                },
              },
            },
          },
        },
        NotFoundError: {
          description: "Resource not found",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Not Found",
                  },
                  message: {
                    type: "string",
                    example: "The requested resource was not found",
                  },
                },
              },
            },
          },
        },
        ValidationError: {
          description: "Validation error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  error: {
                    type: "string",
                    example: "Validation Error",
                  },
                  message: {
                    type: "string",
                    example: "Invalid input data",
                  },
                  details: {
                    type: "array",
                    items: {
                      type: "object",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
    tags: [
        {
            name: "Authentication",
            description: "User authentication endpoints including login, registration, and password management",
        },
        {
            name: "Users",
            description: "User profile management and account settings endpoints",
        },
        {
            name: "Chamas",
            description: "Chama group management including creation, updates, member management, and dashboard",
        },
        {
            name: "Contributions",
            description: "Member contribution tracking, payment recording, and contribution history management",
        },
        {
            name: "Loans",
            description: "Loan application, approval, disbursement, repayment tracking, and loan management",
        },
        {
            name: "Meetings",
            description: "Meeting scheduling, attendance tracking, minutes recording, and meeting management",
        },
        {
            name: "M-Pesa Payments",
            description: "M-Pesa payment integration for STK push, payment callbacks, and transaction verification",
        },
        {
            name: "Notifications",
            description: "User notification management including SMS, email, and in-app notifications",
        },
        {
            name: "Reports",
            description: "Financial reports, contribution summaries, loan reports, and analytics generation",
        },
        {
            name: "Audit",
            description: "Audit trail and activity logs for tracking system changes and user actions",
        },
        {
            name: "Files",
            description: "Document upload, storage, and retrieval including constitutions and meeting minutes",
        },
    ]
  },
  apis: ["./src/routes/*.ts", "./src/models/*.ts", "./src/controllers/*.ts"],
};

const swaggerSpec = swaggerJSDoc(options);

/**
 * Initialize Swagger documentation for the Express app
 * @param app - Express application instance
 * @param port - Port number the server is running on
 */
function swaggerDocs(app: Express, port: number): void {
  // Swagger UI options
  const swaggerUiOptions = {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Chama API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
    },
  };

  // Serve Swagger UI
  app.use(
    "/api/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, swaggerUiOptions)
  );

  // Serve Swagger JSON specification
  app.get("/api/docs.json", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  logger.info(`Swagger docs available at http://localhost:${port}/api/docs`);
  logger.info(`Swagger JSON available at http://localhost:${port}/api/docs.json`);
}

export default swaggerDocs;