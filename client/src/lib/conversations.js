export function sortConversations(conversations) {
  return [...conversations].sort((a, b) =>
    new Date(b.updatedAt || b.latestMessage?.createdAt || 0) -
    new Date(a.updatedAt || a.latestMessage?.createdAt || 0));
}

export function mergeConversations(existing, incoming) {
  const byId = new Map(existing.map(item => [item._id, item]));
  for (const item of incoming) {
    const current = byId.get(item._id);
    if (current?.updatedAt && item.updatedAt && new Date(current.updatedAt) > new Date(item.updatedAt)) continue;
    byId.set(item._id, item);
  }
  return sortConversations([...byId.values()]);
}
