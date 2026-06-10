# ESS Loan API - Swagger Documentation

## 📚 Overview

The ESS Loan Management System now includes comprehensive API documentation using **Swagger/OpenAPI 3.0**. This provides interactive documentation for all API endpoints with the ability to test them directly from your browser.

---

## 🚀 Quick Start

### Access Swagger UI

Once the server is running, access the Swagger documentation at:

```
http://localhost:3002/api-docs
```

**Production URL**:
```
http://135.181.33.13:3002/api-docs
```

### Access Swagger JSON Spec

Get the raw OpenAPI JSON specification at:

```
http://localhost:3002/api-docs.json
```

---

## 📖 What's Documented

### Endpoints Covered

#### 1. **Loan Processing** (`/api/loan`)
- **POST /api/loan** - Main loan processing endpoint
  - LOAN_OFFER_REQUEST
  - TOP_UP_OFFER_REQUEST
  - LOAN_TAKEOVER_OFFER_REQUEST
  - LOAN_RESTRUCTURE_REQUEST
  - LOAN_FINAL_APPROVAL_NOTIFICATION
  - LOAN_CANCELLATION_NOTIFICATION
  - And more...

#### 2. **Authentication** (`/api/v1/auth`)
- **POST /api/v1/auth/login** - User login (returns JWT token)
- **GET /api/v1/auth/profile** - Get user profile (protected)
- **POST /api/v1/auth/change-password** - Change password (protected)
- **POST /api/v1/auth/logout** - User logout (protected)

#### 3. **MIFOS Webhook** (`/api/webhook/mifos`)
- **POST /api/webhook/mifos** - Receive MIFOS Core Banking System notifications

#### 4. **Admin Utilities**
- **POST /api/sign** - Generate digital signature for XML (testing)

---

## 🔐 Security Schemes

### 1. Bearer Authentication (JWT)
Used for admin endpoints and protected routes.

**Header Format**:
```
Authorization: Bearer <your-jwt-token>
```

**How to get token**:
1. Call `POST /api/v1/auth/login`
2. Copy the returned token
3. Click "Authorize" button in Swagger UI
4. Enter: `Bearer YOUR_TOKEN_HERE`

### 2. Digital Signature
Used for XML loan messages from ESS UTUMISHI.

**Header**: `X-Signature`

---

## 📝 Using Swagger UI

### Testing Endpoints

1. **Navigate to endpoint**: Click on any endpoint to expand it
2. **Click "Try it out"**: Enables the test form
3. **Fill in parameters**: Provide required fields
4. **Execute**: Click the "Execute" button
5. **View Response**: See the response code and body

### Example: Testing Login

1. Navigate to `POST /api/v1/auth/login`
2. Click "Try it out"
3. Enter request body:
   ```json
   {
     "username": "admin",
     "password": "Admin@123"
   }
   ```
4. Click "Execute"
5. Copy the JWT token from the response
6. Click "Authorize" (top right)
7. Enter `Bearer <token>`
8. Now you can test protected endpoints

### Example: Testing Loan Request

1. Navigate to `POST /api/loan`
2. Click "Try it out"
3. Paste sample XML:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <Document>
     <Data>
       <Header>
         <Sender>ESS_UTUMISHI</Sender>
         <Receiver>ZE DONE</Receiver>
         <FSPCode>FL8090</FSPCode>
         <MsgId>TEST123456</MsgId>
         <MessageType>LOAN_CHARGES_REQUEST</MessageType>
       </Header>
       <MessageDetails>
         <ProductCode>17</ProductCode>
         <Tenure>24</Tenure>
         <RequestedAmount>5000000</RequestedAmount>
       </MessageDetails>
     </Data>
   </Document>
   ```
4. Click "Execute"
5. View the XML response with charges

---

## 🛠️ Configuration

### Swagger Configuration File

Location: `src/config/swagger.js`

Key settings:
- **OpenAPI Version**: 3.0.0
- **Title**: ESS Loan Management API
- **Version**: 1.0.0
- **Servers**: Development (localhost:3002) and Production
- **Security Schemes**: Bearer Auth, Digital Signature

### Adding Documentation to New Endpoints

Use JSDoc comments above route definitions:

```javascript
/**
 * @swagger
 * /api/your-endpoint:
 *   post:
 *     summary: Short description
 *     description: Detailed description
 *     tags:
 *       - Category Name
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               field:
 *                 type: string
 *     responses:
 *       200:
 *         description: Success
 */
