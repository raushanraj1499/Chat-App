import Conversation from '../models/conversation.model.js';
import { summaryPopulation, idOf } from './conversations.js';
import { personalRoom, conversationRoom } from '../socket/socket.js';

export function recipientSummary(conversation, userId) {
    const summary = conversation.toObject ? conversation.toObject() : { ...conversation };
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
        const summary = recipientSummary(conversation, userId);
        io.to(personalRoom(userId)).emit('conversation updated', { conversation: summary });
        if (event) {
            const data = message.toObject ? message.toObject() : message;
            io.to(personalRoom(userId)).emit(event, { ...data, conversationSummary: summary });
        }
    }
}
