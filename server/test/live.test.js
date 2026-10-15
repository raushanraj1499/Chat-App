import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io as clientIO } from 'socket.io-client';
import { createApp } from '../app.js';
import { InitializeSocket, personalRoom, conversationRoom } from '../socket/socket.js';
import User from '../models/user.model.js';
import Conversation from '../models/conversation.model.js';
import Message from '../models/message.model.js';

let database, server, io, base, users, tokens;
const clients = [];
const sign = (id, options = {}) => jwt.sign({ _id: String(id) }, process.env.JWT_SECRET_KEY, { expiresIn: '1h', ...options });
const event = (socket, name) => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { socket.off(name, handler); reject(new Error(`Timed out waiting for ${name}`)); }, 5000);
    const handler = data => { clearTimeout(timeout); resolve(data); };
    socket.once(name, handler);
});
async function connect(token) {
    const socket = clientIO(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
        extraHeaders: token ? { Cookie: `token=${token}` } : {} });
    clients.push(socket);
    const ready = event(socket, 'connected');
    socket.connect();
    await ready;
    return socket;
}
async function request(path, token, method = 'GET', body) {
    const response = await fetch(base + '/api' + path, { method,
        headers: { ...(token ? { Cookie: `token=${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
}
const group = async (participants = users.map(user => user._id)) => Conversation.create({
    conversationName: 'Team', participants, isGroup: true, groupAdmin: users[0]._id,
});
const ack = (socket, name, id) => socket.timeout(5000).emitWithAck(name, id);

before(async () => {
    process.env.JWT_SECRET_KEY = 'isolated-integration-test-secret';
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri(), { dbName: 'chat-point-two-test' });
    const app = createApp();
    server = http.createServer(app);
    io = InitializeSocket(server);
    app.set('io', io);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
    clients.forEach(socket => socket.disconnect());
    if (io) await new Promise(resolve => io.close(resolve));
    if (server?.listening) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect();
    await database?.stop();
});
beforeEach(async () => {
    clients.splice(0).forEach(socket => socket.disconnect());
    await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);
    users = await User.create(['Alice', 'Bob', 'Carol'].map(username => ({ username, email: `${username}@example.com`, password: 'test-password' })));
    tokens = users.map(user => sign(user._id));
});

test('HTTP and socket reject missing, forged, expired, malformed-subject and deleted-user tokens', async () => {
    const absentUser = new mongoose.Types.ObjectId();
    for (const token of [undefined, 'forged', sign(users[0]._id, { expiresIn: -1 }), sign('invalid'), sign(absentUser),
        jwt.sign({ _id: String(users[0]._id) }, process.env.JWT_SECRET_KEY)]) {
        assert.equal((await request('/user/me', token)).status, 401);
        const socket = clientIO(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
            extraHeaders: token ? { Cookie: `token=${token}` } : {} });
        clients.push(socket);
        const rejected = event(socket, 'connect_error');
        socket.connect();
        assert.equal((await rejected).data.code, 'UNAUTHORIZED');
        socket.disconnect();
    }
});

test('automatic personal rooms ignore supplied identity and reject unauthorized joins and typing', async () => {
    const conversation = await group([users[0]._id, users[1]._id]);
    const alice = await connect(tokens[0]);
    const carol = await connect(tokens[2]);
    alice.emit('setup', { _id: String(users[2]._id) });
    assert.equal((await ack(alice, 'join chat', String(conversation._id))).success, true);
    assert.equal((await ack(carol, 'join chat', String(conversation._id))).status, 403);
    assert.equal((await ack(carol, 'typing', String(conversation._id))).status, 403);
    assert.equal((await ack(alice, 'join chat', personalRoom(users[2]._id))).status, 400);
    const serverSocket = io.sockets.sockets.get(alice.id);
    assert.ok(serverSocket.rooms.has(personalRoom(users[0]._id)));
    assert.ok(!serverSocket.rooms.has(personalRoom(users[2]._id)));
    const bob = await connect(tokens[1]);
    const typing = event(bob, 'typing');
    await ack(alice, 'typing', String(conversation._id));
    assert.deepEqual(await typing, { conversationId: String(conversation._id), userId: String(users[0]._id) });
});

test('HTTP writes publish creation, edits and deletion to unopened conversations and every tab', async () => {
    const alice = await connect(tokens[0]);
    const bob = await connect(tokens[1]);
    const bobOtherTab = await connect(tokens[1]);
    const created = event(bob, 'conversation updated');
    const direct = await request('/conversation', tokens[0], 'POST', { participants: [String(users[1]._id)] });
    const id = direct.body.conversation._id;
    assert.equal((await created).conversation.conversationName, 'Alice');
    const deliveries = [alice, bob, bobOtherTab].map(socket => event(socket, 'new message'));
    const sent = await request(`/message/${id}`, tokens[0], 'POST', { content: 'Hello' });
    assert.equal(sent.status, 201);
    for (const payload of await Promise.all(deliveries)) {
        assert.equal(payload._id, sent.body.data._id);
        assert.equal(payload.conversationSummary._id, id);
        assert.equal(payload.conversationSummary.latestMessage.content, 'Hello');
        assert.equal(payload.sender.password, undefined);
    }
    const edited = event(bobOtherTab, 'message updated');
    const path = `/message/${id}/${sent.body.data._id}`;
    assert.equal((await request(path, tokens[0], 'PATCH', { content: 'Edited' })).status, 200);
    assert.equal((await edited).conversationSummary.latestMessage.content, 'Edited');
    const deleted = event(bobOtherTab, 'message deleted');
    assert.equal((await request(path, tokens[0], 'DELETE')).status, 200);
    assert.equal((await deleted).content, '');
    assert.ok((await Message.findById(sent.body.data._id)).deletedAt);
    assert.equal((await request(path, tokens[0], 'PATCH', { content: 'Restore' })).status, 400);
    assert.equal((await request(path, tokens[1], 'DELETE')).status, 403);
    // A forged relay has no handler and cannot write or broadcast a message.
    alice.emit('new message', { _id: 'forged', conversation: id, content: 'forged' });
    await ack(alice, 'join chat', id); // Barrier after the ignored relay packet.
    assert.equal(await Message.countDocuments({ conversation: id }), 1);
});

test('membership removal evicts every tab and prevents subsequent events and HTTP access', async () => {
    const conversation = await group();
    const id = String(conversation._id);
    const bob = await connect(tokens[1]);
    const bobOtherTab = await connect(tokens[1]);
    await ack(bob, 'join chat', id);
    await ack(bobOtherTab, 'join chat', id);
    const removals = [bob, bobOtherTab].map(socket => event(socket, 'conversation removed'));
    const response = await request(`/conversation/${id}`, tokens[0], 'PUT', { operation: 'removeMember', data: { userId: String(users[1]._id) } });
    assert.equal(response.status, 200);
    await Promise.all(removals);
    for (const socket of [bob, bobOtherTab]) {
        assert.ok(!io.sockets.sockets.get(socket.id).rooms.has(conversationRoom(id)));
        assert.equal((await ack(socket, 'join chat', id)).status, 403);
        assert.equal((await ack(socket, 'typing', id)).status, 403);
    }
    assert.equal((await request(`/message/${id}`, tokens[1])).status, 403);
    assert.equal((await request(`/message/${id}`, tokens[1], 'POST', { content: 'No access' })).status, 403);
    assert.equal((await request(`/conversation/${id}`, tokens[1])).status, 403);
    const sent = [];
    bob.on('new message', payload => sent.push(payload));
    await request(`/message/${id}`, tokens[0], 'POST', { content: 'Private' });
    await ack(bob, 'join chat', id);
    assert.equal(sent.length, 0);
    await request(`/conversation/${id}`, tokens[0], 'DELETE');
    assert.equal((await request(`/message/${id}`, tokens[0])).status, 404);
    assert.equal((await request('/conversation', tokens[0])).body.conversations.length, 0);
});

test('failed writes emit no events; reconnect snapshots recover missed writes', async () => {
    const conversation = await group();
    const id = String(conversation._id);
    const bob = await connect(tokens[1]);
    bob.disconnect();
    const sent = await request(`/message/${id}`, tokens[0], 'POST', { content: 'While offline' });
    assert.equal(sent.status, 201);
    const originalCreate = Message.create;
    const alice = await connect(tokens[0]);
    const received = [];
    alice.on('new message', payload => received.push(payload));
    Message.create = async () => { throw new Error('Injected database failure'); };
    try {
        const failed = await request(`/message/${id}`, tokens[0], 'POST', { content: 'Must fail' });
        assert.equal(failed.status, 500);
        assert.equal(failed.body.success, false);
    } finally { Message.create = originalCreate; }
    await ack(alice, 'join chat', id);
    assert.equal(received.length, 0);
    await connect(tokens[1]);
    const summaries = await request('/conversation', tokens[1]);
    assert.equal(summaries.body.conversations[0].latestMessage._id, sent.body.data._id);
    assert.equal((await request(`/message/${id}`, tokens[1])).body.messages.length, 1);
});

test('validation errors and removed debug route always return JSON', async () => {
    for (const [path, method, body] of [
        ['/message/bad', 'GET'], ['/message/507f1f77bcf86cd799439011', 'POST', { content: 42 }],
        ['/conversation', 'POST', { participants: 'bad' }],
        ['/conversation/group', 'POST', { participants: [String(new mongoose.Types.ObjectId())], conversationName: 'Team' }],
        ['/conversation/507f1f77bcf86cd799439011', 'PUT', { operation: 'unknown' }],
        ['/user/login', 'POST', { email: { $ne: null }, password: 'x' }],
    ]) {
        const response = await request(path, tokens[0], method, body);
        assert.ok([400, 404].includes(response.status));
        assert.equal(response.body.success, false);
    }
    assert.equal((await request('/user/test', undefined, 'POST', { password: 'secret' })).status, 404);
});

test('logout disconnects all tabs sharing the cookie; expired sockets disconnect', async () => {
    const alice = await connect(tokens[0]);
    const otherTab = await connect(tokens[0]);
    const signedOut = [alice, otherTab].map(socket => event(socket, 'unauthorized'));
    const response = await request('/user/logout', tokens[0], 'POST');
    assert.equal(response.status, 200);
    assert.match(response.headers.get('set-cookie'), /Path=\//);
    await Promise.all(signedOut);
    const shortLived = await connect(sign(users[1]._id, { expiresIn: 2 }));
    await event(shortLived, 'unauthorized');
});

test('group changes reach added users and all tabs; leaving and deletion revoke access', async () => {
    const alice = await connect(tokens[0]);
    const bob = await connect(tokens[1]);
    const carol = await connect(tokens[2]);
    const creation = event(bob, 'conversation updated');
    const created = await request('/conversation/group', tokens[0], 'POST', {
        conversationName: 'Initial', participants: [String(users[1]._id)],
    });
    assert.equal(created.status, 201);
    const id = (await creation).conversation._id;
    const renamed = event(alice, 'conversation updated');
    assert.equal((await request(`/conversation/${id}`, tokens[1], 'PUT', {
        operation: 'rename', data: { conversationName: 'Renamed' },
    })).status, 200);
    assert.equal((await renamed).conversation.conversationName, 'Renamed');
    const added = event(carol, 'conversation updated');
    assert.equal((await request(`/conversation/${id}`, tokens[1], 'PUT', {
        operation: 'addMembers', data: { participants: [String(users[2]._id)] },
    })).status, 200);
    assert.equal((await added).conversation.participants.length, 3);
    assert.equal((await request(`/conversation/${id}`, tokens[1], 'DELETE')).status, 403);
    assert.equal((await request(`/conversation/${id}`, tokens[0], 'PUT', { operation: 'leave' })).status, 400);
    assert.equal((await request(`/conversation/${id}`, tokens[0], 'PUT', {
        operation: 'transferAdmin', data: { userId: String(users[1]._id) },
    })).status, 200);
    await ack(alice, 'join chat', id);
    const left = event(alice, 'conversation removed');
    assert.equal((await request(`/conversation/${id}`, tokens[0], 'PUT', { operation: 'leave' })).status, 200);
    await left;
    assert.ok(!io.sockets.sockets.get(alice.id).rooms.has(conversationRoom(id)));
    assert.equal((await request(`/message/${id}`, tokens[0])).status, 403);
    await ack(carol, 'join chat', id);
    const removed = event(carol, 'conversation removed');
    assert.equal((await request(`/conversation/${id}`, tokens[1], 'DELETE')).status, 200);
    await removed;
    assert.ok(!io.sockets.sockets.get(carol.id).rooms.has(conversationRoom(id)));
    assert.equal((await ack(carol, 'typing', id)).status, 404);
});

test('configured frontend origin is accepted and untrusted socket origins are refused', async () => {
    const origin = 'http://localhost:5173';
    const socket = clientIO(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
        extraHeaders: { Cookie: `token=${tokens[0]}`, Origin: origin } });
    clients.push(socket);
    const ready = event(socket, 'connected');
    socket.connect();
    await ready;
    const response = await fetch(base + '/api/user/me', { headers: { Cookie: `token=${tokens[0]}`, Origin: origin } });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
    const forbidden = clientIO(base, { autoConnect: false, transports: ['websocket'], reconnection: false,
        extraHeaders: { Cookie: `token=${tokens[0]}`, Origin: 'https://untrusted.example' } });
    clients.push(forbidden);
    const rejected = event(forbidden, 'connect_error');
    forbidden.connect();
    await rejected;
    assert.equal(forbidden.connected, false);
    forbidden.disconnect();
});