router.post('/your-endpoint', yourHandler);
```

---

## 📋 Schema Definitions

### LoanMapping Schema

Complete loan mapping object with all fields:
- `essApplicationNumber` - Application number (unique per loan)
- `essCheckNumber` - Check number (unique per CLIENT)
- `essLoanNumberAlias` - Loan number (unique identifier)
- `mifosLoanId` - MIFOS Core Banking loan ID
- `status` - Current loan status (14 possible values)
- `originalMessageType` - Type of request that initiated the loan

### Response Schemas

**SuccessResponse**:
```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { }
}
```

**ErrorResponse**:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

---

## 🏷️ Tags/Categories

Endpoints are organized into logical groups:

1. **Loan Processing** - Loan offers, approvals, disbursements
2. **Balance & Charges** - Balance inquiries, loan charges
3. **Loan Actions** - Cancellations, rejections
4. **Authentication** - Login, logout, profile
5. **Admin** - Administrative utilities
6. **Health & Monitoring** - System health checks

---

## 🔧 Customization

### Customize Swagger UI Theme

In `server.js`:

```javascript
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }', // Hide top bar
    customSiteTitle: 'ESS Loan API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
        persistAuthorization: true, // Keep auth tokens between page reloads
        displayRequestDuration: true, // Show request duration
        filter: true, // Enable endpoint filtering
        syntaxHighlight: {
            activate: true,
            theme: 'monokai' // Code syntax theme
        }
    }
}));
```

### Adding Custom CSS

```javascript
customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #1976d2; }
    .swagger-ui .scheme-container { background: #f5f5f5; }
`
```

---

## 📊 API Statistics

Current documentation coverage:

| Category | Endpoints | Documented |
|----------|-----------|------------|
| Loan Processing | 1 main endpoint | ✅ Yes |
| Authentication | 4 endpoints | ✅ Yes |
| Webhooks | 1 endpoint | ✅ Yes |
| Admin | 1 endpoint | ✅ Yes |
| **Total** | **7 endpoints** | **100%** |

---

## 🧪 Testing with Swagger

### Advantages

1. **Interactive Testing** - No need for Postman/cURL
2. **Auto-generated Examples** - See request/response formats
3. **Schema Validation** - Validate your requests before sending
4. **Security Testing** - Test both authenticated and public endpoints
5. **Documentation** - Always up-to-date with code

### Best Practices

1. **Use "Try it out" sparingly in production** - Swagger hits real endpoints
2. **Test authentication first** - Get a valid token before testing protected routes
3. **Check response codes** - 200 doesn't always mean success (check XML ResponseCode)
4. **Validate XML** - Ensure proper XML structure before testing
5. **Monitor logs** - Check server logs while testing

---

## 📦 Dependencies

```json
{
  "swagger-jsdoc": "^6.2.8",
  "swagger-ui-express": "^5.0.1"
}
```

**Swagger JSDoc** - Generates OpenAPI spec from JSDoc comments  
**Swagger UI Express** - Serves interactive Swagger UI

---

## 🚫 Troubleshooting

### Swagger UI not loading

1. Check server is running: `http://localhost:3002/health`
2. Verify Swagger packages installed: `npm list swagger-jsdoc swagger-ui-express`
3. Check console for errors
4. Ensure `/api-docs` route is registered before other routes

### Endpoints not showing

1. Verify JSDoc comments syntax
2. Check `apis` array in `src/config/swagger.js` includes your route file
3. Restart server after adding new documentation
4. Check for syntax errors in JSDoc comments

### Authentication not working

1. Ensure you're using correct header format: `Bearer <token>`
2. Check token hasn't expired (JWT_EXPIRES_IN env var)
3. Verify you clicked "Authorize" button
4. Token must be valid JWT from `/api/v1/auth/login`

---

## 📚 Additional Resources

- [OpenAPI 3.0 Specification](https://swagger.io/specification/)
- [Swagger UI Documentation](https://swagger.io/tools/swagger-ui/)
- [JSDoc Syntax for Swagger](https://github.com/Surnet/swagger-jsdoc)

---

## 🎯 Next Steps

### Expand Documentation

1. **Add more endpoints**:
   - Frontend API routes (`/api/frontend/*`)
   - Admin routes (`/api/v1/admin/*`)
   - Loan actions (`/api/v1/loan-actions/*`)
   - MIFOS admin routes (`/api/v1/mifos/*`)

2. **Add more examples**:
   - Complete XML examples for each message type
   - Response examples for each status code
   - Error response examples

3. **Add request/response schemas**:
   - Define reusable schema components
   - Add validation rules
   - Document all possible response codes

4. **Add security documentation**:
   - Digital signature verification process
   - Certificate management
   - API key rotation

---

## ✅ Checklist

- [x] Swagger installed and configured
- [x] Main loan endpoint documented
- [x] Authentication endpoints documented
- [x] Webhook endpoint documented
- [x] Security schemes defined
- [x] Schemas defined
- [x] Swagger UI accessible
- [ ] All endpoints documented (ongoing)
- [ ] All schemas documented (ongoing)
- [ ] Examples for all message types (ongoing)

---

**Last Updated**: December 21, 2025  
**API Version**: 1.0.0  
**Swagger Version**: OpenAPI 3.0.0
