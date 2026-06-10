# MiraCore_New

Backend API for ESS (Electronic Salary System) integration with MIFOS Fineract.

## Features

- **MIFOS Integration**: Comprehensive loan processing with client validation and affordability calculations
- **XML/JSON Processing**: Handles both XML and JSON request formats
- **Digital Signatures**: Secure request/response signing with RSA keys
- **MongoDB Storage**: Persistent data storage for audit logs and user management
- **Rate Limiting**: Protection against abuse with configurable rate limits
- **IP Logging**: Request source tracking for security monitoring

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3002
NODE_ENV=production

# Third-party API Configuration
THIRD_PARTY_BASE_URL=http://154.118.230.140:9802/ess-loans/mvtyztwq/consume
API_TIMEOUT=30000

# FSP Configuration
FSP_CODE=FL8090
FSP_NAME=ZE DONE

# Database
MONGODB_URI=mongodb://localhost:27017/ess_db

# Security
JWT_SECRET=your_jwt_secret_here
```

### Current Deployment

- **Port**: 3002
- **Server**: Ubuntu 22.04 LTS (135.181.33.13)
- **Process Manager**: PM2 (ess-app)
- **Database**: MongoDB
- **External Integration**: Utumishi system (154.118.230.140:9802)

## API Endpoints

### Loan Processing
- `POST /api/loan` - Process loan charges requests from Utumishi
- `GET /api/loan/status/:id` - Check loan processing status

### Authentication
- `POST /auth/login` - User authentication
- `POST /auth/register` - User registration

### Audit
- `GET /audit/logs` - Retrieve audit logs
- `POST /audit/log` - Create audit entry

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`
4. Generate SSL keys: `npm run generate-keys`
5. Start the server: `npm start`

## Deployment

The application uses automated CI/CD with GitHub Actions:

1. Push changes to main branch
2. GitHub Actions automatically deploys to production server
3. PM2 manages the application process
4. Logs are available via `pm2 logs ess-app`

## Monitoring

- **PM2 Logs**: `pm2 logs ess-app`
- **Error Logs**: `~/.pm2/logs/ess-app-error.log`
- **Output Logs**: `~/.pm2/logs/ess-app-out.log`
- **Process Status**: `pm2 status`

## Security Features

- Request signing/verification with RSA keys
- Rate limiting (100 requests per 15 minutes)
- Helmet.js security headers
- CORS protection
- Input validation with Joi
- IP address logging for request tracking

## Development

```bash
# Development mode with auto-restart
npm run dev

# Generate new SSL keys
npm run generate-keys

# Test loan processing
node test-loan-processing.js
```
