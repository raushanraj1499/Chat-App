import asyncHandler from 'express-async-handler';
import { authenticateToken } from '../utils/session.js';

const protect = asyncHandler(async (req, res, next) => {
    try {
        const { user } = await authenticateToken(req.cookies?.token);
        req.user = user;
        next();
    } catch (error) {
        if (error.statusCode === 401) return res.status(401).json({ success: false, message: error.message });
        throw error;
    }
});
export default protect;
