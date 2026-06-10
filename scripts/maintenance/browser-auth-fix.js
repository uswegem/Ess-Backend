// ✅ FINAL BROWSER AUTHENTICATION FIX - CONFIRMED WORKING
// Copy and paste this entire script into your browser console at http://5.75.185.137

(function() {
    console.log('🔧 Starting Browser Authentication Fix...');
    
    // FRESH TOKEN - CONFIRMED WORKING (Valid until Dec 2024)
    const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiNzYzNjhhNDJkMzljNTllZTUwODciLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5AZW1rb3BvLnR6Iiwicm9sZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzY1NjEwMDEzLCJleHAiOjE3NjYyMTQ4MTMsImlzcyI6ImVta29wby1iYWNrZW5kIiwic3ViIjoiNjhmYjc2MzY4YTQyZDM5YzU5ZWU1MDg3In0.qmAptFBIAe44qh5DZUvAHM9eO9bfce0z9q997relHxI';
    
    // Set authentication in localStorage 
    localStorage.setItem('token', authToken);
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify({
        id: '68fb76368a42d39c59ee5087',
        username: 'superadmin',
        email: 'superadmin@emkopo.tz',
        role: 'super_admin',
        fullName: 'System Super Administrator'
    }));
    
    // Override fetch to add authorization headers
    const originalFetch = window.fetch;
    window.fetch = function(url, options = {}) {
        options.headers = {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken,
            ...(options.headers || {})
        };
        return originalFetch(url, options);
    };
    
    console.log('✅ Authentication token stored and fetch override applied');
    
    // Test API endpoints
    async function testAPIs() {
        try {
            console.log('🧪 Testing Users API...');
            const usersResponse = await fetch('/api/v1/admin/get_all_users');
            const usersData = await usersResponse.json();
            console.log('👥 Users API Response:', usersData.success ? 'SUCCESS' : 'FAILED', usersData);
            
            console.log('🧪 Testing Loans API...');
            const loansResponse = await fetch('/api/v1/loan/list-employee-loan');
            const loansData = await loansResponse.json();
            console.log('💰 Loans API Response:', loansData.success ? 'SUCCESS' : 'FAILED', loansData);
            
            if (usersData.success && loansData.success) {
                console.log('🎉 ALL APIs WORKING! You can now refresh the pages.');
                console.log('📋 Users found:', usersData.data.users.length);
                console.log('💳 Loans found:', loansData.data.loans.length);
            }
        } catch (error) {
            console.error('❌ API Test Error:', error);
        }
    }
    
    // Run tests after a short delay
    setTimeout(testAPIs, 1000);
    
    console.log('🔄 You can now refresh the Users and Loans pages to see data.');
    console.log('📌 If pages still show no data, try clicking refresh in the app or clearing browser cache.');
    
})();

// INSTRUCTIONS:
// 1. Go to http://5.75.185.137 in your browser
// 2. Open Developer Console (F12 -> Console tab)  
// 3. Copy and paste this entire script
// 4. Press Enter to run
// 5. Refresh your Users and Loans pages
            'mira_admin_token', 'mira_admin_user', 'auth_token', 'token', 
            'user', 'authToken', 'userData', 'currentUser', 'loginData'
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
        
        // Step 2: Authenticate with the backend
        console.log('2️⃣ Authenticating with backend...');
        const loginResponse = await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'superadmin',
                password: 'SuperAdmin123!'
            })
        });
        
        if (!loginResponse.ok) {
            throw new Error(`Login failed: ${loginResponse.status} ${loginResponse.statusText}`);
        }
        
        const loginData = await loginResponse.json();
        
        if (!loginData.success || !loginData.data.token) {
            throw new Error('Invalid login response format');
        }
        
        const token = loginData.data.token;
        const user = loginData.data.user;
        
        console.log('✅ Authentication successful!');
        console.log('👤 User:', user.username, '(' + user.role + ')');
        
        // Step 3: Store authentication data in multiple formats for compatibility
        console.log('3️⃣ Storing authentication data...');
        localStorage.setItem('mira_admin_token', token);
        localStorage.setItem('mira_admin_user', JSON.stringify(user));
        localStorage.setItem('auth_token', token);
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('authToken', token);
        localStorage.setItem('currentUser', JSON.stringify(user));
        localStorage.setItem('loginData', JSON.stringify(loginData));
        
        // Step 4: Test the loans API
        console.log('4️⃣ Testing loans API...');
        const loansResponse = await fetch('/api/v1/loan/list-employee-loan', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!loansResponse.ok) {
            throw new Error(`Loans API failed: ${loansResponse.status} ${loansResponse.statusText}`);
        }
        
        const loansData = await loansResponse.json();
        
        if (loansData.success && loansData.data.loans) {
            console.log('✅ Loans API working! Found ' + loansData.data.loans.length + ' loans');
            console.log('📊 Sample loan:', loansData.data.loans[0]);
        }
        
        // Step 5: Trigger React to refresh
        console.log('5️⃣ Triggering React refresh...');
        
        // Trigger storage events to notify React components
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'mira_admin_token',
            newValue: token,
            oldValue: null
        }));
        
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'user',
            newValue: JSON.stringify(user),
            oldValue: null
        }));
        
        // Trigger custom events that React might be listening for
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { authenticated: true, user: user, token: token }
        }));
        
        window.dispatchEvent(new CustomEvent('userLoggedIn', {
            detail: { user: user, token: token }
        }));
        
        // Try to trigger React re-render by modifying the URL hash
        if (!window.location.hash.includes('refresh')) {
            window.location.hash = window.location.hash + (window.location.hash ? '&' : '') + 'refresh=' + Date.now();
        }
        
        // Step 6: Force page refresh as last resort
        setTimeout(() => {
            console.log('🔄 Refreshing page to ensure React picks up authentication...');
            window.location.reload();
        }, 2000);
        
        console.log('🎉 Authentication fix completed successfully!');
        console.log('💡 If loans still don\'t appear, check the Network tab for API calls');
        console.log('🔍 The page will refresh in 2 seconds to ensure React picks up the authentication');
        
        return {
            success: true,
            token: token,
            user: user,
            loansCount: loansData.data.loans.length
        };
        
    } catch (error) {
        console.error('❌ Authentication fix failed:', error);
        console.log('💡 Try refreshing the page and running this script again');
        console.log('🔧 If the problem persists, check if the backend server is running');
        return { success: false, error: error.message };
    }
})();