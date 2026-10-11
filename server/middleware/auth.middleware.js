import jwt from 'jsonwebtoken'
import asyncHandler from 'express-async-handler'
import User from '../models/user.model.js';

const protect = asyncHandler(async(req, res, next)=>{
    const token = req.cookies?.token;
    if(!token){
        return res.status(401).json({
            message : "Access token is missing"
        })
    }
    let decodedToken;
    try {
        decodedToken = jwt.verify(token , process.env.JWT_SECRET_KEY);
    }
    catch {
        return res.status(401).json({
            message : 'Invalid Token'
        })
    }
    // Database failures must not masquerade as expired authentication.
    req.user = await User.findById(decodedToken._id).select('-password');
    if (!req.user) {
        return res.status(401).json({ message: 'User no longer exists' });
    }
    next();
})

export default protect;
