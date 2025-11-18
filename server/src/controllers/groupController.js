
// server/src/controllers/groupController.js
import path from "path";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

/* -------------------------------------------------------------------------- */
/* ✅ Create New Group                                                        */
/* -------------------------------------------------------------------------- */
export const createGroup = async (req, res) => {
  try {
    const { groupName, name, participants, members, avatar, description } = req.body;
    const finalName = groupName || name;
    const finalMembers = participants || members || [];
    const adminId = req.user?.id || req.user?._id || req.body.adminId;

    if (!finalName || !adminId)
      return res.status(400).json({ ok: false, error: "missing_required_fields" });

    const admin = await User.findById(adminId);
    if (!admin) return res.status(404).json({ ok: false, error: "admin_not_found" });

    const participantIds = [...new Set([adminId, ...finalMembers])];
    const group = await Chat.create({
      isGroup: true,
      participants: participantIds,
      groupAdmin: adminId,
      groupName: finalName,
      groupAvatar: avatar || "",
      groupDescription: description || "",
      createdBy: adminId,
    });

    res.json({ ok: true, group });
  } catch (err) {
    console.error("❌ Error creating group:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Rename Group / Update Avatar / Description                              */
/* -------------------------------------------------------------------------- */
export const renameGroup = async (req, res) => {
  try {
    const { groupId, name, avatar, description } = req.body;
    const group = await Chat.findById(groupId);
    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    if (name) group.groupName = name;
    if (avatar) group.groupAvatar = avatar;
    if (description !== undefined) group.groupDescription = description;

    await group.save();

    const populated = await Chat.findById(groupId)
      .populate("participants", "name email avatarUrl")
      .populate("groupAdmin", "name email avatarUrl");

    res.json({ ok: true, group: populated });
  } catch (err) {
    console.error("❌ Error renaming group:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Add Member to Group (Admin Only)                                        */
/* -------------------------------------------------------------------------- */
export const addToGroup = async (req, res) => {
  try {
    const { groupId, userId, requesterId } = req.body;
    const group = await Chat.findById(groupId);
    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    if (String(group.groupAdmin) !== String(requesterId))
      return res.status(403).json({ ok: false, error: "not_group_admin" });

    if (!group.participants.includes(userId)) {
      group.participants.push(userId);
      await group.save();
    }

    const updated = await Chat.findById(groupId)
      .populate("participants", "name email avatarUrl")
      .populate("groupAdmin", "name email avatarUrl");

    res.json({ ok: true, group: updated });
  } catch (err) {
    console.error("❌ Error adding to group:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Remove Member / Leave Group                                             */
/* -------------------------------------------------------------------------- */
export const removeFromGroup = async (req, res) => {
  try {
    const { groupId, userId, requesterId } = req.body;
    const group = await Chat.findById(groupId);
    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    if (
      String(group.groupAdmin) !== String(requesterId) &&
      String(userId) !== String(requesterId)
    ) {
      return res.status(403).json({ ok: false, error: "not_authorized" });
    }

    group.participants = group.participants.filter(
      (id) => String(id) !== String(userId)
    );
    await group.save();

    const updated = await Chat.findById(groupId)
      .populate("participants", "name email avatarUrl")
      .populate("groupAdmin", "name email avatarUrl");

    res.json({ ok: true, group: updated });
  } catch (err) {
    console.error("❌ Error removing from group:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Get Group Info (members + admin + avatar + description)                 */
/* -------------------------------------------------------------------------- */
export const getGroupInfo = async (req, res) => {
  try {
    const group = await Chat.findById(req.params.id)
      .populate("participants", "name email avatarUrl")
      .populate("groupAdmin", "name email avatarUrl");

    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    // Construct full avatar URL if exists
    const fullAvatarUrl = group.groupAvatar
      ? `${req.protocol}://${req.get("host")}${group.groupAvatar}`
      : "";

    res.json({
      ok: true,
      group: {
        ...group.toObject(),
        groupAvatar: fullAvatarUrl,
        totalMembers: group.participants.length,
      },
    });
  } catch (err) {
    console.error("❌ getGroupInfo error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Leave Group (admin cannot leave)                                        */
/* -------------------------------------------------------------------------- */
export const leaveGroup = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { groupId } = req.body;

    const group = await Chat.findById(groupId);
    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    if (String(group.groupAdmin) === String(userId)) {
      return res.status(400).json({ ok: false, error: "admin_cannot_leave" });
    }

    group.participants = group.participants.filter(
      (id) => String(id) !== String(userId)
    );
    await group.save();

    res.json({ ok: true, message: "left_group", group });
  } catch (err) {
    console.error("❌ leaveGroup error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};

/* -------------------------------------------------------------------------- */
/* ✅ Upload / Update Group Avatar (Admin Only)                               */
/* -------------------------------------------------------------------------- */
export const updateGroupAvatar = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = req.user?.id || req.user?._id;
    const group = await Chat.findById(groupId);

    if (!group || !group.isGroup)
      return res.status(404).json({ ok: false, error: "group_not_found" });

    if (String(group.groupAdmin) !== String(userId))
      return res.status(403).json({ ok: false, error: "not_group_admin" });

    if (!req.file)
      return res.status(400).json({ ok: false, error: "no_file_uploaded" });

    const avatarPath = `/uploads/avatars/${path.basename(req.file.path)}`;
    group.groupAvatar = avatarPath;
    await group.save();

    // Build full URL for frontend display
    const fullUrl = `${req.protocol}://${req.get("host")}${avatarPath}`;

    res.json({ ok: true, group, avatarUrl: fullUrl });
  } catch (err) {
    console.error("❌ updateGroupAvatar error:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};
 