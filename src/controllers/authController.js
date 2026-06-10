const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const JWTUtils = require('../utils/jwtUtils');

class AuthController {
  static async login(req, res) {
    try {
      const { username, password } = req.body;      
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required.'
        });
      }

      // Find user by username or email
      const user = await User.findOne({
        $or: [
          { username: username.toLowerCase() },
          { email: username.toLowerCase() }
        ]
      });

      if (!user) {
        await AuditLog.create({
          action: 'login',
          description: `Failed login attempt for username: ${username}`,
          userId: null,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username }
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is deactivated. Please contact administrator.'
        });
      }

      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        await AuditLog.create({
          action: 'login',
          description: `Failed login attempt for user: ${user.username}`,
          userId: user._id,
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          status: 'failed',
          metadata: { username: user.username }
        });

        return res.status(401).json({
          success: false,
          message: 'Invalid credentials.'
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate token
      const token = JWTUtils.generateToken(user);

      // Log successful login
      await AuditLog.create({
        action: 'login',
        description: `User ${user.username} logged in successfully`,
        userId: user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success',
        metadata: { role: user.role }
      });

      res.json({
        success: true,
        message: 'Login successful.',
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullName: user.fullName,
            lastLogin: user.lastLogin
          }
        }
      });

    } catch (error) {
      logger.error('Login error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error during login.'
      });
    }
  }

  static async getProfile(req, res) {
    try {
      res.json({
        success: true,
        data: {
          user: req.user
        }
      });
    } catch (error) {
      logger.error('Get profile error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await User.findById(req.user._id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      const isCurrentPasswordValid = await user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      user.password = newPassword;
      await user.save();

      await AuditLog.create({
        action: 'update_user',
        description: `User ${user.username} changed password`,
        userId: user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Password changed successfully.'
      });

    } catch (error) {
      logger.error('Change password error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error.'
      });
    }
  }

  static async logout(req, res) {
    try {
      await AuditLog.create({
        action: 'logout',
        description: `User ${req.user.username} logged out`,
        userId: req.user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success'
      });

      res.json({
        success: true,
        message: 'Logout successful.'
      });
    } catch (error) {
      logger.error('Logout error:', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        message: 'Internal server error during logout.'
      });
    }
  }
}

module.exports = AuthController;