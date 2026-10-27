import { StrictMode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import App from '../App.jsx';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import SessionProviders from '../context/SessionProviders.jsx';
import { useConversation } from '../context/ConversationContext.jsx';
import api from '../lib/api.js';

const sockets = vi.hoisted(() => []);
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const listeners = new Map();
    const socket = {
      connected: false,
      on: vi.fn((event, listener) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(listener); }),
      off: vi.fn((event, listener) => listeners.get(event)?.delete(listener)),
      emit: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
      removeAllListeners: vi.fn(() => listeners.clear()),
      io: { on: vi.fn(), removeAllListeners: vi.fn() },
      trigger(event, data) {
        if (event === 'connect') this.connected = true;
        if (event === 'disconnect') this.connected = false;
        listeners.get(event)?.forEach(listener => listener(data));
      },
    };
    sockets.push(socket);
    return socket;
  }),
}));

const alice = { _id: 'alice', username: 'Alice', email: 'alice@example.com' };
const bob = { _id: 'bob', username: 'Bob' };
const carol = { _id: 'carol', username: 'Carol' };
const chats = [
  { _id: 'ab', participants: [alice, bob], isGroup: false },
  { _id: 'ac', participants: [alice, carol], isGroup: false },
];
const message = (id, conversation, content) => ({
  _id: id, conversation, content, sender: bob, createdAt: '2026-10-10T00:00:00Z',
});
const reply = (config, data) => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const failure = (config, status, text = 'Failed') => Promise.reject({
  config, response: status ? { status, data: { message: text } } : undefined,
});
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function mountApp(path = '/chat', children = <App />) {
  window.history.replaceState({}, '', path);
  return render(<StrictMode><AuthProvider><SessionProviders>{children}</SessionProviders></AuthProvider></StrictMode>);
}
function authAdapter(config) {
  if (config.url === '/api/user/me') return Promise.resolve(reply(config, alice));
  if (config.url === '/api/conversation') return Promise.resolve(reply(config, { conversations: chats }));
  if (config.url.startsWith('/api/message/')) return Promise.resolve(reply(config, { messages: [] }));
  throw new Error('Unexpected request: ' + config.url);
}
beforeEach(() => {
  sockets.length = 0;
  api.defaults.adapter = vi.fn(authAdapter);
});

