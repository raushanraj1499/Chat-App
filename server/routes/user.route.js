import express from 'express'
import { getUserInfo, login, logout, register , searchUser} from '../controllers/user.controller.js'
import upload from '../config/multer.js';
import protect from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/test', (req, res)=>{
    console.log("test route");
    console.log(req.body);
    console.log(req.method);
    console.log(req.url);
    res.status(200).json({
        message : "test route is working"
    })
})

router.get('/me', protect,getUserInfo );
router.get('/search', protect , searchUser);
router.post('/signup',upload.single('avatar'), register);
router.post('/login',login);
router.post('/logout',logout);

export default router