import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import Conversation from "../models/conversation.model.js";
import expressAsyncHandler from "express-async-handler";

// create, read, update , delete
const createMessage = expressAsyncHandler(async(req, res) => {
    console.log('this is create message route');
    const { content } = req.body;
    const sender = req.user._id;
    const conversationId = req.params.conversationId;

    if (!content || content.trim().length === 0) {
        return res.status(400).json({
            message: "Message content cannot be empty"
        });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
        return res.status(404).json({
            message: "Conversation not found"
        });
    }

    if (!conversation.participants.includes(sender)) {
        return res.status(403).json({
            message: "User not authorized to send messages in this conversation"
        });
    }

    const newMessage = await Message.create({
        content: content.trim(),
        sender,
        conversation: conversationId
    });

    const populatedMessage = await Message.findById(newMessage._id)
        .populate('sender', '-password');

    await Conversation.findByIdAndUpdate(conversationId, {
        latestMessage: newMessage._id,
        updatedAt: new Date()
    });

    return res.status(201).json({
        message: "Message created successfully",
        data: populatedMessage  
    });
});

const getMessage = expressAsyncHandler(async(req, res) => {
    const conversationId = req.params.conversationId;
    const userId = req.user._id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
        return res.status(404).json({
            message: "Conversation not found"
        });
    }

    if (!conversation.participants.includes(userId)) {
        return res.status(403).json({
            message: "User not authorized to view messages"
        });
    }

    const messages = await Message.find({ conversation: conversationId })
        .sort({ createdAt: 1 })
        .populate("sender", "-password");

    return res.status(200).json({
        message: "Messages fetched successfully",
        messages
    });
});

const editMessage = expressAsyncHandler(async(req, res) => {
    const { messageId, content } = req.body;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
        return res.status(400).json({
            message: "Message content cannot be empty"
        });
    }

    const message = await Message.findById(messageId);
    if (!message) {
        return res.status(404).json({
            message: "Message not found"
        });
    }

    if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({
            message: "You can only edit your own messages"
        });
    }

    const updatedMessage = await Message.findByIdAndUpdate(
        messageId,
        {
            content: content.trim(),
            updatedAt: new Date(),
            isEdited: true
        },
        { new: true }
    ).populate('sender', '-password');

    return res.status(200).json({
        message: "Message updated successfully",
        data: updatedMessage
    });
});

const deleteMessage = expressAsyncHandler(async(req, res) => {
    const { messageId } = req.body;
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
        return res.status(404).json({
            message: "Message not found"
        });
    }

    if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({
            message: "You can only delete your own messages"
        });
    }

    const conversationId = message.conversation;

    await Message.findByIdAndDelete(messageId);

    const conversation = await Conversation.findById(conversationId);
    if (conversation.latestMessage && conversation.latestMessage.toString() === messageId) {
        const newLatestMessage = await Message.findOne({ 
            conversation: conversationId 
        }).sort({ createdAt: -1 });

        await Conversation.findByIdAndUpdate(conversationId, {
            latestMessage: newLatestMessage ? newLatestMessage._id : null,
            updatedAt: new Date()
        });
    }

    return res.status(200).json({
        message: "Message deleted successfully"
    });
});

export {
    createMessage,
    getMessage,
    editMessage,
    deleteMessage
};
