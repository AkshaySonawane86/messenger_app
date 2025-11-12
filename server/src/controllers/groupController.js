// // server/src/controllers/groupController.js
// import Chat from "../models/Chat.js";
// import User from "../models/User.js";

// /* -------------------------------------------------------------------------- */
// /* ✅ Create New Group                                                        */
// /* -------------------------------------------------------------------------- */
// export const createGroup = async (req, res) => {
//   try {
//     const { name, members, adminId, avatar, description } = req.body;
//     if (!name || !adminId)
//       return res.status(400).json({ ok: false, error: "missing_required_fields" });

//     const admin = await User.findById(adminId);
//     if (!admin) return res.status(404).json({ ok: false, error: "admin_not_found" });

//     const participantIds = [...new Set([adminId, ...(members || [])])];
//     const group = await Chat.create({
//       isGroup: true,
//       participants: participantIds,
//       groupAdmin: adminId,
//       groupName: name,
//       groupAvatar: avatar || "",
//       groupDescription: description || "",
//       createdBy: adminId,
//     });

//     res.json({ ok: true, group });
//   } catch (err) {
//     console.error("❌ Error creating group:", err);
//     res.status(500).json({ ok: false, error: "server_error" });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /* ✅ Rename Group / Update Avatar / Description                              */
// /* -------------------------------------------------------------------------- */
// export const renameGroup = async (req, res) => {
//   try {
//     const { groupId, name, avatar, description } = req.body;
//     const group = await Chat.findById(groupId);
//     if (!group || !group.isGroup)
//       return res.status(404).json({ ok: false, error: "group_not_found" });

//     if (name) group.groupName = name;
//     if (avatar) group.groupAvatar = avatar;
//     if (description) group.groupDescription = description;

//     await group.save();
//     res.json({ ok: true, group });
//   } catch (err) {
//     console.error("❌ Error renaming group:", err);
//     res.status(500).json({ ok: false, error: "server_error" });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /* ✅ Add Member to Group (Admin Only)                                        */
// /* -------------------------------------------------------------------------- */
// export const addToGroup = async (req, res) => {
//   try {
//     const { groupId, userId, requesterId } = req.body;
//     const group = await Chat.findById(groupId);
//     if (!group || !group.isGroup)
//       return res.status(404).json({ ok: false, error: "group_not_found" });

//     if (String(group.groupAdmin) !== String(requesterId))
//       return res.status(403).json({ ok: false, error: "not_group_admin" });

//     if (!group.participants.includes(userId)) {
//       group.participants.push(userId);
//       await group.save();
//     }

//     res.json({ ok: true, group });
//   } catch (err) {
//     console.error("❌ Error adding to group:", err);
//     res.status(500).json({ ok: false, error: "server_error" });
//   }
// };

// /* -------------------------------------------------------------------------- */
// /* ✅ Remove Member / Leave Group                                             */
// /* -------------------------------------------------------------------------- */
// export const removeFromGroup = async (req, res) => {
//   try {
//     const { groupId, userId, requesterId } = req.body;
//     const group = await Chat.findById(groupId);
//     if (!group || !group.isGroup)
//       return res.status(404).json({ ok: false, error: "group_not_found" });

//     if (
//       String(group.groupAdmin) !== String(requesterId) &&
//       String(userId) !== String(requesterId)
//     ) {
//       return res.status(403).json({ ok: false, error: "not_authorized" });
//     }

//     group.participants = group.participants.filter(
//       (id) => String(id) !== String(userId)
//     );
//     await group.save();

//     res.json({ ok: true, group });
//   } catch (err) {
//     console.error("❌ Error removing from group:", err);
//     res.status(500).json({ ok: false, error: "server_error" });
//   }
// };





// server/src/controllers/groupController.js
import Chat from "../models/Chat.js";
import User from "../models/User.js";

/* -------------------------------------------------------------------------- */
/* ✅ Create New Group                                                        */
/* -------------------------------------------------------------------------- */
export const createGroup = async (req, res) => {
  try {
    // Accept both frontend and old backend field names
    const {
      groupName,
      name,
      participants,
      members,
      avatar,
      description,
    } = req.body;

    // Determine effective values
    const finalName = groupName || name;
    const finalMembers = participants || members || [];

    // Extract admin from token (for security)
    const adminId = req.user?.id || req.user?._id || req.body.adminId;

    if (!finalName || !adminId) {
      return res
        .status(400)
        .json({ ok: false, error: "missing_required_fields" });
    }

    const admin = await User.findById(adminId);
    if (!admin)
      return res.status(404).json({ ok: false, error: "admin_not_found" });

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

    console.log("✅ Group created:", group.groupName);
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
    if (description) group.groupDescription = description;

    await group.save();
    res.json({ ok: true, group });
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

    res.json({ ok: true, group });
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

    res.json({ ok: true, group });
  } catch (err) {
    console.error("❌ Error removing from group:", err);
    res.status(500).json({ ok: false, error: "server_error" });
  }
};
