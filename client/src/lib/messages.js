export const conversationIdOf = (message) =>
  typeof message.conversation === 'object' ? message.conversation?._id : message.conversation;

export function mergeMessages(existing = [], incoming = []) {
  const byId = new Map(existing.map((message) => [message._id, message]));
  incoming.forEach((message) => {
    if (message?._id) byId.set(message._id, message);
  });
  return [...byId.values()].sort((a, b) =>
    new Date(a.createdAt) - new Date(b.createdAt) || String(a._id).localeCompare(String(b._id)));
}
