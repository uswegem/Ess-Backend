# Copilot Instructions for MiraCore Project

## Overview
This project is a full-stack application called MiraCore, consisting of a Node.js backend and a React frontend. The backend handles API services, authentication, and database interactions, while the frontend provides the user interface for administration and user management.

## Project Structure
- **Backend/**: Node.js server with Express.js, handling APIs, authentication, and services.
- **Frontend/**: React application for the admin interface.
- **Frontend/MiraCoreAdmin/**: (Note: Files have been moved to Frontend/ for consolidation)

## Coding Guidelines
- Use consistent naming conventions (camelCase for variables/functions, PascalCase for components/classes).
- Write clear, concise comments for complex logic.
- Follow ES6+ standards for JavaScript.
- Use async/await for asynchronous operations.
- Validate inputs and handle errors gracefully.
- Keep code modular and reusable.

## Backend Specific
- Use Express.js for routing.
- Implement JWT for authentication.
- Use middleware for request validation and logging.
- Structure code with controllers, services, and utilities.
- Ensure secure handling of sensitive data (keys, certificates).

## Frontend Specific
- Use React functional components with hooks.
- Manage state with Redux Toolkit (slices for count and userInfo).
- Style components with CSS modules or styled-components.
- Handle API calls in dedicated service files.
- Implement responsive design.

## Security
- Never expose sensitive information in client-side code.
- Validate all user inputs on both client and server.
- Use HTTPS in production.
- Implement proper CORS policies.

## Development Workflow
- Test changes locally before committing.
- Write meaningful commit messages.
- Use branches for feature development.
- Keep dependencies updated and secure.

## Remote Server Configuration
- Remote working folder: /home/uswege/ess
- Login via SSH: ssh miracore

## Tools and Technologies
- Backend: Node.js, Express.js, JWT, Database (likely MongoDB or similar)
- Frontend: React, Redux Toolkit, CSS
- Version Control: Git
- Package Managers: npm

## Agent Behavior
When assisting with this project:
- Prioritize code quality and maintainability.
- Suggest best practices for the technologies used.
- Help with debugging and optimization.
- Provide clear explanations for changes.
- Respect the existing project structure and conventions.

## Additional Notes
- The project includes certificate generation and verification features.
- API endpoints handle loans, users, and third-party services.
- Frontend includes components for login, dashboard, and various admin functions.

## SUPPORTED OUTGOING MESSAGE TYPES FROM THE API, SENDER = ZE DONE. ALL outgoing messages must should be enabled on the frontend to enable triggering them manually or automatically.	
- RESPONSE
- ACCOUNT_VALIDATION_RESPONSE
- DEFAULTER_DETAILS_TO_EMPLOYER
- FSP_BRANCHES 
- FULL_LOAN_REPAYMENT_NOTIFICATION
- FULL_LOAN_REPAYMENT_REQUEST
- LOAN_CHARGES_RESPONSE 
- LOAN_DISBURSEMENT_FAILURE_NOTIFICATION 
- LOAN_DISBURSEMENT_NOTIFICATION 
- LOAN_INITIAL_APPROVAL_NOTIFICATION 
- LOAN_LIQUIDATION_NOTIFICATION
- LOAN_RESTRUCTURE_AFFORDABILITY_RESPONSE 
- LOAN_RESTRUCTURE_BALANCE_REQUEST 
- LOAN_RESTRUCTURE_BALANCE_RESPONSE 
- LOAN_RESTRUCTURE_REQUEST_FSP 
- LOAN_STATUS_REQUEST
- LOAN_TAKEOVER_BALANCE_RESPONSE
- LOAN_TOP_UP_BALANCE_RESPONSE
- PARTIAL_LOAN_REPAYMENT_NOTIFICATION
- PARTIAL_REPAYMENT_OFF_BALANCE_RESPONSE
- PAYMENT_ACKNOWLEDGMENT_NOTIFICATION
- PRODUCT_DECOMMISSION
- PRODUCT_DETAIL
- TAKEOVER_DISBURSEMENT_NOTIFICATION

## SUPPORTED INCOMING MESSAGE TYPES FROM THE API, SENDER = "ESS_UTUMISHI", RECEIVER = "ZE DONE"
- RESPONSE
- ACCOUNT_VALIDATION
- DEDUCTION_STOP_NOTIFICATION
- DEFAULTER_DETAILS_TO_FSP
- FSP_MONTHLY_DEDUCTIONS
- FSP_REPAYMENT_REQUEST
- LOAN_CANCELLATION_NOTIFICATION
- LOAN_CHARGES_REQUEST
- LOAN_OFFER_REQUEST
- LOAN_FINAL_APPROVAL_NOTIFICATION
- LOAN_RESTRUCTURE_AFFORDABILITY_REQUEST
- LOAN_RESTRUCTURE_REJECTION
- LOAN_RESTRUCTURE_REQUEST
- LOAN_TAKEOVER_OFFER_REQUEST
- PARTIAL_LOAN_REPAYMENT_REQUEST
- REPAYMENT_0FF_BALANCE_REQUEST_TO_FSP
- TAKEOVER_PAY_OFF_BALANCE_REQUEST
- TAKEOVER_PAYMENT_NOTIFICATION
- TOP_UP_OFFER_REQUEST
- TOP_UP_PAY_0FF_BALANCE_REQUEST

## FRONT END:
- React Native mobile app for employees
- React web app for employers and FSPs
- Admin portal for system admins
- Both apps communicate with the Node.js backend via RESTful APIs
- Backend handles business logic, data processing, and integration with external systems
- Role-based access control for different user types
- Secure authentication and authorization mechanisms
- Data encryption for sensitive information
- Comprehensive logging and monitoring for audit trails and debugging
- Error handling and validation for robust operations
- Scalable architecture to handle growing user base and data volume
- Modular code structure for maintainability and extensibility
- Role and Permissions configurations
- Multi-tenant support for different organizations