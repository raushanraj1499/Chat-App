import mongoose from 'mongoose';

export default async function connectDB() {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    console.log('Database connected successfully');
}
