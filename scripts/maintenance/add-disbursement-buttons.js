// Add Disbursement Action Buttons to Loan Management Page
// Paste this in browser console at http://5.75.185.137/loans

(function() {
    console.log('🔧 Adding Disbursement Action Buttons...');

    // API Configuration
    const API_BASE_URL = 'http://5.75.185.137/api/v1';
    
    // Get auth token from localStorage
    function getAuthToken() {
        return localStorage.getItem('token') || localStorage.getItem('authToken');
    }

    // Function to send disbursement notification
    async function sendDisbursementNotification(applicationNumber) {
        try {
            const token = getAuthToken();
            if (!token) {
                alert('❌ Please login first');
                return;
            }

            if (!confirm(`Send LOAN_DISBURSEMENT_NOTIFICATION for ${applicationNumber}?`)) {
                return;
            }

            console.log(`📤 Sending disbursement notification for: ${applicationNumber}`);
            
            const response = await fetch(`${API_BASE_URL}/loan-actions/send-disbursement-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ applicationNumber })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(`✅ Success: ${data.message}\n\nStatus changed to: ${data.data.status}`);
                location.reload(); // Reload to show updated status
            } else {
                alert(`❌ Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`❌ Error: ${error.message}`);
        }
    }

    // Function to send disbursement failure notification
    async function sendDisbursementFailure(applicationNumber) {
        try {
            const token = getAuthToken();
            if (!token) {
                alert('❌ Please login first');
                return;
            }

            const reason = prompt('Enter failure reason:', 'Disbursement failed due to insufficient funds');
            if (!reason) return;

            const errorDetails = prompt('Enter error details (optional):', '');

            console.log(`📤 Sending disbursement failure for: ${applicationNumber}`);
            
            const response = await fetch(`${API_BASE_URL}/loan-actions/send-disbursement-failure`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ 
                    applicationNumber,
                    reason,
                    errorDetails
                })
            });

            const data = await response.json();
            
            if (data.success) {
                alert(`✅ Success: ${data.message}\n\nStatus changed to: ${data.data.status}`);
                location.reload(); // Reload to show updated status
            } else {
                alert(`❌ Error: ${data.message}`);
            }
        } catch (error) {
            console.error('Error:', error);
            alert(`❌ Error: ${error.message}`);
        }
    }

    // Function to add buttons to loan rows
    function addActionButtons() {
        // Find all table rows
        const tableRows = document.querySelectorAll('table tbody tr');
        
        tableRows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;

            // Get application number (first cell)
            const applicationNumber = cells[0]?.textContent?.trim();
            if (!applicationNumber || applicationNumber === 'No loans found') return;

            // Get status badge (third cell usually contains status)
            const statusCell = cells[2];
            const statusBadge = statusCell?.querySelector('span, .badge, [class*="badge"]');
            const status = statusBadge?.textContent?.trim();

            // Only add buttons for LOAN_CREATED status
            if (status !== 'LOAN_CREATED') return;

            // Get actions cell (last cell)
            const actionsCell = cells[cells.length - 1];
            
            // Check if buttons already added
            if (actionsCell.querySelector('.disbursement-btn')) return;

            // Create disbursement success button
            const successBtn = document.createElement('button');
            successBtn.className = 'disbursement-btn';
            successBtn.innerHTML = '✅ Send Disbursement';
            successBtn.style.cssText = `
                margin: 2px;
                padding: 6px 12px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
            `;
            successBtn.onclick = (e) => {
                e.stopPropagation();
                sendDisbursementNotification(applicationNumber);
            };

            // Create disbursement failure button
            const failureBtn = document.createElement('button');
            failureBtn.className = 'disbursement-btn';
            failureBtn.innerHTML = '❌ Send Failure';
            failureBtn.style.cssText = `
                margin: 2px;
                padding: 6px 12px;
                background: #ef4444;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 500;
            `;
            failureBtn.onclick = (e) => {
                e.stopPropagation();
                sendDisbursementFailure(applicationNumber);
            };

            // Add buttons to actions cell
            const buttonContainer = document.createElement('div');
            buttonContainer.style.display = 'flex';
            buttonContainer.style.gap = '4px';
            buttonContainer.style.marginTop = '4px';
            buttonContainer.appendChild(successBtn);
            buttonContainer.appendChild(failureBtn);
            actionsCell.appendChild(buttonContainer);
        });

        // Also add buttons to loan detail dialogs
        addButtonsToDetailDialogs();
    }

    // Function to add buttons to loan detail view
    function addButtonsToDetailDialogs() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.querySelector) {
                        // Check if this is a loan detail dialog
                        const dialogContent = node.querySelector('[role="dialog"], .modal, .dialog');
                        if (dialogContent) {
                            const statusBadge = dialogContent.querySelector('[class*="badge"], span[class*="Badge"]');
                            const status = statusBadge?.textContent?.trim();
                            
                            if (status === 'LOAN_CREATED') {
                                // Find application number in dialog
                                const appNumberElement = dialogContent.querySelector('h2, h3, [class*="title"]');
                                const appNumberMatch = appNumberElement?.textContent?.match(/APP_\d+/);
                                const applicationNumber = appNumberMatch?.[0];

                                if (applicationNumber && !dialogContent.querySelector('.disbursement-actions')) {
                                    // Create action section
                                    const actionSection = document.createElement('div');
                                    actionSection.className = 'disbursement-actions';
                                    actionSection.style.cssText = `
                                        margin-top: 20px;
                                        padding: 15px;
                                        background: #f3f4f6;
                                        border-radius: 8px;
                                        border: 1px solid #e5e7eb;
                                    `;

                                    actionSection.innerHTML = `
                                        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151;">
                                            💼 Disbursement Actions
                                        </h4>
                                        <p style="margin: 0 0 12px 0; font-size: 13px; color: #6b7280;">
                                            Loan is ready for disbursement. Send notification to ESS:
                                        </p>
                                    `;

                                    // Success button for dialog
                                    const dialogSuccessBtn = document.createElement('button');
                                    dialogSuccessBtn.innerHTML = '✅ Send Disbursement Notification';
                                    dialogSuccessBtn.style.cssText = `
                                        margin-right: 8px;
                                        padding: 10px 16px;
                                        background: #10b981;
                                        color: white;
                                        border: none;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        font-weight: 500;
                                    `;
                                    dialogSuccessBtn.onclick = () => sendDisbursementNotification(applicationNumber);

                                    // Failure button for dialog
                                    const dialogFailureBtn = document.createElement('button');
                                    dialogFailureBtn.innerHTML = '❌ Send Failure Notification';
                                    dialogFailureBtn.style.cssText = `
                                        padding: 10px 16px;
                                        background: #ef4444;
                                        color: white;
                                        border: none;
                                        border-radius: 6px;
                                        cursor: pointer;
                                        font-size: 14px;
                                        font-weight: 500;
                                    `;
                                    dialogFailureBtn.onclick = () => sendDisbursementFailure(applicationNumber);

                                    actionSection.appendChild(dialogSuccessBtn);
                                    actionSection.appendChild(dialogFailureBtn);

                                    // Add to dialog content
                                    const dialogBody = dialogContent.querySelector('[class*="content"], .modal-body, .dialog-body');
                                    if (dialogBody) {
                                        dialogBody.appendChild(actionSection);
                                    }
                                }
                            }
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Run initially
    addActionButtons();

    // Re-run when table content changes
    const tableObserver = new MutationObserver(() => {
        setTimeout(addActionButtons, 500);
    });

    const tableContainer = document.querySelector('table, [class*="table"]');
    if (tableContainer) {
        tableObserver.observe(tableContainer, {
            childList: true,
            subtree: true
        });
    }

    console.log('✅ Disbursement action buttons added successfully!');
    console.log('📋 Buttons will appear for loans with LOAN_CREATED status');

})();
