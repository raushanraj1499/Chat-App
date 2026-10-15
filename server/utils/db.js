import mongoose from 'mongoose';

export default async function connectDB() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
        console.log('Database connected successfully');
    } catch (cause) {
        // Keep credentials and connection-string details out of deployment logs.
        throw new Error('MongoDB connection failed. Verify MONGODB_URI and Atlas Network Access.', { cause });
    }
}
