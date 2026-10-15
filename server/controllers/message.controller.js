import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { objectId, textValue } from '../utils/validation.js';
import { idOf, requireConversation, withConversationLock } from '../utils/conversations.js';
import { publishConversation } from '../utils/live-updates.js';

export const createMessage = asyncHandler(async (req, res) => {
    const id = objectId(req.params.conversationId, 'conversation ID');
    const content = textValue(req.body?.content, 'content');
    await withConversationLock(id, async () => {
        await requireConversation(id, req.user._id);
        const message = await Message.create({ content, sender: req.user._id, conversation: id });
        await Conversation.findByIdAndUpdate(id, { latestMessage: message._id });
        await message.populate('sender', '-password');
        await publishConversation(req.app.get('io'), id, { event: 'new message', message });
        res.status(201).json({ message: 'Message created successfully', data: message });
    });
});

export const getMessage = asyncHandler(async (req, res) => {
    const id = objectId(req.params.conversationId, 'conversation ID');
    await requireConversation(id, req.user._id);
    const messages = await Message.find({ conversation: id }).sort({ createdAt: 1, _id: 1 }).populate('sender', '-password');
    res.json({ message: 'Messages fetched successfully', messages });
});

async function mutateMessage(req, res, deleting) {
    const id = objectId(req.params.conversationId, 'conversation ID');
    const messageId = objectId(req.params.messageId, 'message ID');
    const content = deleting ? null : textValue(req.body?.content, 'content');
    await withConversationLock(id, async () => {
        await requireConversation(id, req.user._id);
        const message = await Message.findOne({ _id: messageId, conversation: id });
        if (!message) throw new ApiError(404, 'Message not found');
        if (idOf(message.sender) !== idOf(req.user)) throw new ApiError(403, 'You can only change your own messages');
        if (message.deletedAt && !deleting) throw new ApiError(400, 'Deleted messages cannot be edited');
        if (deleting) {
            message.content = '';
            message.deletedAt ||= new Date();
        } else {
            message.content = content;
            message.isEdited = true;
        }
        await message.save();
        await message.populate('sender', '-password');
        await publishConversation(req.app.get('io'), id, { event: deleting ? 'message deleted' : 'message updated', message });
        res.json({ message: deleting ? 'Message deleted successfully' : 'Message updated successfully', data: message });
    });
}
export const editMessage = asyncHandler((req, res) => mutateMessage(req, res, false));
export const deleteMessage = asyncHandler((req, res) => mutateMessage(req, res, true));
