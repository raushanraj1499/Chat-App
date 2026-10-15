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
are excluded from lists and reject history and mutations. These paths support
point 2's server events and revocation; the complete group/message action UI,
join-time visibility, pagination, unread tracking, and migration remain work for
the later plan points. Existing records work without a migration for this step.

### Configuration and production

Use Node.js 22.9 or newer. Copy `server/.env.example` to `server/.env` and fill in
MongoDB, JWT, and Cloudinary values. Startup exits with a nonzero status if required
configuration is missing or MongoDB cannot connect. Failures return JSON with
`{ success: false, message }`; internal errors do not expose credentials.

The default deployment serves the built client, API, and sockets on one app origin.
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
