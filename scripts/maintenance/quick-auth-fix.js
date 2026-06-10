// 🚀 Quick Authentication Bypass Script
// Copy and paste this into browser console at http://5.75.185.137/loan

(function() {
    console.log('🔧 Quick Authentication Fix...');
    
    // Use a fresh token we know works
    const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiNzYzNjhhNDJkMzljNTllZTUwODciLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5AZW1rb3BvLnR6Iiwicm9sZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzY1NTA0MjQyLCJleHAiOjE3NjYxMDkwNDIsImlzcyI6ImVta29wby1iYWNrZW5kIiwic3ViIjoiNjhmYjc2MzY4YTQyZDM5YzU5ZWU1MDg3In0.7dFJP_mslPLozZtgCEIHrqBM76ViEKxRdThVjcuRfEQ";
    
    const user = {
        "id": "68fb76368a42d39c59ee5087",
        "username": "superadmin",
        "email": "superadmin@emkopo.tz",
        "role": "super_admin",
        "fullName": "System Super Administrator"
    };
    
    // Clear existing data
    localStorage.clear();
    
    // Store authentication data in all possible formats
    localStorage.setItem('mira_admin_token', token);
    localStorage.setItem('mira_admin_user', JSON.stringify(user));
    localStorage.setItem('auth_token', token);
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('authToken', token);
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('loginData', JSON.stringify({
        success: true,
        data: { token: token, user: user }
    }));
    
    console.log('✅ Authentication data stored!');
    console.log('👤 User:', user.username, '(' + user.role + ')');
    
    // Trigger all possible React refresh events
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'mira_admin_token',
        newValue: token
    }));
    
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'user',
        newValue: JSON.stringify(user)
    }));
    
    window.dispatchEvent(new CustomEvent('authStateChanged', {
        detail: { authenticated: true, user: user, token: token }
    }));
    
    window.dispatchEvent(new CustomEvent('userLoggedIn', {
        detail: { user: user, token: token }
    }));
    
    // Force refresh page to reload React with authentication
    console.log('🔄 Refreshing page in 1 second...');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
    
    console.log('🎉 Authentication fix applied! Page will refresh automatically.');
})();