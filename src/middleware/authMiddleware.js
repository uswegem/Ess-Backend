const logger = require('../utils/logger');
const JWTUtils = require('../utils/jwtUtils');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const decoded = JWTUtils.verifyToken(token);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. User not found.'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

const roleMiddleware = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

const auditMiddleware = async (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Store original headers
    const contentType = res.get('Content-Type');
    
    // Call original send and maintain chain
    const result = originalSend.call(this, data);
    
    // Log the action after response is sent
    if (req.user) {
      const auditLog = new AuditLog({
        action: getActionFromRoute(req),
        description: `${req.user.role} ${req.user.username} performed ${req.method} on ${req.path}`,
        userId: req.user._id,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        resource: req.path,
        method: req.method,
        status: res.statusCode >= 400 ? 'failed' : 'success',
        metadata: {
          statusCode: res.statusCode,
          userAgent: req.get('User-Agent'),
          contentType: contentType
        }
      });
      
      auditLog.save().catch(err => logger.error('Error saving audit log', { error: err.message }));
    }
    
    return result;
  };
  
  next();
};

function getActionFromRoute(req) {
  const path = req.path;
  const method = req.method;
  
  if (path.includes('/auth/login')) return 'login';
  if (path.includes('/auth/logout')) return 'logout';
  if (path.includes('/users') && method === 'POST') return 'create_user';
  if (path.includes('/users') && method === 'PUT') return 'update_user';
  if (path.includes('/users') && method === 'DELETE') return 'delete_user';
  if (path.includes('/emkopo')) return 'api_call';
  
  return 'system_event';
}

module.exports = {
  authMiddleware,
  roleMiddleware,
  auditMiddleware
};