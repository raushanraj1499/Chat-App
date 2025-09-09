import jwt from 'jsonwebtoken'
import asyncHandler from 'express-async-handler'
import User from '../models/user.model.js';

const protect = asyncHandler(async(req, res, next)=>{
    console.log(req.cookies);
    const token = req.cookies?.token;
    if(!token){
        return res.status(401).json({
            message : "Access token is missing"
        })
    }
    try {
        const decodedToken = jwt.verify(token , process.env.JWT_SECRET_KEY);
        req.user = await User.findById(decodedToken._id).select('-password');
        next();
    }
    catch(err){
        console.log(err);
        return res.status(401).json({
            message : 'Invalid Token'
        })
    }
})  

export default protect;