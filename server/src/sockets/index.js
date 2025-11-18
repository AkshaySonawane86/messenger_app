

// // server/src/sockets/index.js
// import mongoose from "mongoose";
// import { Server } from "socket.io";
// import Chat from "../models/Chat.js";
// import Message from "../models/Message.js";
// import User from "../models/User.js";
// import { socketAuthMiddleware } from "./auth.js";

// let io;

// export function initSocket(server) {
//   io = new Server(server, {
//     cors: { origin: "*" },
//     pingTimeout: 60000,
//   });

//   io.use(socketAuthMiddleware);

//   io.on("connection", (socket) => {
//     const userId = socket.user?.id;
//     const deviceId = socket.handshake?.auth?.deviceId || null;
//     const userAgent = socket.handshake?.headers?.["user-agent"] || "";

//     console.log(`✅ Socket connected: ${socket.id} (user: ${userId})`);

//     /* ------------------------------------------------------------- */
//     /*  Presence + device registration                               */
//     /* ------------------------------------------------------------- */
//     (async () => {
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           await User.updateOne(
//             { _id: userId },
//             {
//               $push: {
//                 devices: {
//                   deviceId,
//                   socketId: socket.id,
//                   lastSeen: new Date(),
//                   userAgent,
//                 },
//               },
//             }
//           ).catch(() => {});

//           socket.join(`user:${userId}`);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: true,
//             lastSeen: null,
//           });
//         }
//       } catch (err) {
//         console.error("❌ presence register error:", err);
//       }
//     })();

//     /* ------------------------------------------------------------- */
//     /* Typing indicators                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("typing:start", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: true,
//       });
//     });

//     socket.on("typing:stop", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: false,
//       });
//     });

//     /* ------------------------------------------------------------- */
//     /* Join chat room                                                */
//     /* ------------------------------------------------------------- */
//     socket.on("chat:join", async ({ chatId }, cb) => {
//       try {
//         if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
//         socket.join(`chat:${chatId}`);
//         cb?.({ ok: true });
//       } catch (err) {
//         console.error("❌ chat:join error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /*  MAIN FIXED SECTION — message:send                            */
//     /* ------------------------------------------------------------- */
//     socket.on("message:send", async (payload, ack) => {
//       try {
//         const { chatId, content, contentType, attachments } = payload;

//         if (!mongoose.Types.ObjectId.isValid(chatId)) {
//           return ack?.({ ok: false, error: "invalid_chat_id" });
//         }

//         // ✅ FIX APPLIED HERE — removed `.lean()`
//         const chat = await Chat.findById(chatId).exec();
//         if (!chat) return ack?.({ ok: false, error: "chat_not_found" });

//         const normalizedAttachments = (attachments || []).map((a) => ({
//           url: a.url?.startsWith("http")
//             ? a.url
//             : `${process.env.API_BASE || "http://localhost:4000"}${a.url}`,
//           type: a.type,
//           name: a.name,
//         }));

//         const messageDoc = await Message.create({
//           chatId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: normalizedAttachments,
//           status: "sent",
//         });

//         chat.lastMessage = messageDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(messageDoc._id),
//           chatId: String(chatId),
//           senderId: String(userId),
//           content,
//           contentType: messageDoc.contentType,
//           attachments: messageDoc.attachments,
//           createdAt: messageDoc.createdAt,
//           status: messageDoc.status,
//         };

//         /* ------------------------------------------------------------- */
//         /*        FIXED BROADCAST LOGIC (GROUP + PRIVATE)                */
//         /* ------------------------------------------------------------- */
//         const recipients = chat.participants
//           .map((p) => String(p))
//           .filter((p) => p !== String(userId));

//         recipients.forEach((uid) => {
//           io.to(`user:${uid}`).emit("message:new", msgData);
//         });

//         // sender gets delivered status update
//         io.to(`user:${userId}`).emit("message:update", {
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//           status: "delivered",
//         });

//         ack?.({
//           ok: true,
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//         });
//       } catch (err) {
//         console.error("❌ message:send error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Mark messages as read                                         */
//     /* ------------------------------------------------------------- */
//     socket.on("message:read", async ({ chatId, messageIds }) => {
//       try {
//         if (!Array.isArray(messageIds) || !chatId) return;

//         await Message.updateMany(
//           { _id: { $in: messageIds }, chatId },
//           {
//             $set: { status: "read" },
//             $addToSet: { readBy: socket.user?.id },
//           }
//         );

//         const readMessages = await Message.find({
//           _id: { $in: messageIds },
//         })
//           .select("_id chatId senderId")
//           .lean();

//         readMessages.forEach((msg) => {
//           io.to(`user:${msg.senderId}`).emit("message:update", {
//             messageId: String(msg._id),
//             chatId: String(chatId),
//             status: "read",
//           });
//         });
//       } catch (err) {
//         console.error("❌ message:read error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Disconnect handler                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("disconnect", async () => {
//       console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           const userDoc = await User.findById(userId).lean();
//           const stillOnline = (userDoc?.devices || []).some((d) => d?.socketId);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: !!stillOnline,
//             lastSeen: stillOnline ? null : new Date(),
//           });
//         }
//       } catch (err) {
//         console.error("❌ disconnect presence update error:", err);
//       }
//     });
//   });

//   return io;
// }













// // server/src/sockets/index.js
// import mongoose from "mongoose";
// import { Server } from "socket.io";
// import Chat from "../models/Chat.js";
// import Message from "../models/Message.js";
// import User from "../models/User.js";
// import { socketAuthMiddleware } from "./auth.js";

// let io;

// export function initSocket(server) {
//   io = new Server(server, {
//     cors: { origin: "*" },
//     pingTimeout: 60000,
//   });

//   io.use(socketAuthMiddleware);

//   io.on("connection", (socket) => {
//     const userId = socket.user?.id;
//     const deviceId = socket.handshake?.auth?.deviceId || null;
//     const userAgent = socket.handshake?.headers?.["user-agent"] || "";

//     console.log(`✅ Socket connected: ${socket.id} (user: ${userId})`);

//     /* ------------------------------------------------------------- */
//     /*  Presence + device registration                               */
//     /* ------------------------------------------------------------- */
//     (async () => {
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           await User.updateOne(
//             { _id: userId },
//             {
//               $push: {
//                 devices: {
//                   deviceId,
//                   socketId: socket.id,
//                   lastSeen: new Date(),
//                   userAgent,
//                 },
//               },
//             }
//           ).catch(() => {});

//           socket.join(`user:${userId}`);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: true,
//             lastSeen: null,
//           });
//         }
//       } catch (err) {
//         console.error("❌ presence register error:", err);
//       }
//     })();

//     /* ------------------------------------------------------------- */
//     /* Typing indicators                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("typing:start", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: true,
//       });
//     });

//     socket.on("typing:stop", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: false,
//       });
//     });

//     /* ------------------------------------------------------------- */
//     /* Join chat room (private or group chat shared room)            */
//     /* ------------------------------------------------------------- */
//     socket.on("chat:join", async ({ chatId }, cb) => {
//       try {
//         if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
//         socket.join(`chat:${chatId}`);
//         cb?.({ ok: true });
//       } catch (err) {
//         console.error("❌ chat:join error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /*  NEW: GROUP JOIN                                              */
//     /* ------------------------------------------------------------- */
//     socket.on("group:join", ({ groupId }) => {
//       if (!groupId) return;
//       socket.join(`group:${groupId}`);
//     });

//     /* ------------------------------------------------------------- */
//     /*  NEW: GROUP LEAVE                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("group:leave", ({ groupId }) => {
//       if (!groupId) return;
//       socket.leave(`group:${groupId}`);
//     });

//     /* ------------------------------------------------------------- */
//     /*  NEW: GROUP MESSAGE SEND                                      */
//     /* ------------------------------------------------------------- */
//     socket.on("group:message", async (payload, ack) => {
//       try {
//         const { groupId, content, attachments, contentType } = payload;

//         if (!mongoose.Types.ObjectId.isValid(groupId)) {
//           return ack?.({ ok: false, error: "invalid_group_id" });
//         }

//         const chat = await Chat.findById(groupId).exec();
//         if (!chat || !chat.isGroup) {
//           return ack?.({ ok: false, error: "group_not_found" });
//         }

//         const messageDoc = await Message.create({
//           chatId: groupId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: attachments || [],
//           status: "sent",
//         });

//         chat.lastMessage = messageDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(messageDoc._id),
//           chatId: String(groupId),
//           senderId: String(userId),
//           content,
//           contentType: messageDoc.contentType,
//           attachments: messageDoc.attachments,
//           createdAt: messageDoc.createdAt,
//           status: messageDoc.status,
//         };

//         // Broadcast to all group members
//         io.to(`group:${groupId}`).emit("group:message:new", msgData);

//         ack?.({ ok: true, messageId: msgData._id });
//       } catch (err) {
//         console.error("❌ group:message error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /*  MAIN FIXED SECTION — message:send (private chat)             */
//     /* ------------------------------------------------------------- */
//     socket.on("message:send", async (payload, ack) => {
//       try {
//         const { chatId, content, contentType, attachments } = payload;

//         if (!mongoose.Types.ObjectId.isValid(chatId)) {
//           return ack?.({ ok: false, error: "invalid_chat_id" });
//         }

//         const chat = await Chat.findById(chatId).exec();
//         if (!chat) return ack?.({ ok: false, error: "chat_not_found" });

//         const normalizedAttachments = (attachments || []).map((a) => ({
//           url: a.url?.startsWith("http")
//             ? a.url
//             : `${process.env.API_BASE || "http://localhost:4000"}${a.url}`,
//           type: a.type,
//           name: a.name,
//         }));

//         const messageDoc = await Message.create({
//           chatId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: normalizedAttachments,
//           status: "sent",
//         });

//         chat.lastMessage = messageDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(messageDoc._id),
//           chatId: String(chatId),
//           senderId: String(userId),
//           content,
//           contentType: messageDoc.contentType,
//           attachments: messageDoc.attachments,
//           createdAt: messageDoc.createdAt,
//           status: messageDoc.status,
//         };

//         const recipients = chat.participants
//           .map((p) => String(p))
//           .filter((p) => p !== String(userId));

//         recipients.forEach((uid) => {
//           io.to(`user:${uid}`).emit("message:new", msgData);
//         });

//         io.to(`user:${userId}`).emit("message:update", {
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//           status: "delivered",
//         });

//         ack?.({
//           ok: true,
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//         });
//       } catch (err) {
//         console.error("❌ message:send error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Mark messages as read                                         */
//     /* ------------------------------------------------------------- */
//     socket.on("message:read", async ({ chatId, messageIds }) => {
//       try {
//         if (!Array.isArray(messageIds) || !chatId) return;

//         await Message.updateMany(
//           { _id: { $in: messageIds }, chatId },
//           {
//             $set: { status: "read" },
//             $addToSet: { readBy: socket.user?.id },
//           }
//         );

//         const readMessages = await Message.find({
//           _id: { $in: messageIds },
//         })
//           .select("_id chatId senderId")
//           .lean();

//         readMessages.forEach((msg) => {
//           io.to(`user:${msg.senderId}`).emit("message:update", {
//             messageId: String(msg._id),
//             chatId: String(chatId),
//             status: "read",
//           });
//         });
//       } catch (err) {
//         console.error("❌ message:read error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Disconnect handler                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("disconnect", async () => {
//       console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           const userDoc = await User.findById(userId).lean();
//           const stillOnline = (userDoc?.devices || []).some((d) => d?.socketId);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: !!stillOnline,
//             lastSeen: stillOnline ? null : new Date(),
//           });
//         }
//       } catch (err) {
//         console.error("❌ disconnect presence update error:", err);
//       }
//     });
//   });

//   return io;
// }






// // server/src/sockets/index.js
// import mongoose from "mongoose";
// import { Server } from "socket.io";
// import Chat from "../models/Chat.js";
// import Message from "../models/Message.js";
// import User from "../models/User.js";
// import { socketAuthMiddleware } from "./auth.js";

// let io;

// export function initSocket(server) {
//   io = new Server(server, {
//     cors: { origin: "*" },
//     pingTimeout: 60000,
//   });

//   io.use(socketAuthMiddleware);

//   io.on("connection", (socket) => {
//     const userId = socket.user?.id;
//     const deviceId = socket.handshake?.auth?.deviceId || null;
//     const userAgent = socket.handshake?.headers?.["user-agent"] || "";

//     console.log(`✅ Socket connected: ${socket.id} (user: ${userId})`);

//     /* ------------------------------------------------------------- */
//     /*  Presence + device registration                               */
//     /* ------------------------------------------------------------- */
//     (async () => {
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           await User.updateOne(
//             { _id: userId },
//             {
//               $push: {
//                 devices: {
//                   deviceId,
//                   socketId: socket.id,
//                   lastSeen: new Date(),
//                   userAgent,
//                 },
//               },
//             }
//           ).catch(() => {});

//           socket.join(`user:${userId}`);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: true,
//             lastSeen: null,
//           });
//         }
//       } catch (err) {
//         console.error("❌ presence register error:", err);
//       }
//     })();

//     /* ------------------------------------------------------------- */
//     /* Typing indicators                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("typing:start", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: true,
//       });
//     });

//     socket.on("typing:stop", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: false,
//       });
//     });

//     /* ------------------------------------------------------------- */
//     /* Join chat room (private or group chat shared room)            */
//     /* ------------------------------------------------------------- */
//     socket.on("chat:join", async ({ chatId }, cb) => {
//       try {
//         if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
//         socket.join(`chat:${chatId}`);
//         cb?.({ ok: true });
//       } catch (err) {
//         console.error("❌ chat:join error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /*  GROUP JOIN                                                   */
//     /* ------------------------------------------------------------- */
//     socket.on("group:join", ({ groupId }) => {
//       if (!groupId) return;
//       socket.join(`group:${groupId}`);
//     });

//     /* ------------------------------------------------------------- */
//     /*  GROUP LEAVE                                                  */
//     /* ------------------------------------------------------------- */
//     socket.on("group:leave", ({ groupId }) => {
//       if (!groupId) return;
//       socket.leave(`group:${groupId}`);
//     });

//     /* ------------------------------------------------------------- */
//     /*  GROUP MESSAGE SEND                                           */
//     /* ------------------------------------------------------------- */
//     socket.on("group:message", async (payload, ack) => {
//       try {
//         const { groupId, content, attachments, contentType } = payload;

//         if (!mongoose.Types.ObjectId.isValid(groupId)) {
//           return ack?.({ ok: false, error: "invalid_group_id" });
//         }

//         const chat = await Chat.findById(groupId).exec();
//         if (!chat || !chat.isGroup) {
//           return ack?.({ ok: false, error: "group_not_found" });
//         }

//         const messageDoc = await Message.create({
//           chatId: groupId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: attachments || [],
//           status: "sent",
//         });

//         chat.lastMessage = messageDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(messageDoc._id),
//           chatId: String(groupId),
//           senderId: String(userId),
//           content,
//           contentType: messageDoc.contentType,
//           attachments: messageDoc.attachments,
//           createdAt: messageDoc.createdAt,
//           status: messageDoc.status,
//         };

//         // Broadcast to all group members via group room
//         io.to(`group:${groupId}`).emit("group:message:new", msgData);

//         /* ------------------------------------------------------------- */
//         /* FALLBACK BROADCAST (safe): also emit to participants' user rooms
//            This ensures delivery if a client didn't join group:<id> due to race
//            or client join issues. It mirrors group broadcast but targets
//            user-specific rooms (user:<id>) — safe and non-destructive.      */
//         try {
//           (chat.participants || [])
//             .map((p) => String(p))
//             .filter((p) => p !== String(userId))
//             .forEach((uid) => {
//               io.to(`user:${uid}`).emit("message:new", msgData);
//             });
//         } catch (e) {
//           // don't block group flow on fallback error
//           console.warn("group fallback emit error", e);
//         }

//         ack?.({ ok: true, messageId: msgData._id });
//       } catch (err) {
//         console.error("❌ group:message error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* message:send (private chat)                                   */
//     /* ------------------------------------------------------------- */
//     socket.on("message:send", async (payload, ack) => {
//       try {
//         const { chatId, content, contentType, attachments } = payload;

//         if (!mongoose.Types.ObjectId.isValid(chatId)) {
//           return ack?.({ ok: false, error: "invalid_chat_id" });
//         }

//         const chat = await Chat.findById(chatId).exec();
//         if (!chat) return ack?.({ ok: false, error: "chat_not_found" });

//         const normalizedAttachments = (attachments || []).map((a) => ({
//           url: a.url?.startsWith("http")
//             ? a.url
//             : `${process.env.API_BASE || "http://localhost:4000"}${a.url}`,
//           type: a.type,
//           name: a.name,
//         }));

//         const messageDoc = await Message.create({
//           chatId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: normalizedAttachments,
//           status: "sent",
//         });

//         chat.lastMessage = messageDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(messageDoc._id),
//           chatId: String(chatId),
//           senderId: String(userId),
//           content,
//           contentType: messageDoc.contentType,
//           attachments: messageDoc.attachments,
//           createdAt: messageDoc.createdAt,
//           status: messageDoc.status,
//         };

//         const recipients = chat.participants
//           .map((p) => String(p))
//           .filter((p) => p !== String(userId));

//         recipients.forEach((uid) => {
//           io.to(`user:${uid}`).emit("message:new", msgData);
//         });

//         io.to(`user:${userId}`).emit("message:update", {
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//           status: "delivered",
//         });

//         ack?.({
//           ok: true,
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//         });
//       } catch (err) {
//         console.error("❌ message:send error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Mark messages as read                                         */
//     /* ------------------------------------------------------------- */
//     socket.on("message:read", async ({ chatId, messageIds }) => {
//       try {
//         if (!Array.isArray(messageIds) || !chatId) return;

//         await Message.updateMany(
//           { _id: { $in: messageIds }, chatId },
//           {
//             $set: { status: "read" },
//             $addToSet: { readBy: socket.user?.id },
//           }
//         );

//         const readMessages = await Message.find({
//           _id: { $in: messageIds },
//         })
//           .select("_id chatId senderId")
//           .lean();

//         readMessages.forEach((msg) => {
//           io.to(`user:${msg.senderId}`).emit("message:update", {
//             messageId: String(msg._id),
//             chatId: String(chatId),
//             status: "read",
//           });
//         });
//       } catch (err) {
//         console.error("❌ message:read error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* Disconnect handler                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("disconnect", async () => {
//       console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           const userDoc = await User.findById(userId).lean();
//           const stillOnline = (userDoc?.devices || []).some((d) => d?.socketId);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: !!stillOnline,
//             lastSeen: stillOnline ? null : new Date(),
//           });
//         }
//       } catch (err) {
//         console.error("❌ disconnect presence update error:", err);
//       }
//     });
//   });

//   return io;
// }









// // server/src/sockets/index.js
// import mongoose from "mongoose";
// import { Server } from "socket.io";
// import Chat from "../models/Chat.js";
// import Message from "../models/Message.js";
// import User from "../models/User.js";
// import { socketAuthMiddleware } from "./auth.js";

// let io;

// export function initSocket(server) {
//   io = new Server(server, {
//     cors: { origin: "*" },
//     pingTimeout: 60000,
//   });

//   io.use(socketAuthMiddleware);

//   io.on("connection", (socket) => {
//     const userId = socket.user?.id;
//     const deviceId = socket.handshake?.auth?.deviceId || null;
//     const userAgent = socket.handshake?.headers?.["user-agent"] || "";

//     console.log(`✅ Socket connected: ${socket.id} (user: ${userId})`);

//     /* ------------------------------------------------------------- */
//     /*  Presence + device registration                               */
//     /* ------------------------------------------------------------- */
//     (async () => {
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           await User.updateOne(
//             { _id: userId },
//             {
//               $push: {
//                 devices: {
//                   deviceId,
//                   socketId: socket.id,
//                   lastSeen: new Date(),
//                   userAgent,
//                 },
//               },
//             }
//           ).catch(() => {});

//           socket.join(`user:${userId}`);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: true,
//             lastSeen: null,
//           });
//         }
//       } catch (err) {
//         console.error("❌ presence register error:", err);
//       }
//     })();

//     /* ------------------------------------------------------------- */
//     /* Typing indicators                                             */
//     /* ------------------------------------------------------------- */
//     socket.on("typing:start", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: true,
//       });
//     });

//     socket.on("typing:stop", ({ chatId, receiverId }) => {
//       if (!chatId || !receiverId) return;
//       io.to(`user:${receiverId}`).emit("typing:update", {
//         chatId,
//         from: userId,
//         typing: false,
//       });
//     });

//     /* ------------------------------------------------------------- */
//     /* Join chat room                                                */
//     /* ------------------------------------------------------------- */
//     socket.on("chat:join", async ({ chatId }, cb) => {
//       try {
//         if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
//         socket.join(`chat:${chatId}`);
//         cb?.({ ok: true });
//       } catch (err) {
//         console.error("❌ chat:join error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* GROUP JOIN / LEAVE                                            */
//     /* ------------------------------------------------------------- */
//     socket.on("group:join", ({ groupId }) => {
//       if (groupId) socket.join(`group:${groupId}`);
//     });

//     socket.on("group:leave", ({ groupId }) => {
//       if (groupId) socket.leave(`group:${groupId}`);
//     });

//     /* ------------------------------------------------------------- */
//     /* GROUP MESSAGE (FIXED — USE message:new)                       */
//     /* ------------------------------------------------------------- */
//     socket.on("group:message", async (payload, ack) => {
//       try {
//         const { groupId, content, attachments, contentType } = payload;

//         if (!mongoose.Types.ObjectId.isValid(groupId)) {
//           return ack?.({ ok: false, error: "invalid_group_id" });
//         }

//         const chat = await Chat.findById(groupId).exec();
//         if (!chat || !chat.isGroup) {
//           return ack?.({ ok: false, error: "group_not_found" });
//         }

//         const msgDoc = await Message.create({
//           chatId: groupId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: attachments || [],
//           status: "sent",
//         });

//         chat.lastMessage = msgDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(msgDoc._id),
//           chatId: String(groupId),
//           senderId: String(userId),
//           content,
//           contentType: msgDoc.contentType,
//           attachments: msgDoc.attachments,
//           createdAt: msgDoc.createdAt,
//           status: msgDoc.status,
//         };

//         // 🔥 THIS IS THE FIX: send to user rooms using SAME EVENT "message:new"
//         chat.participants
//           .map((p) => String(p))
//           .filter((p) => p !== String(userId))
//           .forEach((uid) => {
//             io.to(`user:${uid}`).emit("message:new", msgData);
//           });

//         // sender gets delivered status
//         io.to(`user:${userId}`).emit("message:update", {
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//           status: "delivered",
//         });

//         ack?.({ ok: true, messageId: msgData._id });
//       } catch (err) {
//         console.error("❌ group:message error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* PRIVATE MESSAGE SEND                                          */
//     /* ------------------------------------------------------------- */
//     socket.on("message:send", async (payload, ack) => {
//       try {
//         const { chatId, content, contentType, attachments } = payload;

//         if (!mongoose.Types.ObjectId.isValid(chatId)) {
//           return ack?.({ ok: false, error: "invalid_chat_id" });
//         }

//         const chat = await Chat.findById(chatId).exec();
//         if (!chat) return ack?.({ ok: false, error: "chat_not_found" });

//         const normalized = (attachments || []).map((a) => ({
//           url: a.url?.startsWith("http")
//             ? a.url
//             : `${process.env.API_BASE || "http://localhost:4000"}${a.url}`,
//           type: a.type,
//           name: a.name,
//         }));

//         const msgDoc = await Message.create({
//           chatId,
//           senderId: userId,
//           content,
//           contentType: contentType || "text",
//           attachments: normalized,
//           status: "sent",
//         });

//         chat.lastMessage = msgDoc._id;
//         await chat.save({ timestamps: true });

//         const msgData = {
//           _id: String(msgDoc._id),
//           chatId: String(chatId),
//           senderId: String(userId),
//           content,
//           contentType: msgDoc.contentType,
//           attachments: msgDoc.attachments,
//           createdAt: msgDoc.createdAt,
//           status: msgDoc.status,
//         };

//         chat.participants
//           .map((p) => String(p))
//           .filter((p) => p !== String(userId))
//           .forEach((uid) => {
//             io.to(`user:${uid}`).emit("message:new", msgData);
//           });

//         io.to(`user:${userId}`).emit("message:update", {
//           messageId: msgData._id,
//           chatId: msgData.chatId,
//           status: "delivered",
//         });

//         ack?.({ ok: true, messageId: msgData._id });
//       } catch (err) {
//         console.error("❌ message:send error:", err);
//         ack?.({ ok: false, error: err.message });
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* MARK READ                                                     */
//     /* ------------------------------------------------------------- */
//     socket.on("message:read", async ({ chatId, messageIds }) => {
//       try {
//         if (!Array.isArray(messageIds) || !chatId) return;

//         await Message.updateMany(
//           { _id: { $in: messageIds }, chatId },
//           {
//             $set: { status: "read" },
//             $addToSet: { readBy: socket.user?.id },
//           }
//         );

//         const readMsgs = await Message.find({
//           _id: { $in: messageIds },
//         })
//           .select("_id chatId senderId")
//           .lean();

//         readMsgs.forEach((msg) => {
//           io.to(`user:${msg.senderId}`).emit("message:update", {
//             messageId: String(msg._id),
//             chatId: String(chatId),
//             status: "read",
//           });
//         });
//       } catch (err) {
//         console.error("❌ message:read error:", err);
//       }
//     });

//     /* ------------------------------------------------------------- */
//     /* DISCONNECT                                                    */
//     /* ------------------------------------------------------------- */
//     socket.on("disconnect", async () => {
//       console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
//       try {
//         if (userId) {
//           await User.updateOne(
//             { _id: userId },
//             { $pull: { devices: { socketId: socket.id } } }
//           ).catch(() => {});

//           const userDoc = await User.findById(userId).lean();
//           const stillOnline = (userDoc?.devices || []).some((d) => d?.socketId);

//           io.emit("presence:update", {
//             userId: String(userId),
//             online: !!stillOnline,
//             lastSeen: stillOnline ? null : new Date(),
//           });
//         }
//       } catch (err) {
//         console.error("❌ disconnect presence update error:", err);
//       }
//     });
//   });

//   return io;
// }



// server/src/sockets/index.js
import mongoose from "mongoose";
import { Server } from "socket.io";
import Chat from "../models/Chat.js";
import Message from "../models/Message.js";
import User from "../models/User.js";
import { socketAuthMiddleware } from "./auth.js";

let io;

export function initSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" },
    pingTimeout: 60000,
  });

  io.use(socketAuthMiddleware);

  io.on("connection", (socket) => {
    const userId = socket.user?.id;
    const deviceId = socket.handshake?.auth?.deviceId || null;
    const userAgent = socket.handshake?.headers?.["user-agent"] || "";

    console.log(`✅ Socket connected: ${socket.id} (user: ${userId})`);

    /* ------------------------------------------------------------- */
    /*  Presence + device registration                               */
    /* ------------------------------------------------------------- */
    (async () => {
      try {
        if (userId) {
          await User.updateOne(
            { _id: userId },
            { $pull: { devices: { socketId: socket.id } } }
          ).catch(() => {});

          await User.updateOne(
            { _id: userId },
            {
              $push: {
                devices: {
                  deviceId,
                  socketId: socket.id,
                  lastSeen: new Date(),
                  userAgent,
                },
              },
            }
          ).catch(() => {});

          socket.join(`user:${userId}`);

          io.emit("presence:update", {
            userId: String(userId),
            online: true,
            lastSeen: null,
          });
        }
      } catch (err) {
        console.error("❌ presence register error:", err);
      }
    })();

    /* ------------------------------------------------------------- */
    /* Typing indicators (private chat)                              */
    /* ------------------------------------------------------------- */
    socket.on("typing:start", ({ chatId, receiverId }) => {
      if (!chatId || !receiverId) return;
      io.to(`user:${receiverId}`).emit("typing:update", {
        chatId,
        from: userId,
        typing: true,
      });
    });

    socket.on("typing:stop", ({ chatId, receiverId }) => {
      if (!chatId || !receiverId) return;
      io.to(`user:${receiverId}`).emit("typing:update", {
        chatId,
        from: userId,
        typing: false,
      });
    });

    /* ------------------------------------------------------------- */
    /* Join chat room                                                */
    /* ------------------------------------------------------------- */
    socket.on("chat:join", async ({ chatId }, cb) => {
      try {
        if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
        socket.join(`chat:${chatId}`);
        cb?.({ ok: true });
      } catch (err) {
        console.error("❌ chat:join error:", err);
      }
    });

    /* ------------------------------------------------------------- */
    /* Group join/leave                                              */
    /* ------------------------------------------------------------- */
    socket.on("group:join", ({ groupId }) => {
      if (!groupId) return;
      socket.join(`group:${groupId}`);
    });

    socket.on("group:leave", ({ groupId }) => {
      if (!groupId) return;
      socket.leave(`group:${groupId}`);
    });

    /* ------------------------------------------------------------- */
    /* GROUP MESSAGE HANDLER (FIXED)                                 */
    /* ------------------------------------------------------------- */
    socket.on("group:message", async (payload, ack) => {
      try {
        const { groupId, content, attachments, contentType } = payload;

        if (!mongoose.Types.ObjectId.isValid(groupId)) {
          return ack?.({ ok: false, error: "invalid_group_id" });
        }

        const chat = await Chat.findById(groupId).exec();
        if (!chat || !chat.isGroup) {
          return ack?.({ ok: false, error: "group_not_found" });
        }

        const messageDoc = await Message.create({
          chatId: groupId,
          senderId: userId,
          content,
          contentType: contentType || "text",
          attachments: attachments || [],
          status: "sent",
        });

        chat.lastMessage = messageDoc._id;
        await chat.save({ timestamps: true });

        const msgData = {
          _id: String(messageDoc._id),
          chatId: String(groupId),
          senderId: String(userId),
          content,
          contentType: messageDoc.contentType,
          attachments: messageDoc.attachments,
          createdAt: messageDoc.createdAt,
          status: messageDoc.status,
        };

        /* =============================================================
           ⭐ FIXED → USE "message:new" FOR GROUPS TOO
           ============================================================= */
        io.to(`group:${groupId}`).emit("message:new", msgData);

        /* Fallback — send also to user rooms */
        try {
          (chat.participants || [])
            .map((p) => String(p))
            .filter((p) => p !== String(userId))
            .forEach((uid) => {
              io.to(`user:${uid}`).emit("message:new", msgData);
            });
        } catch (e) {
          console.warn("group fallback emit error", e);
        }

        ack?.({ ok: true, messageId: msgData._id });
      } catch (err) {
        console.error("❌ group:message error:", err);
        ack?.({ ok: false, error: err.message });
      }
    });

    /* ------------------------------------------------------------- */
    /* PRIVATE MESSAGE SEND                                          */
    /* ------------------------------------------------------------- */
    socket.on("message:send", async (payload, ack) => {
      try {
        const { chatId, content, contentType, attachments } = payload;

        if (!mongoose.Types.ObjectId.isValid(chatId)) {
          return ack?.({ ok: false, error: "invalid_chat_id" });
        }

        const chat = await Chat.findById(chatId).exec();
        if (!chat) return ack?.({ ok: false, error: "chat_not_found" });

        const normalizedAttachments = (attachments || []).map((a) => ({
          url: a.url?.startsWith("http")
            ? a.url
            : `${process.env.API_BASE || "http://localhost:4000"}${a.url}`,
          type: a.type,
          name: a.name,
        }));

        const messageDoc = await Message.create({
          chatId,
          senderId: userId,
          content,
          contentType: contentType || "text",
          attachments: normalizedAttachments,
          status: "sent",
        });

        chat.lastMessage = messageDoc._id;
        await chat.save({ timestamps: true });

        const msgData = {
          _id: String(messageDoc._id),
          chatId: String(chatId),
          senderId: String(userId),
          content,
          contentType: messageDoc.contentType,
          attachments: messageDoc.attachments,
          createdAt: messageDoc.createdAt,
          status: messageDoc.status,
        };

        const recipients = chat.participants
          .map((p) => String(p))
          .filter((p) => p !== String(userId));

        recipients.forEach((uid) => {
          io.to(`user:${uid}`).emit("message:new", msgData);
        });

        io.to(`user:${userId}`).emit("message:update", {
          messageId: msgData._id,
          chatId: msgData.chatId,
          status: "delivered",
        });

        ack?.({
          ok: true,
          messageId: msgData._id,
          chatId: msgData.chatId,
        });
      } catch (err) {
        console.error("❌ message:send error:", err);
        ack?.({ ok: false, error: err.message });
      }
    });

    /* ------------------------------------------------------------- */
    /* Mark messages as read                                         */
    /* ------------------------------------------------------------- */
    socket.on("message:read", async ({ chatId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || !chatId) return;

        await Message.updateMany(
          { _id: { $in: messageIds }, chatId },
          {
            $set: { status: "read" },
            $addToSet: { readBy: socket.user?.id },
          }
        );

        const readMessages = await Message.find({
          _id: { $in: messageIds },
        })
          .select("_id chatId senderId")
          .lean();

        readMessages.forEach((msg) => {
          io.to(`user:${msg.senderId}`).emit("message:update", {
            messageId: String(msg._id),
            chatId: String(chatId),
            status: "read",
          });
        });
      } catch (err) {
        console.error("❌ message:read error:", err);
      }
    });

    /* ------------------------------------------------------------- */
    /* Disconnect                                                    */
    /* ------------------------------------------------------------- */
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
      try {
        if (userId) {
          await User.updateOne(
            { _id: userId },
            { $pull: { devices: { socketId: socket.id } } }
          ).catch(() => {});

          const userDoc = await User.findById(userId).lean();
          const stillOnline = (userDoc?.devices || []).some((d) => d?.socketId);

          io.emit("presence:update", {
            userId: String(userId),
            online: !!stillOnline,
            lastSeen: stillOnline ? null : new Date(),
          });
        }
      } catch (err) {
        console.error("❌ disconnect presence update error:", err);
      }
    });
  });

  return io;
}