describe('session and routing', () => {
  it.each(['/chat', '/'])('redirects signed-out users from %s to login', async (path) => {
    api.defaults.adapter = config => failure(config, 401);
    mountApp(path);
    expect(await screen.findByRole('heading', { name: 'Account Login' })).toBeTruthy();
    expect(window.location.pathname).toBe('/login');
    expect(sockets.length).toBe(0);
  });

  it.each(['/login', '/signup', '/'])('redirects signed-in users from %s to chat without a socket', async (path) => {
    mountApp(path);
    expect(await screen.findByText('My Chats')).toBeTruthy();
    expect(window.location.pathname).toBe('/chat');
    expect(screen.queryByLabelText('Loading session')).toBeNull();
    expect(screen.getByText(/You can still load and send messages/)).toBeTruthy();
  });

  it('distinguishes an unavailable server from signed-out authentication and retries', async () => {
    api.defaults.adapter = config => failure(config);
    mountApp();
    expect(screen.getByLabelText('Loading session')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Unable to load your session' })).toBeTruthy();
    expect(window.location.pathname).toBe('/chat');
    expect(screen.queryByRole('heading', { name: 'Account Login' })).toBeNull();
    api.defaults.adapter = vi.fn(authAdapter);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('My Chats')).toBeTruthy();
  });

  it('uses credentialed requests and expires authentication on a protected HTTP 401', async () => {
    mountApp();
    await screen.findByText('Bob');
    const socket = sockets.at(-1);
    api.defaults.adapter = config => failure(config, 401);
    fireEvent.click(screen.getByText('Bob'));
    expect(await screen.findByRole('heading', { name: 'Account Login' })).toBeTruthy();
    expect(socket.disconnect).toHaveBeenCalled();
    expect(api.defaults.withCredentials).toBe(true);
  });

  it('discards the socket and session when the socket reports expired authentication', async () => {
    mountApp();
    await screen.findByText('My Chats');
    const socket = sockets.at(-1);
    act(() => socket.trigger('unauthorized', { message: 'Authentication failed' }));
    expect(await screen.findByRole('heading', { name: 'Account Login' })).toBeTruthy();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('does not let a late 401 from the previous session log out the new user', async () => {
    const pending = deferred();
    let oldConfig;
    api.defaults.adapter = config => {
      if (config.url === '/old-session') {
        oldConfig = config;
        return pending.promise;
      }
      return authAdapter(config);
    };
    function UserProbe() {
      const { user, setUser } = useAuth();
      return <><p>{user?.username}</p><button onClick={() => setUser(carol)}>Switch user</button></>;
    }
    mountApp('/', <UserProbe />);
    await screen.findByText('Alice');
    const oldRequest = api.get('/old-session').catch(() => {});
    await waitFor(() => expect(oldConfig).toBeTruthy());
    fireEvent.click(screen.getByText('Switch user'));
    await act(async () => {
      pending.reject({ config: oldConfig, response: { status: 401 } });
      await oldRequest;
    });
    expect(screen.getByText('Carol')).toBeTruthy();
  });

  it('blocks duplicate login requests and keeps credentials after failure', async () => {
    const login = deferred();
    let loginConfig;
    api.defaults.adapter = vi.fn(config => {
      if (config.url === '/api/user/me') return failure(config, 401);
      loginConfig = config;
      return login.promise;
    });
    mountApp('/login');
    await screen.findByRole('heading', { name: 'Account Login' });
    const email = screen.getByLabelText('Email Address');
    const password = screen.getByLabelText('Password');
    fireEvent.change(email, { target: { value: 'alice@example.com' } });
    fireEvent.change(password, { target: { value: 'secret' } });
    fireEvent.submit(email.closest('form'));
    fireEvent.submit(email.closest('form'));
    await waitFor(() => expect(loginConfig).toBeTruthy());
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/api/user/login').length).toBe(1);
    expect(loginConfig.withCredentials).toBe(true);
    await act(async () => login.reject({ config: loginConfig }));
    expect(email.value).toBe('alice@example.com');
    expect(password.value).toBe('secret');
    expect(screen.getByRole('button', { name: 'Log In' }).disabled).toBe(false);
  });

  it('clears conversations and messages on logout before another user signs in', async () => {
    function StoreProbe() {
      const { user, logout, setUser } = useAuth();
      const { conversations, setConversations, messages, addMessages, selectedConversation, setSelectedConversation } = useConversation();
      return <>
        <p>{user?.username || 'Signed out'}</p>
        <output>{JSON.stringify({ conversations, messages, selectedConversation })}</output>
        <button onClick={() => {
          setConversations(chats);
          setSelectedConversation(chats[0]);
          addMessages('ab', [message('old', 'ab', 'private')]);
        }}>Seed</button>
        <button onClick={logout}>Logout</button>
        <button onClick={() => setUser(carol)}>Next user</button>
      </>;
    }
    api.defaults.adapter = config => config.url === '/api/user/logout'
      ? Promise.resolve(reply(config, {})) : authAdapter(config);
    mountApp('/', <StoreProbe />);
    await screen.findByText('Alice');
    const oldSocket = sockets.at(-1);
    fireEvent.click(screen.getByText('Seed'));
    expect(screen.getByRole('status').textContent).toContain('private');
    fireEvent.click(screen.getByText('Logout'));
    await screen.findByText('Signed out');
    expect(screen.getByRole('status').textContent).toBe('{"conversations":[],"messages":{},"selectedConversation":null}');
    expect(oldSocket.disconnect).toHaveBeenCalled();
    fireEvent.click(screen.getByText('Next user'));
    expect(screen.getByRole('status').textContent).not.toContain('private');
  });
});

describe('conversation state', () => {
  it('ignores stale history after rapid switching and keeps per-conversation drafts', async () => {
    const oldHistory = deferred();
    api.defaults.adapter = config => {
      if (config.url === '/api/message/ab') return oldHistory.promise.then(data => reply(config, { messages: data }));
      if (config.url === '/api/message/ac') return Promise.resolve(reply(config, { messages: [message('c', 'ac', 'Carol history')] }));
      return authAdapter(config);
    };
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Bob draft' } });
    fireEvent.click(screen.getByText('Carol'));
    expect(screen.getByLabelText('Message').value).toBe('');
    await screen.findByText('Carol history');
    await act(async () => oldHistory.resolve([message('b', 'ab', 'Stale Bob history')]));
    expect(screen.queryByText('Stale Bob history')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));
    expect(screen.getByLabelText('Message').value).toBe('Bob draft');
  });

  it('deduplicates messages, avoids preview-triggered history loads, and refreshes on reconnect', async () => {
    const history = deferred();
    api.defaults.adapter = vi.fn(config => config.url === '/api/message/ab'
      ? history.promise.then(messages => reply(config, { messages })) : authAdapter(config));
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    await waitFor(() => expect(api.defaults.adapter.mock.calls.some(([config]) => config.url === '/api/message/ab')).toBe(true));
    const socket = sockets.at(-1);
    const live = message('live', 'ab', 'Shared message');
    act(() => { socket.trigger('new message', live); socket.trigger('new message', live); });
    await act(async () => history.resolve([message('early', 'ab', 'Earlier history'), live]));
    await screen.findByText('Earlier history');
    expect(screen.getAllByText('Shared message').length).toBe(2); // One bubble and one preview.
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/api/message/ab').length).toBe(1);
    api.defaults.adapter.mockImplementation(config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: [live] }))
      : config.url === '/api/conversation'
        ? Promise.resolve(reply(config, { conversations: [{ ...chats[0], latestMessage: live }, chats[1]] }))
        : authAdapter(config));
    act(() => socket.trigger('connect'));
    expect(socket.emit).toHaveBeenCalledWith('join chat', 'ab');
    await waitFor(() => expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/api/message/ab').length).toBe(2));
    expect(socket.emit).not.toHaveBeenCalledWith('setup');
    expect(screen.getAllByText('Shared message').length).toBe(2);
  });

  it('sends over HTTP while disconnected, blocks duplicates, and preserves a failed draft', async () => {
    const send = deferred();
    let sendConfig;
    api.defaults.adapter = vi.fn(config => {
      if (config.method === 'post') {
        sendConfig = config;
        return send.promise;
      }
      return authAdapter(config);
    });
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'Keep my draft' } });
    fireEvent.submit(input.closest('form'));
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(sendConfig).toBeTruthy());
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.method === 'post').length).toBe(1);
    await act(async () => send.reject({ config: sendConfig }));
    expect(input.value).toBe('Keep my draft');
    expect(screen.getAllByText('Cannot reach the server. Check your connection and try again.').length).toBe(1);
    api.defaults.adapter = vi.fn(config => config.method === 'post'
      ? Promise.resolve(reply(config, { data: message('sent', 'ab', 'Keep my draft') })) : authAdapter(config));
    fireEvent.submit(input.closest('form'));
    await waitFor(() => expect(input.value).toBe(''));
    expect(screen.getAllByText('Keep my draft').length).toBe(2);
    expect(sockets.at(-1).emit).not.toHaveBeenCalledWith('new message', expect.anything());
  });

  it('keeps new text and the other conversation selected when an older send completes', async () => {
    const send = deferred();
    api.defaults.adapter = config => config.method === 'post'
      ? send.promise.then(data => reply(config, { data })) : authAdapter(config);
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'First text' } });
    fireEvent.submit(input.closest('form'));
    fireEvent.change(input, { target: { value: 'Next text' } });
    fireEvent.click(screen.getByText('Carol'));
    await act(async () => send.resolve(message('sent', 'ab', 'First text')));
    expect(screen.getByRole('heading', { name: 'Carol' })).toBeTruthy();
    expect(screen.getByLabelText('Message').value).toBe('');
    fireEvent.click(screen.getByText('Bob'));
    expect(screen.getByLabelText('Message').value).toBe('Next text');
  });

  it('shows a retry action after history network failure', async () => {
    api.defaults.adapter = config => config.url === '/api/message/ab' ? failure(config) : authAdapter(config);
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    const retry = await screen.findByRole('button', { name: 'Retry messages' });
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: [message('recovered', 'ab', 'Recovered')] })) : authAdapter(config);
    fireEvent.click(retry);
    expect(await screen.findByText('Recovered')).toBeTruthy();
    expect(screen.queryByText('Loading messages…')).toBeNull();
  });
});

