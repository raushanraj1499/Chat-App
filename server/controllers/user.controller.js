import User from "../models/user.model.js"
import asyncHandler from "express-async-handler"
import jwt from 'jsonwebtoken';
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name : process.env.CLOUDINARY_CLOUD_NAME,
    api_key : process.env.CLOUDINARY_API_KEY,
    api_secret : process.env.CLOUDINARY_API_SECRET
})

const login = asyncHandler( async(req, res)=>{
    const {email , password} = req.body;
    const user =await User.findOne({email : email})
    if(!user){
        return res.status(400).json({
            message : "User does not exist"
        })
    }
    const isMatch = await user.isPasswordCorrect(password);
    if(!isMatch){
        return res.status(400).json({
            message : "Password is incorrect"
        })
    }
    const SECRET = process.env.JWT_SECRET_KEY;
    const token = jwt.sign({_id : user._id},SECRET, {
        expiresIn : '1d'
    } )

    return res.status(200)
    .cookie('token', token, {
        httpOnly : true,
        sameSite : 'strict',
        maxAge : 24*60*60*1000
    })
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
    return res.status(200)
    .clearCookie('token',{
        httpOnly: true
    })
    .json({
        message: 'Logged out successfully'
    })
})

const register = asyncHandler(async(req, res)=>{
    console.log("i'm here");
    const {username, email , password, avatar} = req.body;
    console.log(req.body);
    console.log(req.file);
    let url = avatar;
    const originalPath = req.file?.path;
    if(originalPath){
        const uploadOnCloudinary = asyncHandler(async(originalPath)=>{
            const image = await cloudinary.uploader.upload(originalPath);
            return image;
        })
        const imageOnCloudinary = await uploadOnCloudinary(originalPath);
        console.log(imageOnCloudinary);
        url = imageOnCloudinary.secure_url;
    }

    const userExists =await User.findOne({email:email});
    if(userExists){
        return res.status(400).json({
            message : "User already exists",
            success : false
        })
    }

    if(!username || !email || !password){
        return res.status(200).json({
            message : "Give all credentials",
            success : false
        })
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
    const username = req.query.q;
    if(!username){
        return res.status(400).json({
            message : "Empty username doesn't exist"
        })
    }
    const users = await User.find({
        username
    }).select('-password');
    
    if(users.length == 0){
        return res.status(400).json({
            message : "No user found"
        })
    }
    return res.status(200).json({
        users
    })
})

const getUserInfo = asyncHandler(async(req,res)=>{
    const user = req.user._id;

    const userInfo = await User.findById(user).select("-password");
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