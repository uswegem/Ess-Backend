// Fix Notifications Page to use real API data
console.log('🔧 Fixing Notifications page...');

// Get fresh token
fetch('/api/v1/auth/login', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({username: 'superadmin', password: 'SuperAdmin123!'})
})
.then(r => r.json())
.then(loginData => {
    if (loginData.success) {
        const token = loginData.data.token;
        
        // Store token
        localStorage.setItem('token', token);
        localStorage.setItem('authToken', token);
        
        // Override fetch for notifications
        const originalFetch = window.fetch;
        window.fetch = function(url, options = {}) {
            // Add auth header for all requests
            options.headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token,
                ...(options.headers || {})
            };
            
            // Intercept notifications API call
            if (url.includes('/api/v1/admin/notifications') || url.includes('notifications')) {
                return originalFetch('/api/v1/admin/notifications', options);
            }
            
            return originalFetch(url, options);
        };
        
        console.log('✅ Notifications API override applied');
        
        // Force reload the page to use new data
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
})
.catch(err => console.error('❌ Failed to fix notifications:', err));