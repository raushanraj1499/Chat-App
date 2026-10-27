import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
    isEdited: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    content : {
        type : String,
        required: function () { return !this.deletedAt; }
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

messageSchema.index({ conversation: 1, createdAt: -1, _id: -1 });
const Message = mongoose.model('Message', messageSchema);
export default Message
