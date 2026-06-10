const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Only admins and super admins can access user management
router.get('/', roleMiddleware(['super_admin', 'admin']), UserController.getUsers);
router.get('/:id', roleMiddleware(['super_admin', 'admin']), UserController.getUserById);
router.post('/', roleMiddleware(['super_admin', 'admin']), UserController.createUser);
router.put('/:id', roleMiddleware(['super_admin', 'admin']), UserController.updateUser);
router.delete('/:id', roleMiddleware(['super_admin', 'admin']), UserController.deleteUser);

module.exports = router;