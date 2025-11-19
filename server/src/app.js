
// server/src/app.js
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import groupRoutes from "./routes/groupRoutes.js"; // ✅ NEW

dotenv.config();

const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(path.resolve("server/uploads")));

// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/groups", groupRoutes); // ✅ NEW

app.get("/", (req, res) => res.send("Messenger API running ✅"));
export default app;
