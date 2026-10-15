import asyncHandler from 'express-async-handler';
import Conversation from '../models/conversation.model.js';
import User from '../models/user.model.js';
import { ApiError } from '../utils/ApiError.js';
import { idList, objectId, textValue } from '../utils/validation.js';
import { idOf, requireConversation, summaryPopulation, withConversationLock } from '../utils/conversations.js';
import { publishConversation, recipientSummary } from '../utils/live-updates.js';

async function requireUsers(ids) {
    const count = await User.countDocuments({ _id: { $in: ids } });
    if (count !== ids.length) throw new ApiError(404, 'One or more users do not exist');
}

export const createGroupChat = asyncHandler(async (req, res) => {
    const conversationName = textValue(req.body?.conversationName, 'conversationName', 100);
    const participants = [...new Set([...idList(req.body?.participants), idOf(req.user)])];
    if (participants.length < 2) throw new ApiError(400, 'A group needs at least two distinct users');
    await requireUsers(participants);
    const conversation = await Conversation.create({ conversationName, participants, isGroup: true, groupAdmin: req.user._id });
    await conversation.populate(summaryPopulation);
    await publishConversation(req.app.get('io'), conversation._id);
    res.status(201).json({ message: 'Group created successfully', conversation });
});

export const createPersonalChat = asyncHandler(async (req, res) => {
    const participants = idList(req.body?.participants);
    if (participants.length !== 1 || participants[0] === idOf(req.user)) {
        throw new ApiError(400, 'Supply exactly one other user');
    }
    const otherUser = await User.findById(participants[0]);
    if (!otherUser) throw new ApiError(404, 'User not found');
    const pair = [idOf(req.user), participants[0]].sort();
    await withConversationLock(`direct:${pair.join(':')}`, async () => {
        let conversation = await Conversation.findOne({
            isGroup: false, deletedAt: null, participants: { $all: pair, $size: 2 },
        });
        const existing = Boolean(conversation);
        if (!conversation) conversation = await Conversation.create({
            isGroup: false, participants: pair, conversationName: otherUser.username,
        });
        await conversation.populate(summaryPopulation);
        if (!existing) await publishConversation(req.app.get('io'), conversation._id);
        res.status(existing ? 200 : 201).json({
            message: existing ? 'Conversation found' : 'Personal Chat created',
            conversation: recipientSummary(conversation, req.user._id),
        });
    });
});

export const getConversation = asyncHandler(async (req, res) => {
    const conversations = await Conversation.find({ participants: req.user._id, deletedAt: null })
        .sort({ updatedAt: -1, _id: -1 }).populate(summaryPopulation);
    res.json({ message: 'Conversations fetched', conversations: conversations.map(c => recipientSummary(c, req.user._id)) });
});

export const getParticipants = asyncHandler(async (req, res) => {
    const conversation = await requireConversation(req.params.id, req.user._id);
    await conversation.populate('participants', '-password');
    res.json({ message: 'Participants got successfully', participants: { _id: conversation._id, participants: conversation.participants } });
});

function requireAdmin(conversation, userId) {
    if (idOf(conversation.groupAdmin) !== idOf(userId)) throw new ApiError(403, 'Group administrator required');
}

export const updateConversation = asyncHandler(async (req, res) => {
    const id = objectId(req.params.id, 'conversation ID');
    const { operation, data } = req.body || {};
    if (!['rename', 'addMembers', 'removeMember', 'transferAdmin', 'leave'].includes(operation)) {
        throw new ApiError(400, 'Unknown conversation operation');
    }
    if (operation !== 'leave' && (!data || Array.isArray(data) || typeof data !== 'object')) {
        throw new ApiError(400, 'data must be an object');
    }
    await withConversationLock(id, async () => {
        const conversation = await requireConversation(id, req.user._id);
        if (!conversation.isGroup) throw new ApiError(400, 'This operation requires a group');
        const previousParticipants = conversation.participants.map(idOf);
        const userId = idOf(req.user);
        if (operation === 'rename') conversation.conversationName = textValue(data.conversationName, 'conversationName', 100);
        if (operation === 'addMembers') {
            const ids = idList(data.participants);
            await requireUsers(ids);
            conversation.participants = [...new Set([...previousParticipants, ...ids])];
        }
        if (operation === 'removeMember' || operation === 'transferAdmin') {
            requireAdmin(conversation, userId);
            const target = objectId(data.userId, 'user ID');
            if (!previousParticipants.includes(target)) throw new ApiError(400, 'User is not a member');
            if (operation === 'removeMember') {
                if (target === userId) throw new ApiError(400, 'Use leave to leave the group');
                conversation.participants = previousParticipants.filter(id => id !== target);
            } else {
                await requireUsers([target]);
                conversation.groupAdmin = target;
            }
        }
        if (operation === 'leave') {
            if (idOf(conversation.groupAdmin) === userId) {
                throw new ApiError(400, previousParticipants.length > 1 ? 'Transfer administration before leaving' : 'Delete the group instead');
            }
            conversation.participants = previousParticipants.filter(id => id !== userId);
        }
        await conversation.save();
        await publishConversation(req.app.get('io'), id, { previousParticipants, savedConversation: conversation });
        // Departed users receive no current group details in the HTTP response.
        if (!conversation.participants.some(id => idOf(id) === userId)) {
            return res.json({ message: 'Left group', conversationId: id });
        }
        await conversation.populate(summaryPopulation);
        res.json({ message: 'Conversation updated', conversation });
    });
});

export const deleteConversation = asyncHandler(async (req, res) => {
    const id = objectId(req.params.id, 'conversation ID');
    await withConversationLock(id, async () => {
        const conversation = await requireConversation(id, req.user._id);
        if (!conversation.isGroup) throw new ApiError(400, 'Only groups can be deleted');
        requireAdmin(conversation, req.user._id);
        const previousParticipants = conversation.participants.map(idOf);
        conversation.deletedAt = new Date();
        await conversation.save();
        await publishConversation(req.app.get('io'), id, { previousParticipants, savedConversation: conversation });
        res.json({ message: 'Conversation deleted', conversationId: id });
    });
});
