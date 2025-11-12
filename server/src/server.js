

// import dotenv from "dotenv";
// import express from "express";
// import fs from "fs";
// import http from "http";
// import path from "path";
// import app from "./app.js";
// import connectDB from "./config/db.js";
// import { initSocket } from "./sockets/index.js";

// dotenv.config();

// const PORT = process.env.PORT || 4000;

// (async () => {
//   try {
//     await connectDB(process.env.DB_URI);
//     const server = http.createServer(app);

//     /* -------------------------------------------------------------------------- */
//     /* ✅ Serve Uploaded Files (avatars + chat media)                             */
//     /* -------------------------------------------------------------------------- */
//     const uploadsBase = path.resolve("server/uploads");

//     // ✅ General uploads directory (for both avatars & chat files)
//     app.use("/uploads", express.static(uploadsBase));

//     // ✅ Ensure separate folders exist for avatars & chat
    
//     const avatarDir = path.join(uploadsBase, "avatars");
//     const chatDir = path.join(uploadsBase, "chat");
//     if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
//     if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

//     // ✅ Explicitly serve subfolders (extra reliability on some hosts)
//     app.use("/uploads/avatars", express.static(avatarDir));
//     app.use("/uploads/chat", express.static(chatDir));

//     /* -------------------------------------------------------------------------- */
//     /* ✅ Initialize Socket.io + Start Server                                     */
//     /* -------------------------------------------------------------------------- */
//     initSocket(server);
//     server.listen(PORT, () =>
//       console.log(`🚀 Server running on port ${PORT}`)
//     );

//     console.log("✅ Static uploads served at: /uploads");
//     console.log("📁 Avatar uploads folder:", avatarDir);
//     console.log("💬 Chat uploads folder:", chatDir);
//   } catch (err) {
//     console.error("❌ Failed to start server:", err);
//   }
// })();





import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import http from "http";
import path from "path";
import app from "./app.js";
import connectDB from "./config/db.js";
import groupRoutes from "./routes/groupRoutes.js"; // ✅ Added
import { initSocket } from "./sockets/index.js";

dotenv.config();

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await connectDB(process.env.DB_URI);
    const server = http.createServer(app);

    /* -------------------------------------------------------------------------- */
    /* ✅ Serve Uploaded Files (avatars + chat media)                             */
    /* -------------------------------------------------------------------------- */
    const uploadsBase = path.resolve("server/uploads");

    // ✅ General uploads directory (for both avatars & chat files)
    app.use("/uploads", express.static(uploadsBase));

    // ✅ Ensure separate folders exist for avatars & chat
    const avatarDir = path.join(uploadsBase, "avatars");
    const chatDir = path.join(uploadsBase, "chat");
    if (!fs.existsSync(avatarDir)) fs.mkdirSync(avatarDir, { recursive: true });
    if (!fs.existsSync(chatDir)) fs.mkdirSync(chatDir, { recursive: true });

    // ✅ Explicitly serve subfolders (extra reliability on some hosts)
    app.use("/uploads/avatars", express.static(avatarDir));
    app.use("/uploads/chat", express.static(chatDir));

    /* -------------------------------------------------------------------------- */
    /* ✅ Register New Group Routes                                               */
    /* -------------------------------------------------------------------------- */
    app.use("/api/groups", groupRoutes); // ✅ Added

    /* -------------------------------------------------------------------------- */
    /* ✅ Initialize Socket.io + Start Server                                     */
    /* -------------------------------------------------------------------------- */
    initSocket(server);
    server.listen(PORT, () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );

    console.log("✅ Static uploads served at: /uploads");
    console.log("📁 Avatar uploads folder:", avatarDir);
    console.log("💬 Chat uploads folder:", chatDir);
  } catch (err) {
    console.error("❌ Failed to start server:", err);
  }
})();
