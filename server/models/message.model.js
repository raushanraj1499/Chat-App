import mongoose from "mongoose";
import User from "./user.model.js";
import Conversation from "./conversation.model.js";

const messageSchema = new mongoose.Schema({
    content : {
        type : String,
        required : true
    },
    sender : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'User',
        required : true
    },
    conversation : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'Conversation',
        required : true
    }
}, {
    timestamps : true
})

const Message = mongoose.model('Message', messageSchema);
export default Message