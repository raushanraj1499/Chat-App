import User from "../models/user.model.js"
import asyncHandler from "express-async-handler"
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from "cloudinary";
import { runtimeConfig } from '../config/runtime.js';
import { textValue } from '../utils/validation.js';
import { personalRoom } from '../socket/socket.js';

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET
})

const authCookieOptions = () => ({ ...runtimeConfig().cookie, maxAge: 24 * 60 * 60 * 1000 });

const uploadAvatar = (buffer) => new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
        { resource_type: 'image' },
        (error, result) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(result);
        }
    );

    uploadStream.end(buffer);
});

const login = asyncHandler( async(req, res)=>{
    const email = textValue(req.body?.email, 'email', 254);
    const password = req.body?.password;
    textValue(password, 'password', 72);
    const user =await User.findOne({email : email})
    if(!user){
        return res.status(400).json({
            success: false, message: "Invalid email or password"
        })
    }
    const isMatch = await user.isPasswordCorrect(password);
    if(!isMatch){
        return res.status(400).json({
            success: false, message: "Invalid email or password"
        })
    }
    const SECRET = process.env.JWT_SECRET_KEY;
    const token = jwt.sign({_id : user._id},SECRET, {
        expiresIn : '1d'
    } )

    return res.status(200)
    .cookie('token', token, authCookieOptions())
    .json({
        message : 'Logged in successfully',
        user: {
            _id : user._id,
            username : user.username,
            email : user.email,
            avatar : user.avatar
        }
    })
})

const logout = asyncHandler(async(req, res)=>{
    const io = req.app.get('io');
    if (io && req.cookies?.token) {
        try {
            const claims = jwt.verify(req.cookies.token, process.env.JWT_SECRET_KEY, { algorithms: ['HS256'] });
            const sockets = await io.in(personalRoom(claims._id)).fetchSockets();
            for (const socket of sockets) if (socket.sessionToken === req.cookies.token) {
                socket.emit('unauthorized', { message: 'Logged out' });
                socket.disconnect(true);
            }
        } catch { /* Clearing an invalid or expired cookie still succeeds. */ }
    }
    return res.status(200)
    .clearCookie('token', runtimeConfig().cookie)
    .json({
        message: 'Logged out successfully'
    })
})

const register = asyncHandler(async(req, res)=>{
    const username = textValue(req.body?.username, 'username', 100);
    const email = textValue(req.body?.email, 'email', 254);
    const password = req.body?.password;
    textValue(password, 'password', 72);
    const avatar = req.body?.avatar;
    if (avatar !== undefined && typeof avatar !== 'string') {
        return res.status(400).json({ success: false, message: 'avatar must be a string' });
    }
    let url = avatar;
    const userExists =await User.findOne({email:email});
    if(userExists){
        return res.status(400).json({
            message : "User already exists",
            success : false
        })
    }

    if(req.file?.buffer){
        const imageOnCloudinary = await uploadAvatar(req.file.buffer);
        url = imageOnCloudinary.secure_url;
    }

    // new + save or create
    const user = await User.create({
        username : username, 
        email : email,
        password : password, 
        avatar : url
    })

    return res.status(201)
    .json({
        message: 'User created successfully',
        user : {
            _id : user._id,
            username : user.username,
            email : user.email,
            avatar : user.avatar
        }
    })
})

const searchUser = asyncHandler(async(req,res)=>{
    const username = textValue(req.query.q, 'q', 100);
    const escapedUsername = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const users = await User.find({
        _id: { $ne: req.user._id },
        username: { $regex: `^${escapedUsername}$`, $options: 'i' },
    }).select('-password').sort({ username: 1, _id: 1 }).limit(20);
    return res.status(200).json({
        users
    })
})

const getUserInfo = asyncHandler(async(req,res)=>{
    const userInfo = req.user;
    return res.status(200).json({
        username : userInfo.username,
        _id : userInfo._id,
        email : userInfo.email,
        avatar : userInfo.avatar
    })
})

export {
    login,
    logout,
    register,
    searchUser,
    getUserInfo
}
