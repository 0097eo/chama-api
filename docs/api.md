# Chama API Documentation

This document provides a comprehensive overview of the REST API for the Chama Management platform. It describes all available endpoints, their functionalities, request parameters, and expected responses.

## Authentication

All endpoints, except those for user registration and login, require authentication. Authentication is performed using a Bearer token.

### `POST /api/auth/register`

*   **Description:** Registers a new user.
*   **Method:** `POST`
*   **Request Body (JSON):**

    ```json
    {
        "email": "user@example.com",
        "phone": "2547XXXXXXXX", // Kenyan phone number (e.g., 0712345678 or 254712345678)
        "firstName": "John",
        "lastName": "Doe",
        "idNumber": "12345678", // Unique ID number
        "password": "password123"
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "User registered successfully",
        "data": {
            "id": "user-id",
            "email": "user@example.com",
            "phone": "2547XXXXXXXX",
            "firstName": "John",
            "lastName": "Doe",
            "idNumber": "12345678",
            "role": "USER",
            "createdAt": "2024-08-05T10:00:00.000Z",
            "updatedAt": "2024-08-05T10:00:00.000Z"
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the input is invalid (e.g., invalid email, missing fields).
    *   `409 Conflict`: If a user with the email/phone/idNumber already exists.

### `POST /api/auth/login`

*   **Description:** Logs in an existing user and returns an access token.
*   **Method:** `POST`
*   **Request Body (JSON):**

    ```json
    {
        "email": "user@example.com",
        "password": "password123"
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Login successful",
        "data": {
            "accessToken": "your.jwt.token.here",
            "refreshToken": "your.refresh.token.here",
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: Invalid credentials.

### `GET /api/auth/profile`

*   **Description:** Retrieves the current user's profile information.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "id": "user-id",
            "email": "user@example.com",
            "phone": "2547XXXXXXXX",
            "firstName": "John",
            "lastName": "Doe",
            "idNumber": "12345678",
            "role": "USER",
            "createdAt": "2024-08-05T10:00:00.000Z",
            "updatedAt": "2024-08-05T10:00:00.000Z"
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.

### `PUT /api/auth/profile`

*   **Description:** Updates the current user's profile information.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON, Optional Fields):**

    ```json
    {
        "firstName": "Updated",
        "lastName": "Name",
        "phone": "254711223344"
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Profile updated successfully",
        "data": {
            // ... (the updated user profile)
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the provided phone number is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `404 Not Found`: If the user doesn't exist.

## Chama Management

### `POST /api/chamas`

*   **Description:** Creates a new Chama. Requires the Admin role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (form-data):**

    ```
    name: string (Required, must be unique)
    description: string (Optional)
    monthlyContribution: number (Required, positive number)
    meetingDay: string (Required)
    constitution: file (Optional, PDF or DOC/DOCX)
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "Chama created successfully",
        "data": {
            "id": "chama-id",
            "name": "My Chama",
            "description": "A great chama",
            "registrationNumber": null,
            "totalMembers": 1,
            "monthlyContribution": 5000,
            "meetingDay": "Last Saturday",
            "constitutionUrl": "https://res.cloudinary.com/.../constitution.pdf",
            "createdAt": "2024-08-05T10:00:00.000Z"
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `409 Conflict`: If a Chama with that name already exists.
    *   `415 Unsupported Media Type`: If the constitution file has an invalid type.

### `GET /api/chamas`

*   **Description:** Retrieves all Chamas that the user is a member of.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "id": "chama-id",
                "name": "My Chama",
                "description": "A great chama",
                // ... other fields
            }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.

### `GET /api/chamas/:id`

*   **Description:** Retrieves details for a specific Chama. Any member can view this.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "id": "chama-id",
            "name": "My Chama",
            "description": "A great chama",
            // ... other fields
            "members": [
                {
                    "user": { "id": "user-id", "firstName": "John", "lastName": "Doe", "email": "john.doe@example.com" },
                    "role": "ADMIN",
                    "joinedAt": "2024-08-05T10:00:00.000Z",
                    "isActive": true
                }
            ]
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of this chama.
    *   `404 Not Found`: If the Chama is not found.

### `PUT /api/chamas/:id`

*   **Description:** Updates a Chama's information. Requires the Admin role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
*   **Request Body (JSON, Optional Fields):**

    ```json
    {
        "name": "Updated Chama Name",
        "description": "An updated description"
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Chama updated successfully",
        "data": {
            // ... (the updated chama details)
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `404 Not Found`: If the Chama is not found.

### `DELETE /api/chamas/:id`

*   **Description:** Deletes a Chama. Requires the Admin role.
*   **Method:** `DELETE`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "message": "Chama deleted successfully."
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `404 Not Found`: If the Chama is not found.

### `POST /api/chamas/:id/members`

*   **Description:** Adds a new member to a Chama. Requires the Admin role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
*   **Request Body (JSON):**

    ```json
    {
        "email": "newmember@example.com"
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "User newmember@example.com successfully added to the chama.",
        "data": {
           "id": "membership-id", // The ID of the new membership
           "role": "MEMBER",
           "joinedAt": "2024-08-05T10:00:00.000Z",
           "isActive": true,
           "userId": "user-id", // ID of the user who was added
           "chamaId": "chama-id"
         }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `404 Not Found`: If the Chama is not found.
    *   `409 Conflict`: If the user is already a member of the chama.

### `DELETE /api/chamas/:id/members/:memberId`

*   **Description:** Removes a member from a Chama. Requires the Admin role.
*   **Method:** `DELETE`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
    *   `memberId`: The ID of the Membership record to remove.
*   **Response (200 OK):**

    ```json
    {
        "message": "Member removed successfully."
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `404 Not Found`: If the Membership record is not found.

### `PUT /api/chamas/:id/members/:memberId/role`

*   **Description:** Updates a member's role in a Chama. Requires the Admin role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
    *   `memberId`: The ID of the Membership record to update.
*   **Request Body (JSON):**

    ```json
    {
        "role": "TREASURER" // ADMIN, TREASURER, SECRETARY, MEMBER
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Member's role updated successfully.",
        "data": {
            // ... (the updated membership)
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin.
    *   `404 Not Found`: If the Membership record is not found.
    *   `400 Bad Request`:  If the role value is invalid.

### `GET /api/chamas/:id/dashboard`

*   **Description:** Gets chama dashboard data. Any member can view this.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "totalContributionsThisYear": 12000,
            "activeLoansCount": 2,
            "totalLoanAmountActive": 35000,
            "totalMembers": 5,
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member.
    *   `404 Not Found`: If the Chama is not found.

## Contribution Management

### `POST /api/contributions`

*   **Description:** Records a new contribution. Any member can record their own.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON):**

    ```json
    {
        "membershipId": "membership-id", // The membership ID for the member making the payment
        "amount": 5000,
        "month": 7,
        "year": 2025,
        "paymentMethod": "M-PESA", // "M-PESA", "Bank", "Cash"
        "mpesaCode": "ABC123XYZ",  // Optional: The M-Pesa transaction code
        "paidAt": "2025-07-10T10:00:00.000Z" // YYYY-MM-DDTHH:mm:ss.sssZ (Required)
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "Contribution recorded successfully.",
        "data": {
           "id": "contribution-id",
           "amount": 5000,
           "month": 7,
           "year": 2025,
           "paymentMethod": "M-PESA",
           "mpesaCode": "ABC123XYZ",
           "paidAt": "2025-07-10T10:00:00.000Z",
           "status": "PAID",
           "membershipId": "membership-id",
           "penaltyApplied": 0
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not the owner of the membership.
    *   `409 Conflict`: If a contribution for that membership, month, and year already exists.

### `GET /api/contributions/chama/:chamaId`

*   **Description:** Gets all contributions for a specific Chama. Any member can view this.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
    *   `page`: (Optional) Page number for pagination. Defaults to 1.
    *   `limit`: (Optional) Number of items per page. Defaults to 10.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "contributions": [
                {
                    "id": "contribution-id",
                    "amount": 5000,
                    "month": 7,
                    "year": 2025,
                    "paymentMethod": "M-PESA",
                    "mpesaCode": "ABC123XYZ",
                    "paidAt": "2025-07-10T10:00:00.000Z",
                    "status": "PAID",
                    "membershipId": "membership-id",
                    "penaltyApplied": 0,
                    "membership": { // Include member information
                         "user": {
                            "firstName": "John",
                            "lastName": "Doe",
                         }
                    }
                }
            ],
            "totalRecords": 10,
            "totalPages": 2
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of this chama.

### `GET /api/contributions/member/:membershipId`

*   **Description:** Gets all contributions for a specific member. The member can view their own, or an admin can view any member's contributions.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `membershipId`: The ID of the Membership record to retrieve contributions for.
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "id": "contribution-id",
                "amount": 5000,
                "month": 7,
                "year": 2025,
                "paymentMethod": "M-PESA",
                "mpesaCode": "ABC123XYZ",
                "paidAt": "2025-07-10T10:00:00.000Z",
                "status": "PAID",
                "membershipId": "membership-id",
                "penaltyApplied": 0
            }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not the owner of the membership or an admin/treasurer.
    *   `404 Not Found`: If the membership is not found.

### `GET /api/contributions/summary/:chamaId`

*   **Description:** Gets a summary of contributions for a chama. Requires an Admin, Treasurer, or Secretary role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "year": 2025,
            "totalPaid": 12000,
            "totalPenalties": 500,
            "paidContributionsCount": 4,
            "totalExpected": 60000,
            "deficit": 48000
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the Chama is not found.

### `GET /api/contributions/defaulters/:chamaId`

*   **Description:** Gets a list of members with pending contribution payments. Requires an Admin, Treasurer, or Secretary role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": [
           {
             "id": "membership-id",
             "role": "MEMBER",
             "joinedAt": "2024-07-15T00:00:00.000Z",
             "isActive": true,
             "user": {
                "id": "user-id",
                "firstName": "Jane",
                "lastName": "Smith",
                "email": "jane.smith@example.com",
                "phone": "254799112233"
             }
           }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the Chama is not found.

### `POST /api/contributions/bulk-import/:chamaId`

*   **Description:** Bulk import contributions from a CSV file. Requires Admin or Treasurer role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Request Body (form-data):**
    *   `contributionsFile`: The CSV file containing contribution data. The CSV file must have the headers `email`, `amount`, `month`, `year`, `paymentMethod`, `paidAt`.
*   **Response (201 Created):**

    ```json
    {
        "message": "Bulk import processed.",
        "data": {
            "createdCount": 2,
            "totalRecords": 2
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the input is invalid (missing file, invalid CSV format).
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `415 Unsupported Media Type`: If the uploaded file is not a CSV.

### `GET /api/contributions/export/:chamaId`

*   **Description:** Exports all contributions for a chama to a CSV file. Requires Admin, Treasurer, or Secretary role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```
    Content-Type: text/csv
    Content-Disposition: attachment; filename=contributions-chamaId-2024-08-05T10:00:00.000Z.csv
    // The CSV file content is streamed as the response body.
    ```
    *   Example:
        ```csv
        Member Name,Amount,Penalty,Month,Year,Payment Method,Date Paid
        John Doe,5000,0,7,2025,M-PESA,7/10/2025
        Jane Smith,5000,250,7,2025,M-PESA,7/15/2025
        ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the Chama is not found.

---

## Loan Management

### `POST /api/loans`

*   **Description:** Applies for a new loan. Any active member can apply.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON):**

    ```json
    {
        "membershipId": "membership-id",  // The applicant's membership ID
        "amount": 10000,
        "duration": 6, // in months
        "purpose": "To start a small business.",
        "interestRate": 0.1 // Annual rate (e.g., 10% = 0.1)
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "Loan application submitted successfully.",
        "data": {
          "id": "loan-id",
          "amount": 10000,
          "interestRate": 0.1,
          "duration": 6,
          "purpose": "To start a small business.",
          "status": "PENDING",
          "appliedAt": "2024-08-05T10:00:00.000Z",
          "approvedAt": null,
          "disbursedAt": null,
          "dueDate": null,
          "repaymentAmount": null,
          "monthlyInstallment": null,
          "isRestructured": false,
          "restructureNotes": null,
          "membershipId": "membership-id"
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`:  If the input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`:  If the user is not authorized to apply for this loan,
    *   `400 Bad Request`:  If the loan amount is too high (based on eligibility).

### `GET /api/loans/chama/:chamaId`

*   **Description:** Gets all loans for a specific chama. Requires Admin, Treasurer, or Secretary role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "id": "loan-id",
                "amount": 10000,
                "interestRate": 0.1,
                // ... other loan details
            }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the Chama is not found.

### `GET /api/loans/member/:membershipId`

*   **Description:** Gets all loans for a specific member. The member can view their own, or an admin can view any.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `membershipId`: The ID of the member.
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "id": "loan-id",
                "amount": 10000,
                "interestRate": 0.1,
                // ... other loan details
            }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not the owner of the membership, or they are not an admin or treasurer.
    *   `404 Not Found`: If the membership is not found.

### `GET /api/loans/defaulters/:chamaId`

*   **Description:** Gets a list of loan defaulters for a chama. Requires an Admin or Treasurer role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "id": "membership-id",
                // ... member info (firstName, lastName, etc.)
            }
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the Chama is not found.

### `GET /api/loans/:id/schedule`

*   **Description:** Gets the repayment schedule for a loan. The loan owner, or an admin/treasurer can see it.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the loan.
*   **Response (200 OK):**

    ```json
    {
        "data": [
            {
                "installment": 1,
                "dueDate": "2024-09-05",
                "payment": 2166.67,
                "balance": 19500.00
            },
            // ... other installments
        ]
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not the owner of the loan, or they are not an admin/treasurer.
    *   `404 Not Found`: If the loan is not found.

### `POST /api/loans/:id/payments`

*   **Description:** Records a loan payment. Requires the Treasurer role, and they can only record a payment for a loan they're a part of.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the loan.
*   **Request Body (JSON):**

    ```json
    {
        "amount": 2166.67,  // The payment amount
        "paymentMethod": "M-PESA", // or "Bank", "Cash"
        "mpesaCode": "ABC123XYZ" // Optional: M-Pesa transaction code
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "Payment recorded successfully."
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If the input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not the owner of the loan or a treasurer.
    *   `404 Not Found`: If the loan is not found.

### `PUT /api/loans/:id/approve`

*   **Description:** Approves or rejects a loan. Requires the Admin or Treasurer role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the loan.
*   **Request Body (JSON):**

    ```json
    {
        "status": "APPROVED" // or "REJECTED"
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Loan status updated successfully.",
        "data": {
            // ... (the updated loan details)
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`:  If the status is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin or Treasurer.
    *   `404 Not Found`: If the loan is not found.

### `PUT /api/loans/:id/disburse`

*   **Description:** Disburses an approved loan. Requires the Treasurer role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the loan.
*   **Response (200 OK):**

    ```json
    {
        "message": "Loan disbursed successfully.",
        "data": {
            // ... (the updated loan details)
        }
    }
    ```

*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a Treasurer.
    *   `404 Not Found`: If the loan is not found.

### `PUT /api/loans/:id/restructure`

*   **Description:** Restructures the terms of an existing loan, such as changing the duration or interest rate. Requires the Admin or Treasurer role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the loan to restructure.
*   **Request Body (JSON, Optional Fields):**

    ```json
    {
        "newInterestRate": 0.15,
        "newDuration": 8,
        "notes": "Member requested an extension. Terms adjusted as per agreement."
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Loan restructured successfully.",
        "data": {
            // ... (the updated loan details with new repaymentAmount, monthlyInstallment, etc.)
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If input is invalid (e.g., missing notes).
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not an Admin or Treasurer.
    *   `404 Not Found`: If the loan is not found.

---

## Meeting Management

### `POST /api/meetings`

*   **Description:** Schedules a new meeting. Requires Admin or Secretary role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON):**

    ```json
    {
        "chamaId": "chama-id",
        "title": "September Planning Session",
        "agenda": "Discuss Q4 budget and social event.",
        "location": "Online via Zoom",
        "scheduledFor": "2025-09-15T18:00:00.000Z"
    }
    ```

*   **Response (201 Created):**

    ```json
    {
        "message": "Meeting scheduled successfully.",
        "data": {
            "id": "meeting-id",
            "title": "September Planning Session",
            "status": "SCHEDULED",
            // ... other meeting details
        }
    }
    ```

*   **Error Responses:**
    *   `400 Bad Request`: If input is invalid.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.

### `GET /api/meetings/chama/:chamaId`

*   **Description:** Gets a list of all meetings for a chama. Any member can view this.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):** An array of meeting objects.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of the specified chama.

### `GET /api/meetings/upcoming/:chamaId`

*   **Description:** Gets a list of upcoming (status: SCHEDULED) meetings for a chama.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):** An array of upcoming meeting objects.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of the specified chama.

### `GET /api/meetings/:id`

*   **Description:** Gets the details for a single meeting.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (200 OK):** The full meeting object.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of the chama this meeting belongs to.
    *   `404 Not Found`: If the meeting with the specified ID does not exist.

### `PUT /api/meetings/:id`

*   **Description:** Updates the details of a meeting. Requires Admin or Secretary role.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Request Body (JSON, Optional Fields):**

    ```json
    {
        "location": "Room 202, City Library",
        "agenda": "Updated agenda items."
    }
    ```

*   **Response (200 OK):** The updated meeting object.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the meeting is not found.

### `DELETE /api/meetings/:id`

*   **Description:** Cancels a meeting (sets status to CANCELLED). Requires Admin or Secretary role.
*   **Method:** `DELETE`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (200 OK):**

    ```json
    {
        "message": "Meeting has been cancelled."
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the meeting is not found.

### `POST /api/meetings/:id/attendance`

*   **Description:** Marks the authenticated user as present for a specific meeting. Can only be done once per member per meeting.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (201 Created):**

    ```json
    {
        "message": "Attendance marked successfully.",
        "data": {
            "id": "attendance-record-id",
            "attendedAt": "2025-08-31T14:05:10.000Z",
            "meetingId": "meeting-id",
            "membershipId": "membership-id"
        }
    }
    ```

*   **Error Responses:**
    *   `403 Forbidden`: If the user is not a member of the chama this meeting belongs to.
    *   `404 Not Found`: If the meeting does not exist.
    *   `409 Conflict`: If attendance has already been marked for this member.

### `GET /api/meetings/:id/attendance`

*   **Description:** Gets the list of all members who attended a specific meeting.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (200 OK):** An array of attendance records, including member details.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of the chama this meeting belongs to.
    *   `404 Not Found`: If the meeting is not found.

### `POST /api/meetings/:id/minutes`

*   **Description:** Saves the minutes for a completed meeting. Requires Admin or Secretary role. This action automatically changes the meeting's status to `COMPLETED`.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Request Body (JSON):**

    ```json
    {
        "minutes": "Key decisions:\n1. Loan for Jane Doe was approved.\n2. Next social event is on Dec 15th."
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Meeting minutes saved successfully."
    }
    ```
*   **Error Responses:**
    *   `400 Bad Request`: If the `minutes` field is missing or empty.
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the meeting is not found.

### `GET /api/meetings/:id/qr-code`

*   **Description:** Generates a QR code image (as a data URL) that contains the meeting ID. Intended for easy, in-person attendance marking with a mobile app. Requires Admin or Secretary role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
        }
    }
    ```
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user does not have the required permissions.
    *   `404 Not Found`: If the meeting is not found.

### `GET /api/meetings/:id/calendar`

*   **Description:** Downloads a standard iCalendar (`.ics`) file for the specified meeting, which can be imported into most calendar applications (Google, Outlook, Apple).
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the meeting.
*   **Response (200 OK):**
    *   **Content-Type:** `text/calendar`
    *   **Content-Disposition:** `attachment; filename=meeting-meeting-id.ics`
    *   The response body is the raw `.ics` file content.
*   **Error Responses:**
    *   `401 Unauthorized`: If the access token is invalid or missing.
    *   `403 Forbidden`: If the user is not a member of the chama this meeting belongs to.
    *   `404 Not Found`: If the meeting is not found.

---


## M-Pesa Integration (`/api/payments`)

### `POST /api/payments/stk-push`

*   **Description:** Initiates an M-Pesa STK Push payment request to a user's phone for a specific contribution.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON):**

    ```json
    {
        "amount": 1,
        "phone": "254708374149",
        "contributionId": "contribution-id"
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "STK Push initiated successfully. Please check your phone.",
        "data": {
            "MerchantRequestID": "...",
            "CheckoutRequestID": "ws_CO_...",
            "ResponseCode": "0",
            "ResponseDescription": "Success. Request accepted for processing",
            "CustomerMessage": "Success. Request accepted for processing"
        }
    }
    ```

*   **Error Responses:**
    *   `403 Forbidden`: If the user is trying to pay for a contribution that is not theirs.
    *   `500 Internal Server Error`: If there is a failure communicating with the Daraja API. The response body will contain the error from Safaricom.

### `POST /api/payments/callback`

*   **Description:** **Webhook endpoint.** This is the public URL that the M-Pesa server calls to notify our application of the outcome of an STK Push transaction. It should not be called directly by a client.
*   **Method:** `POST`
*   **Authorization:** None.
*   **Request Body (JSON):** Sent by Safaricom.
*   **Response (200 OK):** The server responds immediately with `{"ResultCode": 0, "ResultDesc": "Accepted"}` and processes the payment asynchronously.

### `GET /api/payments/status/:checkoutRequestId`

*   **Description:** Queries the status of a previously initiated STK Push transaction.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `checkoutRequestId`: The `CheckoutRequestID` received from the `/stk-push` endpoint.
*   **Response (200 OK):** The transaction status object from the Daraja API.

### `POST /api/payments/b2c`

*   **Description:** Initiates a Business-to-Customer (B2C) payment to disburse a loan to a member. Requires Treasurer role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON):**

    ```json
    {
        "loanId": "loan-id",
        "amount": 1,
        "phone": "254708374149",
        "remarks": "Loan disbursement"
    }
    ```

*   **Response (200 OK):** The initial acceptance response from the Daraja API. The final result is sent to the B2C callback URL.

### `GET /api/payments/transactions/:chamaId`

*   **Description:** Retrieves a list of all transactions processed via M-Pesa for a specific chama (both contributions and loan disbursements). Requires Admin or Treasurer role.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):**

    ```json
    {
        "data": {
            "contributions": [ /* ...list of paid contributions... */ ],
            "loanDisbursements": [ /* ...list of disbursed loans... */ ]
        }
    }
    ```

---

## File Management (`/api/files`)

### `POST /api/files/upload/:chamaId`

*   **Description:** Uploads a file (e.g., receipt, document) and associates it with a chama. Any member can upload.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the chama to associate the file with.
*   **Request Body (form-data):**
    *   `category`: `string` (Optional, e.g., "receipts", "member_ids"). Defaults to "general".
    *   `file`: `file` (The file to be uploaded).
*   **Response (201 Created):** A JSON object representing the new file record in the database.

### `GET /api/files/chama/:chamaId`

*   **Description:** Retrieves a list of all file metadata for a specific chama.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):** An array of file record objects.

### `GET /api/files/:id`

*   **Description:** Retrieves the metadata for a single file.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the file record.
*   **Response (200 OK):** A single file record object.

### `DELETE /api/files/:id`

*   **Description:** Deletes a file from both Cloudinary and the database. Requires Admin or Secretary role in the chama.
*   **Method:** `DELETE`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the file record to delete.
*   **Response (200 OK):**

    ```json
    {
        "message": "File deleted successfully."
    }
    ```

---

## Notification System (`/api/notifications`)

### `GET /api/notifications`

*   **Description:** Gets the most recent notifications for the authenticated user.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **Response (200 OK):** An array of notification objects.

### `PUT /api/notifications/:id/read`

*   **Description:** Marks a specific notification as read. A user can only mark their own notifications.
*   **Method:** `PUT`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `id`: The ID of the notification.
*   **Response (200 OK):** The updated notification object with `read: true`.

### `POST /api/notifications/broadcast/:chamaId`

*   **Description:** Sends a notification (in-app and optionally SMS) to all active members of a chama. Requires Admin or Secretary role.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Request Body (JSON):**

    ```json
    {
        "title": "Important Announcement",
        "message": "The annual general meeting has been postponed."
    }
    ```

*   **Response (200 OK):**

    ```json
    {
        "message": "Broadcast sent successfully."
    }
    ```

---

## Audit & Logging (`/api/audit`)

**Note:** All endpoints in this section require an application-level `ADMIN` role.

### `GET /api/audit/chama/:chamaId`

*   **Description:** Gets a paginated list of all audit logs for a specific chama.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `chamaId`: The ID of the Chama.
*   **Response (200 OK):** A paginated list of audit log objects.

### `GET /api/audit/user/:userId`

*   **Description:** Gets a paginated list of all actions performed by a specific user.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **URL Parameters:**
    *   `userId`: The ID of the user (the "actor").
*   **Response (200 OK):** A paginated list of audit log objects.

### `GET /api/audit/search`

*   **Description:** Provides a flexible search for audit logs.
*   **Method:** `GET`
*   **Authorization:** `Bearer <access_token>`
*   **Query Parameters (Optional):**
    *   `action`: Comma-separated list of `AuditAction` enums (e.g., `CHAMA_UPDATE,CHAMA_MEMBER_ADD`).
    *   `userId`: Filter by the actor's user ID.
    *   `targetId`: Filter by the target's user ID.
    *   `startDate` / `endDate`: Filter by a date range (e.g., `2025-08-01`).
*   **Response (200 OK):** A paginated list of matching audit log objects.

### `POST /api/audit/export`

*   **Description:** Exports a filtered list of audit logs to a CSV file.
*   **Method:** `POST`
*   **Authorization:** `Bearer <access_token>`
*   **Request Body (JSON, Optional Fields):**

    ```json
    {
        "chamaId": "chama-id",
        "action": ["CHAMA_MEMBER_ADD", "CHAMA_MEMBER_REMOVE"],
        "startDate": "2025-01-01"
    }
    ```

*   **Response (200 OK):**
    *   **Content-Type:** `text/csv`
    *   The response body is the raw CSV file content.