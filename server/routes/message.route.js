import express from 'express'
import protect from '../middleware/auth.middleware.js';
import { createMessage, getMessage } from '../controllers/message.controller.js';

const router = express.Router();
// get messages for conversation and create message

router.get('/:conversationId', protect, getMessage);
router.post('/:conversationId', protect, createMessage);

export default router;