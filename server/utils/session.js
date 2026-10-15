import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import { ApiError } from './ApiError.js';
import { objectId } from './validation.js';

export async function authenticateToken(token) {
    let claims;
    try {
        if (typeof token !== 'string') throw new Error();
        claims = jwt.verify(token, process.env.JWT_SECRET_KEY, { algorithms: ['HS256'] });
        objectId(claims._id, 'token subject');
        if (!Number.isFinite(claims.exp)) throw new Error();
    } catch {
        throw new ApiError(401, 'Authentication failed');
    }
    const user = await User.findById(claims._id).select('-password');
    if (!user) throw new ApiError(401, 'User no longer exists');
    return { user, expiresAt: claims.exp * 1000 };
}
