const logger = require('../utils/logger');
const User = require('../models/User');
const TenantUser = require('../models/TenantUser');
const AuditLog = require('../models/AuditLog');
const { createTenantUser } = require('../services/tenantUserService');

class UserController {
  static async createUser(req, res) {
    try {
      const { username, email, password, role, fullName, phone, tenantId, tenantRole } = req.body;

      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [{ username }, { email }]
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this username or email already exists.'
        });
      }

      // Role restrictions
      if (role === 'super_admin' && req.user.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Only super admin can create super admin users.'
        });
      }

      const newUser = new User({
        username,
        email,
        password,
        role: role || 'user',
        fullName,
        phone,
        createdBy: req.user._id
      });

      await newUser.save();

      const resolvedTenantId = tenantId || req.tenant?.tenantId;
      if (resolvedTenantId && tenantRole) {
        await createTenantUser(resolvedTenantId, {
          email: newUser.email,
          fullName: newUser.fullName,
          role: tenantRole,
          username: newUser.username,
          phone: newUser.phone
        }, req.user._id);
      }

      await AuditLog.create({
        action: 'create_user',
        description: `User ${req.user.username} created new user: ${username} with role: ${newUser.role}`,
        userId: req.user._id,
        tenantId: resolvedTenantId,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success',
        metadata: { createdUserId: newUser._id, role: newUser.role, tenantRole }
      });

      res.status(201).json({
        success: true,
        message: 'User created successfully.',
        data: { user: newUser }
      });

    } catch (error) {
      logger.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while creating user.'
      });
    }
  }

  static async getUsers(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      let filter = {};
      if (req.tenant?.tenantId && !req.authContext?.isSuperAdmin && req.user?.role !== 'admin') {
        const memberships = await TenantUser.find({ tenantId: req.tenant.tenantId, isActive: true }).select('userId');
        filter._id = { $in: memberships.map((m) => m.userId) };
      }

      const users = await User.find(filter)
        .select('-password')
        .populate('createdBy', 'username fullName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const total = await User.countDocuments(filter);

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });

    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching users.'
      });
    }
  }

  static async getUserById(req, res) {
    try {
      const user = await User.findById(req.params.id)
        .select('-password')
        .populate('createdBy', 'username fullName');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      logger.error('Get user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while fetching user.'
      });
    }
  }

  static async updateUser(req, res) {
    try {
      const { fullName, phone, role, isActive } = req.body;
      const userId = req.params.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      // Prevent users from modifying their own role/status
      if (userId === req.user._id.toString() && (role || isActive !== undefined)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot modify your own role or status.'
        });
      }

      // Role modification restrictions
      if (role && role !== user.role) {
        if (role === 'super_admin' && req.user.role !== 'super_admin') {
          return res.status(403).json({
            success: false,
            message: 'Only super admin can assign super admin role.'
          });
        }

        if (user.role === 'super_admin' && req.user._id.toString() !== userId) {
          return res.status(403).json({
            success: false,
            message: 'Cannot modify super admin user.'
          });
        }
      }

      // Update fields
      if (fullName) user.fullName = fullName;
      if (phone) user.phone = phone;
      if (role) user.role = role;
      if (isActive !== undefined) user.isActive = isActive;

      await user.save();

      await AuditLog.create({
        action: 'update_user',
        description: `User ${req.user.username} updated user: ${user.username}`,
        userId: req.user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success',
        metadata: { updatedUserId: user._id, changes: req.body }
      });

      res.json({
        success: true,
        message: 'User updated successfully.',
        data: { user }
      });

    } catch (error) {
      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while updating user.'
      });
    }
  }

  static async deleteUser(req, res) {
    try {
      const userId = req.params.id;

      if (userId === req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You cannot delete your own account.'
        });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found.'
        });
      }

      if (user.role === 'super_admin') {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete super admin user.'
        });
      }

      await User.findByIdAndDelete(userId);

      await AuditLog.create({
        action: 'delete_user',
        description: `User ${req.user.username} deleted user: ${user.username}`,
        userId: req.user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        status: 'success',
        metadata: { deletedUserId: user._id, deletedUsername: user.username }
      });

      res.json({
        success: true,
        message: 'User deleted successfully.'
      });

    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error while deleting user.'
      });
    }
  }
}

module.exports = UserController;