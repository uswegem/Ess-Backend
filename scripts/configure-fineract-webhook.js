/**
 * Configure Fineract Webhook for Loan Approval Events
 * This script sets up a webhook in Fineract/MIFOS to send notifications
 * when loans are approved, enabling automatic PDF generation for MSE products.
 * 
 * Run: node scripts/configure-fineract-webhook.js
 */

const axios = require('axios');
require('dotenv').config();

const CBS_BASE_URL = 'https://creditconnect-uat.miracore.co.tz/fineract-provider/api';
const CBS_TENANT = 'creditconnect-uat';
const CBS_USERNAME = 'uswege';
const CBS_PASSWORD = 'Jothan@123456';

// Webhook configuration
const WEBHOOK_URL = process.env.WEBHOOK_URL || 'http://135.181.33.13:3002/api/webhook/mifos';

async function getAuthToken() {
    const authString = Buffer.from(`${CBS_USERNAME}:${CBS_PASSWORD}`).toString('base64');
    return authString;
}

async function configureWebhook() {
    try {
        const authToken = await getAuthToken();
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${authToken}`,
            'fineract-platform-tenantid': CBS_TENANT
        };

        console.log('🔧 Configuring Fineract Webhook for Loan Approval Events...');
        console.log(`📡 Webhook URL: ${WEBHOOK_URL}`);

        // First, check existing hooks
        console.log('\n📋 Checking existing webhooks...');
        const existingHooks = await axios.get(`${CBS_BASE_URL}/v1/hooks`, { headers });
        console.log(`Found ${existingHooks.data.length} existing webhooks`);

        // Check if our webhook already exists
        const existingLoanApprovalHook = existingHooks.data.find(hook => 
            hook.name === 'MSE Loan Approval PDF Generator' ||
            hook.events?.some(e => e.entityName === 'LOAN' && e.actionName === 'APPROVE')
        );

        if (existingLoanApprovalHook) {
            console.log(`\n⚠️ Webhook already exists (ID: ${existingLoanApprovalHook.id})`);
            console.log('Updating existing webhook...');
            
            // Update existing webhook
            const updatePayload = {
                name: 'MSE Loan Approval PDF Generator',
                isActive: true,
                events: [
                    { entityName: 'LOAN', actionName: 'APPROVE' },
                    { entityName: 'LOAN', actionName: 'DISBURSE' }
                ],
                config: {
                    'Payload URL': WEBHOOK_URL,
                    'Content Type': 'json'
                },
                templateId: 1 // Web template
            };

            await axios.put(
                `${CBS_BASE_URL}/v1/hooks/${existingLoanApprovalHook.id}`,
                updatePayload,
                { headers }
            );
            console.log('✅ Webhook updated successfully!');
        } else {
            // Create new webhook
            console.log('\n📝 Creating new webhook...');
            
            const webhookPayload = {
                name: 'MSE Loan Approval PDF Generator',
                isActive: true,
                displayName: 'MSE Loan Document Generator',
                events: [
                    { entityName: 'LOAN', actionName: 'APPROVE' },
                    { entityName: 'LOAN', actionName: 'DISBURSE' }
                ],
                config: {
                    'Payload URL': WEBHOOK_URL,
                    'Content Type': 'json'
                },
                templateId: 1 // Web template (HTTP POST)
            };

            const response = await axios.post(
                `${CBS_BASE_URL}/v1/hooks`,
                webhookPayload,
                { headers }
            );

            console.log('✅ Webhook created successfully!');
            console.log(`   Hook ID: ${response.data.resourceId}`);
        }

        // Verify the webhook configuration
        console.log('\n🔍 Verifying webhook configuration...');
        const verifyResponse = await axios.get(`${CBS_BASE_URL}/v1/hooks`, { headers });
        const ourHook = verifyResponse.data.find(h => h.name === 'MSE Loan Approval PDF Generator');
        
        if (ourHook) {
            console.log('\n✅ Webhook Configuration:');
            console.log(`   Name: ${ourHook.name}`);
            console.log(`   Active: ${ourHook.isActive}`);
            console.log(`   Events: ${ourHook.events?.map(e => `${e.entityName}.${e.actionName}`).join(', ')}`);
            console.log(`   URL: ${ourHook.config?.find(c => c.fieldName === 'Payload URL')?.fieldValue || WEBHOOK_URL}`);
        }

        console.log('\n🎉 Fineract webhook configuration complete!');
        console.log('\n📋 Next Steps:');
        console.log('   1. Deploy the updated ESS middleware with PDF generation service');
        console.log('   2. Approve an MSE loan (MPOF, MIDF, or MWCF)');
        console.log('   3. Check the generated-documents folder for PDF files');
        console.log('   4. Verify PDFs are attached to the loan in MIFOS');

    } catch (error) {
        console.error('❌ Error configuring webhook:', error.response?.data || error.message);
        
        if (error.response?.status === 403) {
            console.log('\n⚠️ Permission denied. Make sure the user has REGISTER_HOOK permission.');
        } else if (error.response?.status === 401) {
            console.log('\n⚠️ Authentication failed. Check CBS credentials.');
        }
        
        process.exit(1);
    }
}

// Alternative: Configure via SQL directly
async function configureWebhookViaSql() {
    console.log('\n📝 Alternative: SQL Commands to configure webhook');
    console.log('Run these commands on the creditconnect-uat database:\n');
    
    console.log(`
-- Insert webhook configuration
INSERT INTO m_hook (name, is_active, created_by, created_date, template_id) 
VALUES ('MSE Loan Approval PDF Generator', 1, 1, NOW(), 1);

-- Get the hook ID
SET @hook_id = LAST_INSERT_ID();

-- Add webhook URL configuration
INSERT INTO m_hook_configuration (hook_id, field_type, field_name, field_value)
VALUES 
(@hook_id, 'string', 'Payload URL', '${WEBHOOK_URL}'),
(@hook_id, 'string', 'Content Type', 'json');

-- Register for LOAN.APPROVE event
INSERT INTO m_hook_registered_events (hook_id, entity_name, action_name)
VALUES 
(@hook_id, 'LOAN', 'APPROVE'),
(@hook_id, 'LOAN', 'DISBURSE');

-- Verify
SELECT h.id, h.name, h.is_active, e.entity_name, e.action_name
FROM m_hook h
JOIN m_hook_registered_events e ON h.id = e.hook_id
WHERE h.name = 'MSE Loan Approval PDF Generator';
    `);
}

// Run configuration
configureWebhook().catch(console.error);
