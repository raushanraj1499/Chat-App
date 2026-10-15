export const conversationIdOf = (message) =>
  typeof message.conversation === 'object' ? message.conversation?._id : message.conversation;

export function mergeMessages(existing = [], incoming = []) {
  const byId = new Map(existing.map((message) => [message._id, message]));
  incoming.forEach((message) => {
    if (!message?._id) return;
    const current = byId.get(message._id);
    // A history response that started before an edit must not undo that event.
    if (current && new Date(current.updatedAt || current.createdAt) >
        new Date(message.updatedAt || message.createdAt)) return;
    if (current?.deletedAt && !message.deletedAt) return;
    byId.set(message._id, message);
  });
  return [...byId.values()].sort((a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)));
}
