

// server/src/models/Chat.js
import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    isGroup: {
      type: Boolean,
      default: false,
    },

    // All members (ObjectId references)
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    /* ---------------------------------------------------------------------- */
    /* 🧩 GROUP CHAT FIELDS (Do NOT remove or modify — required for UI)       */
    /* ---------------------------------------------------------------------- */
    groupName: {
      type: String,
      trim: true,
      default: "",
    },
    groupAvatar: {
      type: String,
      trim: true,
      default: "",
    },
    groupDescription: {
      type: String,
      trim: true,
      default: "",
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /* ---------------------------------------------------------------------- */
    /* 📌 LAST MESSAGE POINTER                                                */
    /* ---------------------------------------------------------------------- */
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    /* ---------------------------------------------------------------------- */
    /* 📌 CREATOR OF CHAT                                                     */
    /* ---------------------------------------------------------------------- */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    /* ---------------------------------------------------------------------- */
    /* 📌 OPTIONAL READ-BY FIELD (SAFE, DOES NOT BREAK ANYTHING)              */
    /* ---------------------------------------------------------------------- */
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true }
);

/* -------------------------------------------------------------------------- */
/* 📌 Index for faster private & group chat lookup                            */
/* -------------------------------------------------------------------------- */
chatSchema.index({ participants: 1 });

export default mongoose.model("Chat", chatSchema);
