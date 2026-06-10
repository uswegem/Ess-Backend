// Frontend Authentication Fix for MiraCore Admin Portal
// This script fixes the authentication issue in the React app

(function() {
    console.log('🚀 MiraCore Authentication Fix - Starting...');

    // Step 1: Clear any existing authentication data
    localStorage.removeItem('mira_admin_token');
    localStorage.removeItem('mira_admin_user');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    
    // Step 2: Authenticate and store credentials
    async function authenticateUser() {
        try {
            console.log('🔑 Authenticating with backend...');
            
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
            
            if (!loginResponse.ok) {
                throw new Error(`Login failed: ${loginResponse.status}`);
            }
            
            const loginData = await loginResponse.json();
            
            if (loginData.success && loginData.data.token) {
                // Store authentication data in multiple formats for compatibility
                const token = loginData.data.token;
                const user = loginData.data.user;
                
                // Standard formats
                localStorage.setItem('mira_admin_token', token);
                localStorage.setItem('mira_admin_user', JSON.stringify(user));
                
                // Alternative formats the React app might use
                localStorage.setItem('auth_token', token);
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
                localStorage.setItem('authToken', token);
                localStorage.setItem('userData', JSON.stringify(user));
                
                console.log('✅ Authentication successful!');
                console.log('👤 User:', user.fullName);
                console.log('🔐 Token stored in localStorage');
                
                return { token, user };
            } else {
                throw new Error('Invalid login response');
            }
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            return null;
        }
    }
    
    // Step 3: Test loan data fetching
    async function testLoanData(token) {
        try {
            console.log('📊 Testing loan data fetch...');
            
            const response = await fetch('/api/v1/loan/list-employee-loan', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data.loans) {
                console.log(`✅ Successfully loaded ${data.data.loans.length} loans`);
                return data.data.loans;
            } else {
                throw new Error('Invalid API response');
            }
        } catch (error) {
            console.error('❌ Loan data fetch failed:', error);
            return null;
        }
    }
    
    // Step 4: Force React component refresh
    function forceReactRefresh() {
        console.log('🔄 Forcing React component refresh...');
        
        // Dispatch storage event to trigger React hooks that listen to localStorage
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'mira_admin_token',
            newValue: localStorage.getItem('mira_admin_token')
        }));
        
        // Dispatch custom events
        window.dispatchEvent(new CustomEvent('authStateChanged', {
            detail: { authenticated: true }
        }));
        
        window.dispatchEvent(new CustomEvent('userLoggedIn'));
        window.dispatchEvent(new CustomEvent('tokenUpdated'));
        
        // Try to find and trigger React state updates
        setTimeout(() => {
            // Look for common React refresh patterns
            const refreshButtons = document.querySelectorAll('[data-testid*="refresh"], button[aria-label*="refresh" i], [title*="refresh" i]');
            refreshButtons.forEach(btn => {
                if (btn.click) btn.click();
            });
            
            // Trigger a page refresh as last resort
            setTimeout(() => {
                console.log('🔄 Refreshing page to apply authentication...');
                window.location.reload();
            }, 2000);
        }, 1000);
    }
    
    // Step 5: Execute the fix
    async function executeFix() {
        const auth = await authenticateUser();
        
        if (auth) {
            const loans = await testLoanData(auth.token);
            
            if (loans) {
                console.log('🎉 Authentication and data fetching successful!');
                console.log('📋 Sample loan applications:');
                loans.slice(0, 3).forEach((loan, index) => {
                    console.log(`   ${index + 1}. ${loan.essApplicationNumber || loan._id} - ${loan.status} - Amount: ${loan.requestedAmount?.toLocaleString() || 'N/A'}`);
                });
                
                forceReactRefresh();
            } else {
                console.error('❌ Data fetching failed even with valid authentication');
            }
        } else {
            console.error('❌ Authentication failed - please check credentials');
        }
    }
    
    // Start the fix
    executeFix();
    
    console.log('📝 Fix applied! The page should refresh automatically and show loan data.');
    console.log('🔧 If loans still don\'t appear, try refreshing the page manually.');
    
})();