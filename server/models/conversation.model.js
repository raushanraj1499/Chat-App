import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
    deletedAt: { type: Date, default: null },
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

const Conversation = mongoose.model('Conversation', conversationSchema);
export default Conversation;
