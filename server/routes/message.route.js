import express from 'express'
import protect from '../middleware/auth.middleware.js';
import { createMessage, getMessage, editMessage, deleteMessage } from '../controllers/message.controller.js';

const router = express.Router();
// get messages for conversation and create message

router.get('/:conversationId', protect, getMessage);
router.post('/:conversationId', protect, createMessage);
router.patch('/:conversationId/:messageId', protect, editMessage);
router.delete('/:conversationId/:messageId', protect, deleteMessage);

export default router;
