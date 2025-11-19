

// server/src/middleware/upload.js
import fs from "fs";
import multer from "multer";
import path from "path";

const baseDir = path.resolve("server/uploads");
const avatarDir = path.join(baseDir, "avatars");
const chatDir = path.join(baseDir, "chat");

[baseDir, avatarDir, chatDir].forEach((d) => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const url = req.originalUrl || "";
    const dest =
      url.includes("upload-avatar") || url.includes("groups/avatar")
        ? avatarDir
        : chatDir;
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

export default multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
});
