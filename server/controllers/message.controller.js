import Message from '../models/message.model.js';
import Conversation from '../models/conversation.model.js';
import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { objectId, textValue } from '../utils/validation.js';
import { idOf, requireConversation, withConversationLock, visibleMessages } from '../utils/conversations.js';
import { publishConversation, recipientSummary } from '../utils/live-updates.js';

export const createMessage = asyncHandler(async (req, res) => {
    const id = objectId(req.params.conversationId, 'conversation ID');
    const content = textValue(req.body?.content, 'content');
    await withConversationLock(id, async () => {
        await requireConversation(id, req.user._id);
        const message = await Message.create({ content, sender: req.user._id, conversation: id });
        const saved = await Conversation.findByIdAndUpdate(id, { latestMessage: message._id, $inc: { revision: 1 } }, { new: true });
        await message.populate('sender', '-password');
        await publishConversation(req.app.get('io'), id, { event: 'new message', message });
        await saved.populate('participants', '-password');
        const summary = await recipientSummary(saved, req.user._id);
        res.status(201).json({ message: 'Message created successfully', data: { ...message.toObject(), conversationSummary: summary } });
    });
});

export const getMessage = asyncHandler(async (req, res) => {
    const id = objectId(req.params.conversationId, 'conversation ID');
    await withConversationLock(id, async () => {
        const conversation = await requireConversation(id, req.user._id);
        const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new ApiError(400, 'limit must be between 1 and 50');
        const filters = [visibleMessages(conversation, req.user._id)];
        if (req.query.before !== undefined) {
            const cursorId = objectId(req.query.before, 'history cursor');
            const cursor = await Message.findOne({ $and: [...filters, { _id: cursorId }] });
            if (!cursor) throw new ApiError(400, 'Invalid history cursor');
            filters.push({ $or: [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }] });
        }
        const page = await Message.find({ $and: filters }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).populate('sender', '-password');
        const hasMore = page.length > limit;
        const messages = page.slice(0, limit).reverse();
        res.json({ message: 'Messages fetched successfully', messages, nextCursor: hasMore ? idOf(messages[0]) : null });
    });
});

async function mutateMessage(req, res, deleting) {
    const id = objectId(req.params.conversationId, 'conversation ID');
    const messageId = objectId(req.params.messageId, 'message ID');
    const content = deleting ? null : textValue(req.body?.content, 'content');
    await withConversationLock(id, async () => {
        const conversation = await requireConversation(id, req.user._id);
        const message = await Message.findOne({ $and: [visibleMessages(conversation, req.user._id), { _id: messageId }] });
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
        await conversation.save({ timestamps: false });
        await message.populate('sender', '-password');
        await publishConversation(req.app.get('io'), id, { event: deleting ? 'message deleted' : 'message updated', message });
        await conversation.populate('participants', '-password');
        const summary = await recipientSummary(conversation, req.user._id);
        res.json({ message: deleting ? 'Message deleted successfully' : 'Message updated successfully', data: { ...message.toObject(), conversationSummary: summary } });
    });
}
export const editMessage = asyncHandler((req, res) => mutateMessage(req, res, false));
export const deleteMessage = asyncHandler((req, res) => mutateMessage(req, res, true));
