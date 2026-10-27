import Conversation from '../models/conversation.model.js';
import { ApiError } from './ApiError.js';
import { objectId } from './validation.js';

export const idOf = value => String(value?._id || value);
export const isMember = (conversation, userId) => !conversation.deletedAt &&
    conversation.participants.some(participant => idOf(participant) === idOf(userId));

export const membershipOf = (conversation, userId) =>
    conversation.memberships?.find(member => idOf(member.user) === idOf(userId));

// Legacy members keep their complete history until explicit metadata is saved.
export function visibleMessages(conversation, userId) {
    const member = membershipOf(conversation, userId);
    const conditions = [{ conversation: conversation._id }];
    if (member?.joinedAt) conditions.push({ $or: [
        { createdAt: { $gt: member.joinedAt } },
        { createdAt: member.joinedAt, ...(member.joinedAfterMessageId ? { _id: { $gt: member.joinedAfterMessageId } } : {}) },
    ] });
    return { $and: conditions };
}

export function afterPosition(date, id) {
    return { $or: [{ createdAt: { $gt: date } }, { createdAt: date, _id: { $gt: id } }] };
}

export function ensureMemberships(conversation) {
    for (const user of conversation.participants) {
        if (!membershipOf(conversation, user)) conversation.memberships.push({ user: idOf(user), joinedAt: new Date(0) });
    }
}

export async function requireConversation(id, userId) {
    objectId(id, 'conversation ID');
    const conversation = await Conversation.findById(id);
    if (!conversation || conversation.deletedAt) throw new ApiError(404, 'Conversation not found');
    if (!isMember(conversation, userId)) throw new ApiError(403, 'Conversation membership required');
    return conversation;
}

export const summaryPopulation = [
    { path: 'participants', select: '-password' },
    { path: 'latestMessage', populate: { path: 'sender', select: '-password' } },
];

// Serialize writes and room operations in the default single-process deployment.
const pending = new Map();
export async function withConversationLock(id, operation) {
    const key = String(id);
    const previous = pending.get(key) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    pending.set(key, current);
    await previous;
    try { return await operation(); }
    finally {
        release();
        if (pending.get(key) === current) pending.delete(key);
    }
}
