


// src/components/Chat/ChatWindow.jsx
import { useEffect, useRef, useState } from "react";
import api from "../../services/api";
import { createSocket, getSocket } from "../../services/socket";
import useAuthStore from "../../store/useAuthStore";
import "./ChatWindow.css";
import MessageBubble from "./MessageBubble";
import MessageInput from "./MessageInput";

export default function ChatWindow({ activeChatId }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [messages, setMessages] = useState([]);
  const [chatInfo, setChatInfo] = useState(null);
  const scrollerRef = useRef();

  useEffect(() => {
    if (!token) return;
    createSocket(token);
    const s = getSocket();

    if (activeChatId && s && s.connected) {
      s.emit("chat:join", { chatId: activeChatId });
      s.emit("group:join", { groupId: activeChatId });
    }

    function onMessageNew(msg) {
      if (String(msg.chatId) === String(activeChatId)) {
        setMessages((m) => [...m, msg]);
        setTimeout(() => scrollerRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }

    function onGroupMessage(e) {
      const msg = e.detail;
      if (String(msg.chatId) === String(activeChatId))
        setMessages((m) => [...m, msg]);
    }

    s?.on("message:new", onMessageNew);
    window.addEventListener("groupMessage", onGroupMessage);

    return () => {
      if (s) {
        s.emit("chat:leave", { chatId: activeChatId });
        s.emit("group:leave", { groupId: activeChatId });
        s.off("message:new", onMessageNew);
      }
      window.removeEventListener("groupMessage", onGroupMessage);
    };
  }, [token, activeChatId]);

  useEffect(() => {
    if (!activeChatId) return;
    (async () => {
      try {
        const resChat = await api.get(`/api/chats/${activeChatId}`);
        setChatInfo(resChat.data?.chat || null);
        const res = await api.get(`/api/chats/${activeChatId}/messages?limit=100`);
        setMessages(res.data?.messages || []);
        setTimeout(() => scrollerRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      } catch (err) {
        console.error("fetch messages err", err);
      }
    })();
  }, [activeChatId]);

  const handleSend = async (text) => {
    const s = getSocket();
    const payload = {
      chatId: activeChatId,
      content: text,
      recipients: [],
    };

    const isGroup = chatInfo?.isGroup;
    if (isGroup) {
      s.emit("group:message", { groupId: activeChatId, content: text });
    } else {
      s.emit("message:send", payload);
    }

    setMessages((m) => [
      ...m,
      {
        _id: `temp-${Date.now()}`,
        senderId: user._id,
        content: text,
        createdAt: new Date(),
      },
    ]);
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        {chatInfo?.isGroup
          ? `👥 ${chatInfo.groupName}`
          : chatInfo?.participants?.[0]?.name || "Chat"}
      </div>
      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble
            key={msg._id}
            message={{
              id: msg._id,
              sender:
                String(msg.senderId) === String(user._id) ? "me" : msg.senderId,
              content: msg.content,
              time: new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
              senderName:
                chatInfo?.isGroup && msg.senderName
                  ? msg.senderName
                  : undefined,
            }}
          />
        ))}
        <div ref={scrollerRef} />
      </div>

      <MessageInput onSend={handleSend} />
    </div>
  );
}
