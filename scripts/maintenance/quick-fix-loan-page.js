/**
 * Quick Fix: JavaScript to connect existing loan page to ESS Backend
 * Add this script to http://5.75.185.137/loan page
 */

// API Configuration
const API_BASE_URL = 'http://135.181.33.13:3002/api/v1';

// Function to fetch loans from ESS Backend
async function fetchLoansFromESS() {
    try {
        console.log('🔍 Fetching loans from ESS Backend...');
        
        const response = await fetch(`${API_BASE_URL}/loan/list-employee-loan`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.success && data.data && data.data.loans) {
            console.log(`✅ Found ${data.data.loans.length} loans`);
            displayLoans(data.data.loans);
            return data.data.loans;
        } else {
            throw new Error('No loan data received');
        }
        
    } catch (error) {
        console.error('❌ Failed to fetch loans:', error);
        displayError(error.message);
        return [];
    }
}

// Function to display loans in the existing table/container
function displayLoans(loans) {
    // Find existing loan container or create one
    let container = document.querySelector('#loan-list, .loan-container, .data-table, table tbody');
    
    if (!container) {
        // Create a new container if none exists
        container = document.createElement('div');
        container.id = 'loan-list';
        container.className = 'loan-list-container';
        document.body.appendChild(container);
    }

    // Clear existing content
    container.innerHTML = '';

    if (loans.length === 0) {
        container.innerHTML = `
            <div class="no-data" style="text-align: center; padding: 40px; color: #666;">
                <p>No loan applications found</p>
                <small>Connected to ESS Backend: ${API_BASE_URL}</small>
            </div>
        `;
        return;
    }

    // Create loan items
    loans.forEach(loan => {
        const loanElement = createLoanElement(loan);
        container.appendChild(loanElement);
    });

    // Add summary info
    const summaryElement = document.createElement('div');
    summaryElement.className = 'loan-summary';
    summaryElement.style.cssText = 'margin: 20px 0; padding: 15px; background: #f0f9ff; border-left: 4px solid #0ea5e9; border-radius: 4px;';
    summaryElement.innerHTML = `
        <strong>📊 Loan Applications Summary:</strong><br>
        Total Applications: ${loans.length}<br>
        Data Source: ESS Backend (${API_BASE_URL})<br>
        Last Updated: ${new Date().toLocaleString()}
    `;
    
    container.parentElement.insertBefore(summaryElement, container);
}

// Function to create individual loan element
function createLoanElement(loan) {
    const element = document.createElement('div');
    element.className = 'loan-item';
    element.style.cssText = 'border: 1px solid #e5e7eb; margin: 10px 0; padding: 15px; border-radius: 8px; background: white;';
    
    const statusColor = getStatusColor(loan.status);
    const principal = formatCurrency(loan.loanData?.principal || 0);
    const clientName = `${loan.clientData?.firstName || ''} ${loan.clientData?.lastName || ''}`.trim();
    
    element.innerHTML = `
        <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 10px;">
            <div style="flex: 1;">
                <h3 style="margin: 0 0 5px 0; color: #1f2937;">
                    Application: ${loan.essApplicationNumber || 'N/A'}
                </h3>
                <p style="margin: 0; color: #6b7280; font-size: 14px;">
                    Client: ${clientName || 'Unknown Client'}
                </p>
            </div>
            <div>
                <span style="background: ${statusColor.bg}; color: ${statusColor.text}; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                    ${loan.status}
                </span>
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
            <div>
                <strong>Principal Amount:</strong><br>
                <span style="color: #059669; font-weight: 600;">${principal}</span>
            </div>
            <div>
                <strong>Interest Rate:</strong><br>
                ${loan.loanData?.interestRate || 'N/A'}%
            </div>
            <div>
                <strong>Tenure:</strong><br>
                ${loan.loanData?.tenure || 'N/A'} months
            </div>
            <div>
                <strong>Created:</strong><br>
                ${new Date(loan.createdAt).toLocaleDateString()}
            </div>
        </div>
        
        ${loan.employmentData ? `
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #f3f4f6;">
            <strong>Employment:</strong> 
            ${loan.employmentData.department || 'N/A'} | 
            Employee #${loan.employmentData.employeeNumber || 'N/A'}
        </div>
        ` : ''}
    `;
    
    return element;
}

// Helper function to get status colors
function getStatusColor(status) {
    const colors = {
        'APPROVED': { bg: '#d1fae5', text: '#065f46' },
        'DISBURSED': { bg: '#d1fae5', text: '#065f46' },
        'FINAL_APPROVAL_RECEIVED': { bg: '#d1fae5', text: '#065f46' },
        'PENDING': { bg: '#fef3c7', text: '#92400e' },
        'INITIAL_OFFER': { bg: '#fef3c7', text: '#92400e' },
        'CLIENT_CREATED': { bg: '#dbeafe', text: '#1e40af' },
        'LOAN_CREATED': { bg: '#dbeafe', text: '#1e40af' },
        'CANCELLED': { bg: '#fee2e2', text: '#991b1b' },
        'REJECTED': { bg: '#fee2e2', text: '#991b1b' },
        'FAILED': { bg: '#fee2e2', text: '#991b1b' }
    };
    return colors[status] || { bg: '#f3f4f6', text: '#374151' };
}

// Helper function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-TZ', {
        style: 'currency',
        currency: 'TZS',
        minimumFractionDigits: 0
    }).format(amount || 0);
}

// Function to display errors
function displayError(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.style.cssText = 'background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 15px; border-radius: 8px; margin: 20px 0;';
    errorElement.innerHTML = `
        <strong>⚠️ Connection Error:</strong><br>
        ${message}<br><br>
        <small>
            Trying to connect to: ${API_BASE_URL}<br>
            Make sure the ESS backend is running and accessible.
        </small>
    `;
    
    const container = document.querySelector('#loan-list, .loan-container, .main-content, body');
    if (container) {
        container.innerHTML = '';
        container.appendChild(errorElement);
    }
}

// Auto-fetch loans when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Admin Portal loaded, fetching loans...');
    
    // Add loading indicator
    const loadingElement = document.createElement('div');
    loadingElement.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 15px; color: #666;">Loading loan applications...</p>
            <small>Connecting to ESS Backend...</small>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    const body = document.body;
    body.appendChild(loadingElement);
    
    // Fetch loans after a brief delay
    setTimeout(() => {
        fetchLoansFromESS().finally(() => {
            // Remove loading indicator
            if (loadingElement.parentElement) {
                loadingElement.parentElement.removeChild(loadingElement);
            }
        });
    }, 500);
});

// Add refresh button
function addRefreshButton() {
    const refreshButton = document.createElement('button');
    refreshButton.innerHTML = '🔄 Refresh Loans';
    refreshButton.style.cssText = 'background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin: 10px 0; font-weight: 500;';
    refreshButton.onclick = () => {
        refreshButton.disabled = true;
        refreshButton.innerHTML = '🔄 Refreshing...';
        
        fetchLoansFromESS().finally(() => {
            refreshButton.disabled = false;
            refreshButton.innerHTML = '🔄 Refresh Loans';
        });
    };
    
    document.body.insertBefore(refreshButton, document.body.firstChild);
}

// Add refresh button after page loads
setTimeout(addRefreshButton, 1000);

console.log('✅ Loan fetching script loaded. This will connect http://5.75.185.137/loan to ESS backend.');