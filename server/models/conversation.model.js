import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    deletedAt: { type: Date, default: null },
    revision: { type: Number, default: 0 },
    memberships: [{
        _id: false,
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        joinedAt: { type: Date, required: true },
        // Disambiguates messages written in the same millisecond as a join.
        joinedAfterMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
        readAt: { type: Date, default: null },
        readMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
    }],
    conversationName : {
        type : String,
        required : true
    },
    participants : [{
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    }],
    latestMessage : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Message',
        default : null
    },
    isGroup : {
        type : Boolean,
        default : false
    },
    groupAdmin : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User'
    }
}, {
    timestamps : true
})

conversationSchema.pre('save', function () { this.revision = (this.revision || 0) + 1; });
const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
