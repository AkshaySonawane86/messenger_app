

// src/components/Chat/ChatList.jsx
import { useEffect, useState } from "react";
import api from "../../services/api";
import "./ChatList.css";
import CreateGroupModal from "./CreateGroupModal";

export default function ChatList({ onSelectChat }) {
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  async function fetchChats() {
    try {
      setLoading(true);
      const res = await api.get("/api/chats");
      if (res.data?.chats) {
        const processed = res.data.chats.map((chat) => ({
          ...chat,
          avatarUrl:
            chat.isGroup && chat.groupAvatar
              ? chat.groupAvatar.startsWith("http")
                ? chat.groupAvatar
                : `${api.defaults.baseURL}${chat.groupAvatar}`
              : chat.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  chat.groupName || chat.name || "Chat"
                )}&background=2563eb&color=fff`,
        }));
        setChats(processed);
      }
    } catch (err) {
      console.warn("⚠️ Failed to load chats:", err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchChats();
  }, []);

  return (
    <div className="chat-list">
      <div className="chat-list-header">
        <span>Chats</span>
        <button className="create-group-btn" onClick={() => setShowModal(true)}>
          ➕ Group
        </button>
      </div>

      <div className="chat-list-body">
        {loading && <div className="chat-loading">Loading...</div>}
        {!loading && chats.length === 0 && <div className="no-chats">No chats yet.</div>}

        {!loading &&
          chats.map((chat) => (
            <div
              key={chat._id}
              className="chat-item"
              onClick={() => onSelectChat && onSelectChat(chat._id)}
            >
              <img
                src={chat.avatarUrl}
                alt="Avatar"
                className="chat-avatar"
                style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
              />
              <div className="chat-info">
                <div className="chat-name">
                  {chat.isGroup ? chat.groupName : chat.name || "Unnamed"}
                </div>
                <div className="chat-last">
                  {chat.lastMessage?.content || "No messages yet"}
                </div>
              </div>
            </div>
          ))}
      </div>

      {showModal && (
        <CreateGroupModal onClose={() => setShowModal(false)} onCreated={fetchChats} />
      )}
    </div>
  );
}
