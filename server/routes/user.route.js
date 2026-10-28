import express from 'express';
import { getUserInfo, login, logout, register, searchUser, updateAvatar } from '../controllers/user.controller.js';
import upload from '../config/multer.js';
import protect from '../middleware/auth.middleware.js';
import { createAuthLimiter } from '../middleware/rate-limit.js';

const router = express.Router();
const authLimiter = createAuthLimiter();
router.get('/me', protect, getUserInfo);
router.get('/search', protect, searchUser);
router.patch('/me/avatar', protect, upload.single('avatar'), updateAvatar);
router.post('/signup', authLimiter, upload.single('avatar'), register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
export default router;