describe('server-owned live updates', () => {
  it('adds unopened conversations from summaries and applies edits and deletions', async () => {
    mountApp();
    await screen.findByText('Bob');
    const socket = sockets.at(-1);
    const dave = { _id: 'dave', username: 'Dave' };
    const incoming = { ...message('new', 'ad', 'Unopened'), sender: dave, updatedAt: '2026-10-10T00:00:00Z' };
    const summary = { _id: 'ad', participants: [alice, dave], isGroup: false, latestMessage: incoming };
    act(() => socket.trigger('new message', { ...incoming, conversationSummary: summary }));
    expect(await screen.findByText('Dave')).toBeTruthy();
    fireEvent.click(screen.getByText('Dave'));
    expect(screen.getAllByText('Unopened').length).toBe(2);
    const edit = { ...incoming, content: 'Changed', isEdited: true, updatedAt: '2026-10-10T00:01:00Z' };
    act(() => socket.trigger('message updated', { ...edit, conversationSummary: { ...summary, latestMessage: edit } }));
    expect(screen.getAllByText('Changed').length).toBe(2);
    const deletion = { ...edit, content: '', deletedAt: '2026-10-10T00:02:00Z', updatedAt: '2026-10-10T00:02:00Z' };
    act(() => socket.trigger('message deleted', { ...deletion, conversationSummary: { ...summary, latestMessage: deletion } }));
    expect(screen.getAllByText('Message deleted').length).toBe(2);
    expect(screen.queryByText('Changed')).toBeNull();
  });

  it('refetches on every connection and recovers missed messages without duplicates', async () => {
    const original = message('old', 'ab', 'Original');
    const missed = message('missed', 'ab', 'Missed while offline');
    let history = [original];
    api.defaults.adapter = vi.fn(config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: history })) : authAdapter(config));
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    await screen.findByText('Original');
    const socket = sockets.at(-1);
    act(() => socket.trigger('connect'));
    await waitFor(() => expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/api/message/ab').length).toBe(2));
    act(() => socket.trigger('disconnect', 'transport close'));
    history = [original, missed];
    act(() => socket.trigger('connect'));
    await screen.findByText('Missed while offline');
    expect(screen.getAllByText('Original').length).toBe(1);
    expect(api.defaults.adapter.mock.calls.filter(([config]) => config.url === '/api/message/ab').length).toBe(3);
  });

  it('removes inaccessible chats, selection and caches after missed membership events', async () => {
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    api.defaults.adapter = config => config.url === '/api/conversation'
      ? Promise.resolve(reply(config, { conversations: [chats[1]] })) : authAdapter(config);
    act(() => sockets.at(-1).trigger('connect'));
    await waitFor(() => expect(screen.queryByText('Bob')).toBeNull());
    expect(screen.queryByLabelText('Message')).toBeNull();
  });

  it('keeps removals and edits that arrive while stale HTTP requests are pending', async () => {
    const initialHistory = deferred();
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? initialHistory.promise.then(messages => reply(config, { messages })) : authAdapter(config);
    mountApp();
    fireEvent.click(await screen.findByText('Bob'));
    const socket = sockets.at(-1);
    const old = message('edit', 'ab', 'Old content');
    const edited = { ...old, content: 'Current content', updatedAt: '2026-10-10T01:00:00Z' };
    act(() => socket.trigger('message updated', edited));
    await act(async () => initialHistory.resolve([old]));
    expect(screen.queryByText('Old content')).toBeNull();
    expect(screen.getAllByText('Current content').length).toBe(2);
    const stale = deferred();
    api.defaults.adapter = config => config.url === '/api/conversation'
      ? stale.promise.then(conversations => reply(config, { conversations })) : authAdapter(config);
    act(() => socket.trigger('connect'));
    act(() => socket.trigger('conversation removed', { conversationId: 'ab' }));
    await act(async () => stale.resolve(chats));
    expect(screen.queryByText('Bob')).toBeNull();
    expect(screen.queryByText('Current content')).toBeNull();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });

  it('accepts socket middleware authentication failures as session expiry', async () => {
    mountApp();
    await screen.findByText('My Chats');
    act(() => sockets.at(-1).trigger('connect_error', { data: { code: 'UNAUTHORIZED' } }));
    expect(await screen.findByRole('heading', { name: 'Account Login' })).toBeTruthy();
  });
});

