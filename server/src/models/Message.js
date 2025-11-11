

// server/src/models/Message.js
import mongoose from "mongoose";

/* -------------------------------------------------------------------------- */
/* ✅ Define Attachment Subschema — allows proper validation for all types    */
/* -------------------------------------------------------------------------- */
const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["image", "file", "audio", "video"],
      default: "file",
    },
    name: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/* -------------------------------------------------------------------------- */
/* ✅ Main Message Schema (now supports location + live location)             */
/* -------------------------------------------------------------------------- */
const messageSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: {
      type: mongoose.Schema.Types.Mixed, // ✅ can hold text or { lat, lng }
      default: "",
    },
    contentType: {
      type: String,
      enum: ["text", "image", "file", "audio", "video", "location"],
      default: "text",
    },
    attachments: { type: [attachmentSchema], default: [] },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      default: "sent",
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export default mongoose.model("Message", messageSchema);
