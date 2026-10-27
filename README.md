# Chat-App - Real-Time Chat App

Chat-App is a full stack real time chat application build with React, Node.js, Socket.io, and MongoDB.

## Features 

- User Authentication (Sign up , Login , JWT + Cookies)
- Avatar upload with Cloudinary
- Real-Time Chat using Socket.io
- Error Handling and Form validation
- Session-aware routes with retryable loading errors
- HTTP message history and sending while live updates reconnect
- Conversation-specific message caches and drafts, with duplicate submission protection

## Tech Stack

### Frontend
- React
- Context API
- Axios
- React Hot Toast

### Backend
- Node.js
- Express.js
- MongoDB + Mongoose
- Socket.io
- Cloudinary

## Getting Started

### Prerequisites
- Node.js
- MongoDB Atlas 
- Cloudinary Account

### Environment Setup

#### Backend `.env`
```bash
PORT=3000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET_KEY=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Installation

### Clone the repository
```bash
git clone https://github.com/raushanraj1499/Chat-App.git
cd Chat-App
```

### Setup and run backend

```bash
cd server
npm install
npm run dev
```

### Setup and run frontend

```bash
cd client
npm install
npm run dev
```

## Verification

Run `npm run lint`, `npm test`, and `npm run build` from `client/`.
Run `npm test` from `server/` for authentication, startup, rate-limit, and isolated
MongoDB HTTP/socket integration checks.
The frontend regression tests use mocked HTTP and socket connections; they do not
require MongoDB or Cloudinary.

Signed-out users are redirected to `/login`; signed-in users are redirected from
`/login` and `/signup` to `/chat`. `/` resolves according to the current session.
An unavailable server shows a retry action. Live updates reconnect automatically,
and HTTP history and sends stay available during reconnection. Failed sends keep
their draft, and logout or an expired session discards the previous session's data.


## Reliable server operations and live updates (plan point 2)

The server verifies signed, expiring JWT cookies and current users for HTTP and
socket authentication. Sockets automatically join `user:<verified user ID>`;
`setup` and client `new message` broadcasts are no longer accepted. Conversation
joins and typing events check current membership. Membership changes evict every
removed user's tab from its conversation room before publishing group details.

After database writes, the server sends `conversation updated` and `new message`,
`message updated`, or `message deleted` events through personal rooms. Message
events include `conversationSummary`, including for chats a recipient has never
opened. `conversation removed` clears selection and cached messages. On every
socket connection the client reloads summaries and the selected history, merges
messages by ID, and preserves newer edits that race a history response.

Backend mutation interfaces used by this event flow:

| Method and route | Body |
| --- | --- |
| `PUT /api/conversation/:id` | `{ operation: "rename", data: { conversationName } }` |
| `PUT /api/conversation/:id` | `{ operation: "addMembers", data: { participants: [userId] } }` |
| `PUT /api/conversation/:id` | `{ operation: "removeMember" or "transferAdmin", data: { userId } }` |
| `PUT /api/conversation/:id` | `{ operation: "leave" }` |
| `DELETE /api/conversation/:id` | No body; group administrator only |
| `PATCH /api/message/:conversationId/:messageId` | `{ content }`; current member and sender only |
| `DELETE /api/message/:conversationId/:messageId` | No body; current member and sender only |

Deleted messages retain an empty-content tombstone and timestamp. Deleted groups
are excluded from lists and reject history and mutations.

## Group and message behavior (plan point 3)

Open a group and choose **Manage group** to rename it, select new members, or leave.
Every current member can rename/add users. Admins can remove others, transfer
administration, or delete the group for everyone. Removal, transfer, leave, and
deletion require confirmation. An admin must transfer administration before
leaving; a sole admin can delete the group. Separate groups may have the same
members. Direct conversations remain available.

Membership metadata records each user's latest join time and read position.
New and rejoining members see only messages from their latest join onward, including
previews, pagination, unread counts, and live edits/deletions. Existing members
without metadata keep their full history; metadata is initialized when needed.
Existing messages count as unread until a read position is recorded. The broader
data migration described in plan point 4 remains a separate step; this change
does not run a migration against the configured database.

Senders can edit or delete their visible messages while they remain members.
Edits show **Edited**; deletion clears the stored text and leaves **Message deleted**
with its sender and original timestamp. Changes update participants and other tabs.
History loads 50 messages at a time. **Load older messages** retains scroll position;
incoming messages scroll into view only when already near the bottom.

Typing indicators show member names, throttle composing events, and stop on send,
blur, conversation changes, inactivity, or disconnect. Stale indicators expire.
Unread counts exclude deleted messages and a member's own messages. Reads advance
only in a visible, focused tab at the bottom of its conversation, using the last
displayed message ID. Server-published summaries synchronize counts across tabs
and refreshes. Conversation revisions prevent stale responses undoing newer state.

Additional API details:

| Method and route | Behavior |
| --- | --- |
| `GET /api/message/:conversationId?before=<messageId>&limit=50` | Visible messages in chronological order; `{ messages, nextCursor }`. Maximum page size 50; `nextCursor` is null at the beginning of history. |
| `POST /api/conversation/:id/read` | `{ messageId }`; monotonically advances the authenticated member's read position and returns `{ conversation }`. |

Point 3 regression tests cover joins/rejoins and hidden-message events, ownership,
admin permissions, unread persistence across tabs, concurrent incoming messages,
pagination with equal timestamps, group controls, message actions, scroll retention,
typing expiry, and focused/visible read updates. Run the existing server and client
test commands in **Verification** above. These tests use isolated data or mocks.

### Configuration and production

Use Node.js 22.9 or newer. Copy `server/.env.example` to `server/.env` and fill in
MongoDB, JWT, and Cloudinary values. Startup exits with a nonzero status if required
configuration is missing or MongoDB cannot connect. Failures return JSON with
`{ success: false, message }`; internal errors do not expose credentials.

The default deployment serves the built client, API, and sockets on one app origin.
On Render, `RENDER_EXTERNAL_URL` supplies that origin automatically. Set
`APP_ORIGIN` only to override it with a custom domain.
For development, run both existing dev commands and use Vite's API/socket proxy.
The allowed frontend origin defaults to `http://localhost:5173` in development;
set `CLIENT_ORIGIN` if Vite uses a different origin or port.
Build the client with `npm ci` and `npm run build` in `client/`, then run `npm ci`
and `npm run start:prod` in `server/`. Set `APP_ORIGIN=https://your-chat.example`
and terminate HTTPS at your reverse proxy; proxy `/socket.io` including WebSockets.
Production cookies are always Secure and HttpOnly, scoped to `/`, and use
SameSite=Lax by default. Login and logout use identical cookie scope settings.