it('does not let a delayed send response undo an edit delivered through the socket', async () => {
  const send = deferred();
  api.defaults.adapter = config => config.method === 'post'
    ? send.promise.then(data => reply(config, { data })) : authAdapter(config);
  mountApp();
  fireEvent.click(await screen.findByText('Bob'));
  const input = screen.getByLabelText('Message');
  fireEvent.change(input, { target: { value: 'Original send' } });
  fireEvent.submit(input.closest('form'));
  const original = { ...message('sent-edit', 'ab', 'Original send'), sender: alice };
  const edited = { ...original, content: 'Edited in another tab', isEdited: true, updatedAt: '2026-10-10T01:00:00Z' };
  act(() => sockets.at(-1).trigger('message updated', edited));
  await act(async () => send.resolve(original));
  expect(screen.queryByText('Original send')).toBeNull();
  expect(screen.getByText('Edited in another tab')).toBeTruthy();
  expect(screen.getByText('You: Edited in another tab')).toBeTruthy();
  expect(sockets.at(-1).emit).not.toHaveBeenCalledWith('new message', expect.anything());
});

describe('complete group and message behavior', () => {
  const team = { _id: 'team', conversationName: 'Team', isGroup: true, participants: [alice, bob], groupAdmin: 'alice', revision: 1 };
  const seedTeam = (current = team) => {
    api.defaults.adapter = config => config.url === '/api/conversation'
      ? Promise.resolve(reply(config, { conversations: [current] })) : authAdapter(config);
  };

  it('opens group controls only for groups, labels You/admin, confirms removal and preserves visible failures', async () => {
    seedTeam(); mountApp();
    fireEvent.click(await screen.findByText('Team'));
    fireEvent.click(screen.getByRole('button', { name: /Manage group/ }));
    const dialog = screen.getByRole('dialog', { name: 'Manage group' });
    expect(within(dialog).getByText('Alice (You) · Admin')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    expect(within(dialog).getByText('Remove Bob from this group?')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeTruthy();
    api.defaults.adapter = config => failure(config, 403, 'Permission changed');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));
    expect(await within(dialog).findByText('Permission changed')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lets non-admin members rename/add/leave and hides admin controls; direct chats have no group controls', async () => {
    seedTeam({ ...team, groupAdmin: bob }); mountApp();
    fireEvent.click(await screen.findByText('Team'));
    fireEvent.click(screen.getByRole('button', { name: /Manage group/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Rename group' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Leave group' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Delete group' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    act(() => sockets.at(-1).trigger('conversation updated', { conversation: chats[0] }));
    fireEvent.click(screen.getByRole('button', { name: 'Bob' }));
    expect(screen.queryByRole('button', { name: /Manage group/ })).toBeNull();
  });

  it('excludes self/existing members from search selection and submits selected new members', async () => {
    seedTeam(); mountApp();
    fireEvent.click(await screen.findByText('Team'));
    fireEvent.click(screen.getByRole('button', { name: /Manage group/ }));
    const requests = [];
    api.defaults.adapter = config => {
      requests.push(config);
      return Promise.resolve(reply(config, config.method === 'put'
        ? { conversation: { ...team, participants: [alice, bob, carol], revision: 2 } }
        : { users: [alice, bob, carol] }));
    };
    fireEvent.change(screen.getByLabelText('Find members'), { target: { value: 'ca' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Add Carol' }));
    expect(screen.queryByRole('button', { name: 'Add Alice' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Bob' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add selected members' }));
    await screen.findByText('Members (3)');
    const update = requests.find(config => config.method === 'put');
    expect(JSON.parse(update.data)).toEqual({ operation: 'addMembers', data: { participants: ['carol'] } });
  });

  it('edits and deletes only own messages with confirmation and an Edited label', async () => {
    const own = { ...message('mine', 'ab', 'Original'), sender: alice };
    const other = message('theirs', 'ab', 'Other message');
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: [own, other] })) : authAdapter(config);
    mountApp(); fireEvent.click(await screen.findByText('Bob'));
    await screen.findByText('Original');
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getByLabelText('Message content'), { target: { value: 'Updated text' } });
    api.defaults.adapter = config => Promise.resolve(reply(config, { data: { ...own, content: 'Updated text', isEdited: true, updatedAt: '2026-10-11T00:00:00Z' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await within(screen.getByRole('log')).findByText('Updated text')).toBeTruthy();
    expect(screen.getByText(/Edited ·/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    api.defaults.adapter = config => Promise.resolve(reply(config, { data: { ...own, content: '', deletedAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    expect(await within(screen.getByRole('log')).findByText('Message deleted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('prepends history while retaining scroll position and does not jump for incoming messages when scrolled up', async () => {
    const recent = message('recent', 'ab', 'Recent');
    const older = { ...message('older', 'ab', 'Older'), createdAt: '2026-10-09T00:00:00Z' };
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: config.params?.before ? [older] : [recent], nextCursor: config.params?.before ? null : 'recent' })) : authAdapter(config);
    mountApp(); fireEvent.click(await screen.findByText('Bob'));
    await screen.findByText('Recent');
    const log = screen.getByRole('log');
    Object.defineProperty(log, 'scrollHeight', { configurable: true, get: () => log.textContent.includes('Older') ? 2000 : 1000 });
    Object.defineProperty(log, 'clientHeight', { configurable: true, value: 200 });
    log.scrollTop = 100; fireEvent.scroll(log);
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    await screen.findByText('Older');
    expect(log.scrollTop).toBe(1100);
    expect(screen.queryByRole('button', { name: 'Load older messages' })).toBeNull();
    act(() => sockets.at(-1).trigger('new message', { ...message('incoming', 'ab', 'Incoming'), createdAt: '2026-10-11T00:00:00Z' }));
    expect(log.scrollTop).toBe(1100);
  });

  it('throttles composing, stops on blur/switch, names current typers and expires stale indicators', async () => {
    mountApp(); fireEvent.click(await screen.findByText('Bob'));
    const socket = sockets.at(-1);
    act(() => socket.trigger('connect'));
    await waitFor(() => expect(socket.emit).toHaveBeenCalledWith('join chat', 'ab'));
    const input = screen.getByLabelText('Message');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.change(input, { target: { value: 'ab' } });
    expect(socket.emit.mock.calls.filter(([name]) => name === 'typing')).toHaveLength(1);
    fireEvent.blur(input);
    expect(socket.emit).toHaveBeenCalledWith('stop typing', 'ab');
    vi.useFakeTimers();
    act(() => socket.trigger('typing', { conversationId: 'ab', userId: 'bob' }));
    expect(screen.getByText('Bob is typing…')).toBeTruthy();
    act(() => vi.advanceTimersByTime(4600));
    expect(screen.queryByText('Bob is typing…')).toBeNull();
    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Carol' }));
    expect(socket.emit.mock.calls.filter(([name]) => name === 'stop typing')).toHaveLength(2);
    vi.useRealTimers();
  });

  it('marks the last displayed ID read only in a visible focused tab', async () => {
    const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const visible = message('displayed', 'ab', 'Displayed');
    const requests = [];
    api.defaults.adapter = config => {
      requests.push(config);
      if (config.url.endsWith('/read')) return Promise.resolve(reply(config, { conversation: { ...chats[0], unreadCount: 0 } }));
      if (config.url === '/api/message/ab') return Promise.resolve(reply(config, { messages: [visible] }));
      return authAdapter(config);
    };
    mountApp(); fireEvent.click(await screen.findByText('Bob'));
    await screen.findByText('Displayed');
    expect(requests.filter(config => config.url.endsWith('/read'))).toHaveLength(0);
    focus.mockReturnValue(true); visibility.mockReturnValue('hidden');
    act(() => window.dispatchEvent(new Event('focus')));
    expect(requests.filter(config => config.url.endsWith('/read'))).toHaveLength(0);
    visibility.mockReturnValue('visible');
    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(requests.filter(config => config.url.endsWith('/read'))).toHaveLength(1));
    expect(JSON.parse(requests.find(config => config.url.endsWith('/read')).data)).toEqual({ messageId: 'displayed' });
  });

  it('purges history on a missed rejoin and rejects stale conversation summaries', async () => {
    seedTeam(); mountApp();
    fireEvent.click(await screen.findByText('Team'));
    const socket = sockets.at(-1);
    act(() => socket.trigger('new message', message('old-team', 'team', 'Previous membership')));
    expect(within(screen.getByRole('log')).getByText('Previous membership')).toBeTruthy();
    const rejoined = { ...team, joinedAt: '2026-10-11T00:00:00Z', revision: 5, latestMessage: null };
    act(() => socket.trigger('conversation updated', { conversation: rejoined }));
    expect(screen.queryByText('Previous membership')).toBeNull();
    act(() => socket.trigger('conversation updated', { conversation: { ...team, revision: 2 } }));
    act(() => socket.trigger('new message', message('old-team', 'team', 'Previous membership')));
    expect(within(screen.getByRole('log')).queryByText('Previous membership')).toBeNull();
  });

  it('keeps a group removed when an earlier rename response arrives late', async () => {
    seedTeam(); mountApp();
    fireEvent.click(await screen.findByText('Team'));
    fireEvent.click(screen.getByRole('button', { name: /Manage group/ }));
    const pending = deferred();
    api.defaults.adapter = config => pending.promise.then(conversation => reply(config, { conversation }));
    fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Rename group' }));
    act(() => sockets.at(-1).trigger('conversation removed', { conversationId: 'team' }));
    await act(async () => pending.resolve({ ...team, conversationName: 'Renamed', revision: 2 }));
    expect(screen.queryByText('Renamed')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('restarts pagination after reconnect so more than 50 missed messages can be recovered', async () => {
    const old = { ...message('old-page', 'ab', 'Old cached page'), createdAt: '2026-10-01T00:00:00Z' };
    const latest = { ...message('new-page', 'ab', 'Newest page'), createdAt: '2026-10-12T00:00:00Z' };
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: [old], nextCursor: null })) : authAdapter(config);
    mountApp(); fireEvent.click(await screen.findByText('Bob'));
    await screen.findByText('Old cached page');
    api.defaults.adapter = config => config.url === '/api/message/ab'
      ? Promise.resolve(reply(config, { messages: config.params?.before ? [old] : [latest], nextCursor: config.params?.before ? null : 'new-page' })) : authAdapter(config);
    act(() => sockets.at(-1).trigger('connect'));
    await screen.findByText('Newest page');
    expect(within(screen.getByRole('log')).queryByText('Old cached page')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
    await screen.findByText('Old cached page');
  });
});
