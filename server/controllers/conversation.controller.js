import expressAsyncHandler from "express-async-handler";
import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.model.js";
import mongoose from "mongoose";

const createGroupChat = (async(req, res) => {
   try {
     const { conversationName, participants } = req.body;
     const user = req.user._id;
 
     if (!participants.includes(user)) {
         participants.push(user);
     }
 
     const existingGroup = await Conversation.findOne({
         isGroup: true,
         participants: { $all: participants, $size: participants.length }
     });
     
     if (existingGroup) {
         const populatedGroup = await existingGroup.populate('participants', '-password');
         return res.status(200).json({
             message: "Group already exists",
             conversation: populatedGroup
         });
     }
 
     const newConversation = new Conversation({
         conversationName,
         participants,
         isGroup: true,
         groupAdmin: user
     });
 
     const savedConversation = await newConversation.save();

     const populatedNewGroup = await savedConversation.populate('participants', '-password')
     return res.status(201).json({
         message: "Group created successfully",
         conversation : populatedNewGroup
     });
   } catch (err) {
    console.error(err.message)
   }
});

const createPersonalChat = expressAsyncHandler(async(req, res) => {
    const {participants} = req.body;
    const otherUserId = new mongoose.Types.ObjectId(participants[0]);
    const userId = req.user._id;
    
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
        return res.status(404).json({ message: "User not found" });
    }
    
    const existingConversation = await Conversation.findOne({
        isGroup: false,
        participants: { $all: [userId, otherUserId]}
    });
    
    if (existingConversation) {
        const populatedConversation = await existingConversation.populate([
            { path: 'participants', select: '-password' },
            { path: 'latestMessage' },
            { path: 'latestMessage.sender', select: '-password' },
        ]);

        return res.status(200).json({ 
            message: "Conversation found",
            conversation: populatedConversation
        });
    }

    const newConversation = new Conversation({
        isGroup: false,
        participants: [userId, otherUserId],
        conversationName: otherUser.username
    });

    const savedConversation = await newConversation.save();
    
    const populatedNewConversation = await savedConversation.populate([
        { path: 'participants', select: '-password' },
        { path: 'latestMessage' },
        { path: 'latestMessage.sender', select: '-password' },
    ]);
  
    return res.status(201).json({
        message: "Personal Chat created",
        conversation: populatedNewConversation 
    });
});


const getConversation = expressAsyncHandler(async(req, res)=> {
    const userId = req.user._id;
    const conversations = await Conversation.find({participants : userId})
    .populate('participants', '-password')  
    .populate('latestMessage')
    .populate('latestMessage.sender', '-password');

    return res.status(200).json({
        message : "Conversations fetched",
        conversations
    })
})


const getParticipants = expressAsyncHandler(async(req,res)=>{
    const conversationId = req.params.id;
    const participants = await Conversation.findById(conversationId).select('participants', '-password');
    return res.status(200).json({
        message : "Participants got successfully",
        participants
    })
})

const updateConversation = expressAsyncHandler(async(req, res) => {
    const { conversationId, operation, data } = req.body;
    const userId = req.user._id;

    // to be continued
});

const deleteConversation = expressAsyncHandler(async(req, res) => {
    const  conversationId  = req.params.conversationId;
    const userId = req.user._id;

    // to be continued
});

export {
    createGroupChat,
    createPersonalChat,
    getConversation,
    getParticipants,
    updateConversation,
    deleteConversation
}
