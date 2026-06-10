const mongoose = require('mongoose');
const User = require('./src/models/User');
const dotenv = require('dotenv');
dotenv.config();

async function createAdminUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ess', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        console.log('Connected to MongoDB');
        
        // Check if admin user already exists
        const existingAdmin = await User.findOne({
            $or: [
                { email: 'admin@miracore.com' },
                { username: 'admin' }
            ]
        });
        
        if (existingAdmin) {
            console.log('Admin user already exists:', existingAdmin.email);
            process.exit(0);
        }
        
        // Create admin user
        const adminUser = new User({
            username: 'admin',
            email: 'admin@miracore.com',
            password: 'admin123', // This will be hashed automatically
            fullName: 'Admin User',
            role: 'super_admin',
            isActive: true
        });
        
        await adminUser.save();
        console.log('✅ Admin user created successfully!');
        console.log('Email: admin@miracore.com');
        console.log('Password: admin123');
        
        process.exit(0);
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
}

createAdminUser();