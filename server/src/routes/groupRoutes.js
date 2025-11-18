

// server/src/routes/groupRoutes.js
import express from "express";
import {
  addToGroup,
  createGroup,
  getGroupInfo,
  leaveGroup,
  removeFromGroup,
  renameGroup,
  updateGroupAvatar, // ✅ NEW
} from "../controllers/groupController.js";
import authMiddleware from "../middleware/auth.js";
import upload from "../middleware/upload.js"; // ✅ for image upload

const router = express.Router();

// ✅ Core group APIs
router.post("/create", authMiddleware, createGroup);
router.put("/rename", authMiddleware, renameGroup);
router.put("/add", authMiddleware, addToGroup);
router.put("/remove", authMiddleware, removeFromGroup);

// ✅ New APIs
router.get("/:id", authMiddleware, getGroupInfo);
router.delete("/leave", authMiddleware, leaveGroup);

// ✅ Upload / Update group avatar (admin only)
router.put(
  "/avatar/:id",
  authMiddleware,
  upload.single("avatar"),
  updateGroupAvatar
);

export default router;
