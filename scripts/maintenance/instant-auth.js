// ⚡ INSTANT Authentication Fix - Copy & Paste into Browser Console
// Use at: http://5.75.185.137/loan

console.clear();
console.log('⚡ INSTANT AUTH FIX - MiraCore');

// Test API connectivity first
async function testAPI() {
    try {
        console.log('🔍 Testing API connectivity...');
        
        // Test authentication endpoint
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'superadmin',
                password: 'SuperAdmin123!'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data.token) {
                console.log('✅ API is working! Authentication successful');
                return data;
            }
        }
        
        console.log('❌ API test failed:', response.status, response.statusText);
        return null;
    } catch (error) {
        console.log('❌ API connection error:', error.message);
        return null;
    }
}

// Pre-authenticated token and user data (fallback)
const fallbackAuthData = {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiNzYzNjhhNDJkMzljNTllZTUwODciLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5AZW1rb3BvLnR6Iiwicm9sZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzY1NTA0MjQyLCJleHAiOjE3NjYxMDkwNDIsImlzcyI6ImVta29wby1iYWNrZW5kIiwic3ViIjoiNjhmYjc2MzY4YTQyZDM5YzU5ZWU1MDg3In0.7dFJP_mslPLozZtgCEIHrqBM76ViEKxRdThVjcuRfEQ",
    user: {
        id: "68fb76368a42d39c59ee5087",
        username: "superadmin", 
        email: "superadmin@emkopo.tz",
        role: "super_admin",
        fullName: "System Super Administrator"
    }
};

// Main authentication function
async function authenticate() {
    // First try fresh API authentication
    const apiResult = await testAPI();
    let authData = apiResult ? apiResult.data : fallbackAuthData;
    
    console.log('💾 Storing authentication data...');
    
    // Clear storage and inject authentication
    localStorage.clear();
    localStorage.setItem('token', authData.token);
    localStorage.setItem('authToken', authData.token);
    localStorage.setItem('mira_admin_token', authData.token);
    localStorage.setItem('user', JSON.stringify(authData.user));
    localStorage.setItem('currentUser', JSON.stringify(authData.user));
    localStorage.setItem('adminToken', authData.token); // Some apps use this key
    
    // Test loans API
    try {
        console.log('📊 Testing loans API...');
        const loansResponse = await fetch('/api/v1/loan/list-employee-loan', {
            headers: {
                'Authorization': `Bearer ${authData.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (loansResponse.ok) {
            const loansData = await loansResponse.json();
            if (loansData.success && loansData.data.loans) {
                console.log(`✅ Loans API working! Found ${loansData.data.loans.length} loans`);
            }
        } else {
            console.log('⚠️ Loans API returned:', loansResponse.status);
        }
    } catch (error) {
        console.log('⚠️ Loans API test failed:', error.message);
    }

    // Trigger React events
    window.dispatchEvent(new StorageEvent('storage', { 
        key: 'token', newValue: authData.token 
    }));
    
    window.dispatchEvent(new StorageEvent('storage', { 
        key: 'mira_admin_token', newValue: authData.token 
    }));

    console.log('✅ Authentication injected!');
    console.log('🔄 Refreshing in 1 second...');

    setTimeout(() => window.location.reload(), 1000);
}

// Execute authentication
authenticate();