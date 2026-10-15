import mongoose from 'mongoose';
import { ApiError } from './ApiError.js';

export function objectId(value, name = 'ID') {
    if (typeof value !== 'string' || !mongoose.isObjectIdOrHexString(value)) {
        throw new ApiError(400, `Invalid ${name}`);
    }
    return value.toLowerCase();
}

export function textValue(value, name, max = 10000) {
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
        throw new ApiError(400, `${name} must be a nonempty string of at most ${max} characters`);
    }
    return value.trim();
}

export function idList(value) {
    if (!Array.isArray(value) || !value.length || value.length > 100) {
        throw new ApiError(400, 'participants must be an array of 1 to 100 user IDs');
    }
    return [...new Set(value.map(id => objectId(id, 'user ID')))];
}
