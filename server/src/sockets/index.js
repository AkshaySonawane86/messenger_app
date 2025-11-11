




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

    // ✅ Typing indicator
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

    // ✅ Join chat room → mark as delivered
    socket.on("chat:join", async ({ chatId }, cb) => {
      try {
        if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
        socket.join(`chat:${chatId}`);

        await Message.updateMany(
          { chatId, senderId: { $ne: userId }, status: "sent" },
          { $set: { status: "delivered" } }
        );

        const deliveredMessages = await Message.find({
          chatId,
          senderId: { $ne: userId },
          status: "delivered",
        })
          .select("_id chatId status senderId")
          .lean();

        deliveredMessages.forEach((msg) => {
          io.to(`user:${msg.senderId}`).emit("message:update", {
            messageId: String(msg._id),
            chatId: String(chatId),
            status: "delivered",
          });
        });

        cb?.({ ok: true });
      } catch (err) {
        console.error("❌ chat:join error:", err);
      }
    });

    socket.on("chat:leave", ({ chatId }, cb) => {
      if (!chatId) return cb?.({ ok: false, error: "chatId_required" });
      socket.leave(`chat:${chatId}`);
      cb?.({ ok: true });
    });

    // ✅ message:send — now includes normalized file URLs
    socket.on("message:send", async (payload, ack) => {
      try {
        let { chatId, content, contentType, attachments, recipients } = payload;
        let chat = null;

        if (chatId && mongoose.Types.ObjectId.isValid(chatId)) {
          chat = await Chat.findById(chatId);
        }

        if (!chat && Array.isArray(recipients) && recipients.length > 0) {
          const participants = Array.from(
            new Set([userId, ...recipients.map(String)])
          );
          chat = await Chat.findOne({
            isGroup: false,
            participants: { $all: participants, $size: participants.length },
          });

          if (!chat) {
            chat = await Chat.create({
              isGroup: false,
              participants,
              createdBy: userId,
            });
            console.log(
              `💬 Auto-created chat ${chat._id} for participants: ${participants.join(
                ","
              )}`
            );
          }
        }

        if (!chat)
          return ack?.({ ok: false, error: "chat_not_found_and_no_recipients" });

        // ✅ Normalize attachment URLs
        const normalizedAttachments = (attachments || []).map((a) => ({
          url: a.url?.startsWith("http")
            ? a.url
            : `http://localhost:4000${a.url}`,
          type: a.type,
          name: a.name,
        }));

        const message = await Message.create({
          chatId: chat._id,
          senderId: userId,
          content,
          contentType: contentType || "text",
          attachments: normalizedAttachments,
          status: "sent",
        });

        chat.lastMessage = message._id;
        await chat.save();

        const participantIds = (chat.participants || []).map(String);
        participantIds.forEach((pid) => {
          if (pid !== String(userId)) {
            io.to(`user:${pid}`).emit("message:new", {
              _id: message._id,
              chatId: String(chat._id),
              senderId: String(userId),
              content,
              contentType: message.contentType,
              attachments: message.attachments,
              createdAt: message.createdAt,
              status: message.status,
            });
          }
        });

        ack?.({ ok: true, messageId: message._id, chatId: String(chat._id) });
      } catch (err) {
        console.error("❌ message:send error:", err);
        ack?.({ ok: false, error: err.message });
      }
    });

    // ✅ message:read (unchanged)
    socket.on("message:read", async ({ chatId, messageIds }) => {
      try {
        if (!Array.isArray(messageIds) || !chatId) return;

        await Message.updateMany(
          { _id: { $in: messageIds }, chatId },
          { $set: { status: "read" }, $addToSet: { readBy: userId } }
        );

        const readMessages = await Message.find({ _id: { $in: messageIds } })
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

    // ✅ Disconnect handler
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id} (user: ${userId})`);
      try {
        if (userId) {
          await User.updateOne(
            { _id: userId, "devices.socketId": socket.id },
            {
              $set: {
                "devices.$[d].socketId": null,
                "devices.$[d].lastSeen": new Date(),
              },
            },
            { arrayFilters: [{ "d.socketId": socket.id }] }
          ).catch(() => {});

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
