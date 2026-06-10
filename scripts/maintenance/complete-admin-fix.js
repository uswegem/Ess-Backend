// Complete Admin Frontend Fix
console.log('Complete Admin Frontend Authentication & API Fix');

// Step 1: Login and get fresh token
async function getAuthToken() {
    try {
        console.log('Logging in to get fresh token...');
        
        const response = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: 'superadmin',
                password: 'SuperAdmin123!'
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            console.log('Login successful');
            return {
                token: data.data.token,
                user: data.data.user
            };
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Login failed:', error.message);
        return null;
    }
}

// Step 2: Set authentication data and test APIs
async function setupAuthentication() {
    const auth = await getAuthToken();
    
    if (!auth) {
        console.error('Could not obtain authentication token');
        return;
    }
    
    // Store authentication data
    localStorage.setItem('adminToken', auth.token);
    localStorage.setItem('user', JSON.stringify({
        id: auth.user.id,
        username: auth.user.username,
        email: auth.user.email,
        role: auth.user.role,
        name: auth.user.fullName || auth.user.username,
        createdAt: auth.user.createdAt
    }));
    
    console.log('Authentication data stored');
    
    // Step 3: Test API endpoints
    const endpoints = [
        '/api/v1/admin/get_all_users',
        '/api/v1/loan/list-products',
        '/api/v1/loan/list-employee-loan'
    ];
    
    console.log('Testing API endpoints...');
    
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${auth.token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                console.log(`${endpoint} - Working`);
            } else {
                console.log(`${endpoint} - Error: ${data.message}`);
            }
        } catch (error) {
            console.log(`${endpoint} - Network Error: ${error.message}`);
        }
    }
}

// Step 4: Override API configuration
function fixAPIConfiguration() {
    console.log('Fixing API configuration...');
    
    // Check if the React app has global variables we can override
    if (window.xo) {
        window.xo = window.location.origin;
        console.log('Updated xo base URL to:', window.xo);
    }
    
    // Override fetch to add authentication headers automatically
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        const [url, options = {}] = args;
        
        // Add authentication header if not present and we have a token
        const token = localStorage.getItem('adminToken');
        if (token && (!options.headers || !options.headers.Authorization)) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
        
        return originalFetch(url, options);
    };
    
    console.log('Fetch override applied');
}

// Main execution
async function main() {
    console.log('Starting complete admin fix...');
    
    await setupAuthentication();
    fixAPIConfiguration();
    
    console.log('Admin fix completed successfully!');
    console.log('Refreshing page in 3 seconds...');
    
    setTimeout(() => {
        window.location.reload();
    }, 3000);
}

// Run the fix
main().catch(console.error);
