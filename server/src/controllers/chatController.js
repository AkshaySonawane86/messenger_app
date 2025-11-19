// server/src/controllers/chatController.js
import Chat from "../models/Chat.js";

/* -------------------------------------------------------------------------- */
/* ✅ Get all chats (personal + groups) for a user                            */
/* -------------------------------------------------------------------------- */
export const getMyChats = async (req, res) => {
  try {
    // Get userId from query or authenticated user
    const userId = req.user?.id || req.user?._id || req.query.userId;

    if (!userId) {
      return res.status(400).json({ ok: false, error: "missing_user_id" });
    }

    const chats = await Chat.find({ participants: userId })
      .populate("participants", "name email avatarUrl")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({ ok: true, chats });
  } catch (err) {
    console.error("❌ Error fetching user chats:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};