For a separate frontend origin, set server `CLIENT_ORIGIN` to the exact frontend
origin (no trailing slash), and set client `VITE_API_URL` and `VITE_SOCKET_URL` to
the API origin **before building**. `CLIENT_URL` remains an alias for older setups.
Cross-site deployments require HTTPS and `COOKIE_SAME_SITE=none`; browser policies
may still restrict third-party cookies. `COOKIE_DOMAIN` is optional; host-only is
the default. Set `TRUST_PROXY` to the known proxy hop count only behind that proxy,
so login/signup rate limits use the correct client address. Both endpoints share
a bounded limit of 20 attempts per address per 15 minutes and return 429 with a
Retry-After header when exceeded.

Deploy one Node process: the socket adapter, per-conversation operation locks,
and authentication rate limits are process-local. Multiple replicas require a
shared socket adapter, distributed serialization, and shared rate-limit storage.

### Verification for point 2

Run `npm test` in `server/` for authentication, configuration/startup, rate-limit,
and HTTP/socket integration tests. Integration tests start a fresh temporary
MongoDB with `mongodb-memory-server`; they never connect to the configured app
database. The first dependency install/test may download a MongoDB test binary.
The tests cover unauthorized rooms/typing, unopened chats, multiple tabs,
server-published edits/deletions, membership revocation, failed writes, missed
updates, logout, and socket expiry.

Run `npm test`, `npm run lint`, and `npm run build` in `client/`. React tests also
cover reconnect refetches, missed membership changes, and stale history/summaries
racing live edits and removals.
