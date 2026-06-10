// Direct authentication fix for admin panel
console.log('🔧 Quick Admin Fix Starting...');

const authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2OGZiNzYzNjhhNDJkMzljNTllZTUwODciLCJ1c2VybmFtZSI6InN1cGVyYWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5AZW1rb3BvLnR6Iiwicm9sZSI6InN1cGVyX2FkbWluIiwiaWF0IjoxNzY1NjEwMDEzLCJleHAiOjE3NjYyMTQ4MTMsImlzcyI6ImVta29wby1iYWNrZW5kIiwic3ViIjoiNjhmYjc2MzY4YTQyZDM5YzU5ZWU1MDg3In0.qmAptFBIAe44qh5DZUvAHM9eO9bfce0z9q997relHxI';

localStorage.setItem('token', authToken);
localStorage.setItem('authToken', authToken);
localStorage.setItem('user', JSON.stringify({
    id: '68fb76368a42d39c59ee5087',
    username: 'superadmin',
    email: 'superadmin@emkopo.tz',
    role: 'super_admin',
    fullName: 'System Super Administrator'
}));

console.log('✅ Authentication tokens set!');
window.location.reload();