import express from 'express'
import protect from '../middleware/auth.middleware.js';
import { createGroupChat, createPersonalChat, getConversation, getParticipants, updateConversation, deleteConversation, markConversationRead } from '../controllers/conversation.controller.js';

const router = express.Router();

router.get('/', protect , getConversation)
router.post('/group', protect , createGroupChat); 
router.post('/', protect, createPersonalChat);
router.get('/:id', protect, getParticipants);
router.put('/:id', protect, updateConversation);
router.delete('/:id', protect, deleteConversation);
router.post('/:id/read', protect, markConversationRead);

export default router;
