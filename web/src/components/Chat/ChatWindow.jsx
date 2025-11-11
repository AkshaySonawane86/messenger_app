

// src/components/Chat/ChatWindow.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { createSocket, getSocket } from "../../services/socket";
import useAuthStore from "../../store/useAuthStore";
import "./ChatWindow.css";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({ activeChatId }) {
  // activeChatId should be passed by ChatList when a chat is selected; fallback to first
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState([]);
  const [chatInfo, setChatInfo] = useState(null);
  const scrollerRef = useRef();

  useEffect(() => {
    if (!token) return;
    // create socket connection with token
    createSocket(token);
    const s = getSocket();

    // join chat room when activeChatId changes
    if (activeChatId && s && s.connected) {
      s.emit("chat:join", { chatId: activeChatId }, (ack) => {
        // console.log("join ack", ack);
      });
    }

    // handle incoming new messages
    function onMessageNew(msg) {
      if (!msg) return;
      // if message is in the same chat, append
      if (!activeChatId || String(msg.chatId) === String(activeChatId)) {
        setMessages((m) => [...m, msg]);
        // scroll down
        setTimeout(() => scrollerRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }

    function onReadUpdate(payload) {
      // optionally handle read receipts (update message objects)
      // payload: { chatId, messageIds, readerId }
      // We'll not update UI aggressively here unless you want ticks.
    }

    s && s.on("message:new", onMessageNew);
    s && s.on("message:read:update", onReadUpdate);

    return () => {
      if (s) {
        if (activeChatId) s.emit("chat:leave", { chatId: activeChatId });
        s.off("message:new", onMessageNew);
        s.off("message:read:update", onReadUpdate);
      }
      // do not disconnect socket here if other parts of app use it
      // disconnectSocket();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, activeChatId]);

  useEffect(() => {
    // fetch chat messages and info when activeChatId changes
    if (!activeChatId) return;
    (async () => {
      try {
        const resChat = await api.get(`/api/chats/${activeChatId}`);
        setChatInfo(resChat.data?.chat || null);
      } catch (e) {
        // ignore
      }
      try {
        const res = await api.get(`/api/chats/${activeChatId}/messages?limit=100`);
        const msgs = res.data?.messages || [];
        // ensure chronological order
        setMessages(msgs);
        setTimeout(() => scrollerRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } catch (err) {
        console.error("fetch messages err", err);
      }
    })();
  }, [activeChatId]);

  const handleSend = async (text) => {
    const s = getSocket();
    if (!s || !s.connected) {
      // show some error or fallback (optimistic append)
      const temp = {
        _id: `temp-${Date.now()}`,
        senderId: user?._id,
        content: text,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, temp]);
      return;
    }

    // optimistic message appended (optional)
    const temp = {
      _id: `temp-${Date.now()}`,
      senderId: user?._id,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((m) => [...m, temp]);
    s.emit(
      "message:send",
      { chatId: activeChatId, content: text, recipients: [] },
      (ack) => {
        if (ack?.ok && ack.messageId) {
          // replace temp id with persistent id
          setMessages((msgs) =>
            msgs.map((m) => (m._id === temp._id ? { ...m, _id: ack.messageId } : m))
          );
        } else {
          // mark failed (you can set a flag)
          console.warn("message send failed", ack);
        }
      }
    );
  };

  return (
    <div className="chat-window">
      <div className="chat-header">{chatInfo?.groupName || chatInfo?.participants?.[0]?.name || "Chat"}</div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg._id} message={{ id: msg._id, sender: String(msg.senderId) === String(user?._id) ? "me" : "other", content: msg.content, time: new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }} />
        ))}
        <div ref={scrollerRef} />
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  );
}
