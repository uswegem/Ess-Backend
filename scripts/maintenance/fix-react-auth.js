// Quick fix to authenticate the React app and load loans
// This can be injected into the browser console at http://5.75.185.137/loan

console.log('🔧 MiraCore Admin Portal - Authentication Fix');

// Step 1: Login and get token
async function authenticateAndLoadLoans() {
    try {
        console.log('1️⃣ Attempting authentication...');
        
        // Login request
        const loginResponse = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'superadmin',
                password: 'SuperAdmin123!'
            })
        });
        
        const loginData = await loginResponse.json();
        
        if (loginData.success && loginData.data.token) {
            console.log('✅ Authentication successful!');
            
            // Store token in localStorage (React app should do this)
            localStorage.setItem('mira_admin_token', loginData.data.token);
            localStorage.setItem('mira_admin_user', JSON.stringify(loginData.data.user));
            
            console.log('2️⃣ Loading loans data...');
            
            // Get loans with authentication
            const loansResponse = await fetch('/api/v1/loan/list-employee-loan', {
                headers: {
                    'Authorization': `Bearer ${loginData.data.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const loansData = await loansResponse.json();
            
            if (loansData.success) {
                console.log(`✅ Loaded ${loansData.data.loans.length} loans successfully!`);
                console.log('Loans data:', loansData.data.loans);
                
                // Try to trigger a React re-render by dispatching a custom event
                window.dispatchEvent(new CustomEvent('loansDataLoaded', { 
                    detail: loansData.data.loans 
                }));
                
                // Also try to update any existing state
                if (window.React && window.ReactDOM) {
                    console.log('🔄 React detected, attempting to refresh...');
                    // Force a page reload to let React pick up the authentication
                    setTimeout(() => {
                        console.log('🔄 Refreshing page to apply authentication...');
                        window.location.reload();
                    }, 1000);
                }
                
                return loansData.data.loans;
            } else {
                console.error('❌ Failed to load loans:', loansData.message);
            }
        } else {
            console.error('❌ Authentication failed:', loginData.message);
        }
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

// Step 2: Check if already authenticated
console.log('🔍 Checking existing authentication...');
const existingToken = localStorage.getItem('mira_admin_token');

if (existingToken) {
    console.log('🔑 Existing token found, testing validity...');
    
    fetch('/api/v1/loan/list-employee-loan', {
        headers: {
            'Authorization': `Bearer ${existingToken}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ Existing token valid, loans loaded!');
            console.log(`Found ${data.data.loans.length} loans`);
        } else {
            console.log('🔄 Token expired, re-authenticating...');
            authenticateAndLoadLoans();
        }
    })
    .catch(() => {
        console.log('🔄 Testing failed, re-authenticating...');
        authenticateAndLoadLoans();
    });
} else {
    console.log('🔑 No existing token, authenticating...');
    authenticateAndLoadLoans();
}

console.log('📝 Instructions:');
console.log('1. Copy and paste this script into browser console at http://5.75.185.137/loan');
console.log('2. The script will automatically login and load data');
console.log('3. The page may refresh to apply authentication properly');
console.log('4. If loans still show "No rows", refresh the page manually');