import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';
import { summaryPopulation, idOf, membershipOf, visibleMessages, afterPosition } from './conversations.js';
import { personalRoom, conversationRoom } from '../socket/socket.js';

export async function recipientSummary(conversation, userId) {
    const summary = conversation.toObject ? conversation.toObject() : { ...conversation };
    const member = membershipOf(conversation, userId);
    const visible = visibleMessages(conversation, userId);
    const [latestMessage, unreadCount] = await Promise.all([
        Message.findOne(visible).sort({ createdAt: -1, _id: -1 }).populate('sender', '-password'),
        Message.countDocuments({ $and: [visible, { sender: { $ne: userId }, deletedAt: null },
            ...(member?.readAt && member.readMessageId ? [afterPosition(member.readAt, member.readMessageId)] : [])] }),
    ]);
    summary.latestMessage = latestMessage;
    summary.unreadCount = unreadCount;
    summary.joinedAt = member?.joinedAt || new Date(0);
    summary.joinedAfterMessageId = member?.joinedAfterMessageId || null;
    delete summary.memberships;
    if (!summary.isGroup) {
        summary.conversationName = summary.participants.find(user => idOf(user) !== idOf(userId))?.username || 'Unknown User';
    }
    return summary;
}

// Called only after successful writes, while holding the conversation lock.
export async function publishConversation(io, id, { previousParticipants = [], event, message, savedConversation } = {}) {
    if (!io) return;
    const conversation = savedConversation || await Conversation.findById(id);
    const current = conversation && !conversation.deletedAt ? conversation.participants.map(idOf) : [];
    for (const userId of previousParticipants.map(idOf)) {
        if (current.includes(userId)) continue;
        io.in(personalRoom(userId)).socketsLeave(conversationRoom(id));
        io.to(personalRoom(userId)).emit('conversation removed', { conversationId: String(id) });
    }
    if (current.length) await conversation.populate(summaryPopulation);
    for (const userId of current) {
        const summary = await recipientSummary(conversation, userId);
        io.to(personalRoom(userId)).emit('conversation updated', { conversation: summary });
        if (event && await Message.exists({ $and: [visibleMessages(conversation, userId), { _id: message._id }] })) {
            const data = message.toObject ? message.toObject() : message;
            io.to(personalRoom(userId)).emit(event, { ...data, conversationSummary: summary });
        }
    }
}
