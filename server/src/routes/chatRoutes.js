

// server/src/routes/chatRoutes.js
import express from "express";
import fs from "fs";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";

const router = express.Router();

/* -------------------------------------------------------------------------- */
/* 🧩 Multer setup for chat file uploads                                      */
/* -------------------------------------------------------------------------- */
const chatUploadDir = path.resolve("server/uploads/chat");

if (!fs.existsSync(chatUploadDir)) {
  fs.mkdirSync(chatUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, chatUploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/plain",
    "video/mp4",
    "audio/mpeg",
  ];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Invalid file type"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB limit
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/chats                                                          */
/* -------------------------------------------------------------------------- */
router.get("/", async (req, res) => {
  try {
    const userId = req.query.userId || "672f7cc1f82b15f001";
    const chats = await Chat.find({ participants: userId })
      .populate("lastMessage")
      .lean();

    if (!chats.length) {
      return res.json({
        ok: true,
        chats: [
          {
            _id: "testChat1",
            name: "John Doe",
            lastMessage: { content: "Hey there!" },
            updatedAt: new Date(),
          },
          {
            _id: "testChat2",
            name: "Sarah",
            lastMessage: { content: "Let's meet tomorrow!" },
            updatedAt: new Date(),
          },
        ],
      });
    }

    res.json({ ok: true, chats });
  } catch (err) {
    console.error("❌ Error loading chats:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ GET /api/chats/:chatId/messages                                         */
/* -------------------------------------------------------------------------- */
router.get("/:chatId/messages", async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit || 50, 10);

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      console.warn(`⚠️ Using mock data for chatId: ${chatId}`);
      return res.json({
        ok: true,
        messages: [
          {
            _id: "mock1",
            chatId,
            senderId: "user1",
            content: "Hey there 👋",
            createdAt: new Date(Date.now() - 60000),
          },
          {
            _id: "mock2",
            chatId,
            senderId: "user2",
            content: "Hello! How are you?",
            createdAt: new Date(),
          },
        ],
      });
    }

    const messages = await Message.find({ chatId })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({ ok: true, messages });
  } catch (err) {
    console.error("❌ Error loading messages:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/chats/create                                                  */
/* -------------------------------------------------------------------------- */
router.post("/create", async (req, res) => {
  try {
    const { userA, userB } = req.body;
    if (!userA || !userB)
      return res.status(400).json({ ok: false, error: "missing_participants" });

    // prevent self-chat
    if (String(userA) === String(userB)) {
      return res
        .status(400)
        .json({ ok: false, error: "cannot_chat_with_self" });
    }

    const resolveUserId = async (identifier) => {
      if (mongoose.Types.ObjectId.isValid(identifier)) return identifier;
      const user = await User.findOne({
        email: identifier.trim().toLowerCase(),
      });
      return user ? user._id : null;
    };

    const aId = await resolveUserId(userA);
    const bId = await resolveUserId(userB);

    if (!aId || !bId)
      return res
        .status(404)
        .json({ ok: false, error: "user_not_found_or_invalid" });

    let chat = await Chat.findOne({
      isGroup: false,
      participants: { $all: [aId, bId], $size: 2 },
    }).lean();

    if (chat) return res.json({ ok: true, chat });

    const created = await Chat.create({
      isGroup: false,
      participants: [aId, bId],
      createdBy: aId,
    });

    chat = await Chat.findById(created._id).populate("lastMessage").lean();

    console.log(`💬 New chat created between ${aId} & ${bId}`);
    res.json({ ok: true, chat });
  } catch (err) {
    console.error("❌ Error creating chat:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

/* -------------------------------------------------------------------------- */
/* ✅ POST /api/chats/upload (media/file upload for chat messages)            */
/* -------------------------------------------------------------------------- */
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ ok: false, error: "no_file_uploaded" });

    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith("image")
      ? "image"
      : req.file.mimetype.startsWith("video")
      ? "video"
      : req.file.mimetype.startsWith("audio")
      ? "audio"
      : "file";

    const file = {
      url: fileUrl,
      type: fileType,
      name: req.file.originalname,
    };

    console.log(`📎 Uploaded chat file: ${req.file.originalname}`);

    res.json({ ok: true, file });
  } catch (err) {
    console.error("❌ Chat upload error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
});

export default router;
