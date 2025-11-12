// server/src/routes/groupRoutes.js
import express from "express";
import {
    addToGroup,
    createGroup,
    removeFromGroup,
    renameGroup,
} from "../controllers/groupController.js";

const router = express.Router();

// POST /api/groups/create
router.post("/create", createGroup);

// PUT /api/groups/rename
router.put("/rename", renameGroup);

// PUT /api/groups/add
router.put("/add", addToGroup);

// PUT /api/groups/remove
router.put("/remove", removeFromGroup);

export default router;
