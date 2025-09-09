# Chat-App - Real-Time Chat App

Chat-App is a full stack real time chat application build with React, Node.js, Socket.io, and MongoDB.

## Features 

- User Authentication (Sign up , Login , JWT + Cookies)
- Avatar upload with Cloudinary
- Real-Time Chat using Socket.io
- Error Handling and Form validation

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
cd 360Link
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

