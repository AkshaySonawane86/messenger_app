
// src/pages/ChatPage.jsx
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import CreateGroupModal from "../components/Chat/CreateGroupModal";
import GroupSettingsModal from "../components/Chat/GroupSettingsModal";
import ProfilePopup from "../components/ProfilePopup";
import api from "../services/api";
import { createSocket, disconnectSocket, getSocket } from "../services/socket";
import useAuthStore from "../store/useAuthStore";
import "./ChatPage.css";

dayjs.extend(relativeTime);

/* ---------------- MESSAGE ITEM ---------------- */
function MessageItem({ m, currentUserId, isGroup }) {
  const isMine = String(m.senderId) === String(currentUserId);

  const renderAttachment = () => {
    if (m.contentType === "location" && m.content) {
      const { lat, lng } = m.content;
      const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      return (
        <div className="location-card">
          📍 <strong>Location Shared</strong>
          <br />
          <a href={mapUrl} target="_blank" rel="noopener noreferrer">
            View on Map
          </a>
        </div>
      );
    }

    if (!m.attachments?.length) return m.content;
    const a = m.attachments[0];
    if (m.contentType === "image")
      return <img src={a.url} alt={a.name} className="chat-image" />;
    if (m.contentType === "video")
      return (
        <video controls className="chat-video">
          <source src={a.url} type="video/mp4" />
        </video>
      );
    if (m.contentType === "audio")
      return (
        <audio controls className="chat-audio">
          <source src={a.url} />
        </audio>
      );
    return (
      <a
        href={a.url}
        download={a.name}
        target="_blank"
        rel="noopener noreferrer"
        className="file-link"
      >
        📎 {a.name}
      </a>
    );
  };

  const renderStatus = () => {
    if (!isMine) return null;
    if (m.status === "read") return <span className="tick tick-read">✓✓</span>;
    if (m.status === "delivered")
      return <span className="tick tick-delivered">✓✓</span>;
    if (m.status === "sent") return <span className="tick tick-sent">✓</span>;
    return null;
  };

  return (
    <div className={`message ${isMine ? "mine" : "other"}`}>
      {isGroup && !isMine && (
        <div className="group-sender-name">👤 {m.senderName || "Member"}</div>
      )}
      <div className="message-body">{renderAttachment()}</div>
      <div className="message-meta">
        {dayjs(m.createdAt).format("HH:mm")} {renderStatus()}
      </div>
    </div>
  );
}

/* ---------------- CUSTOM DROPDOWN WITH SEARCH ---------------- */
function ContactDropdown({ contacts, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = contacts.find((c) => c._id === value) || null;

  const filteredGroups = contacts
    .filter((c) => c.isGroup)
    .filter((g) =>
      (g.name || "")
        .toString()
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

  const filteredUsers = contacts
    .filter((c) => !c.isGroup)
    .filter((u) =>
      ((u.name || u.email) + "")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

  const toggle = () => setOpen((o) => !o);

  const select = (id) => {
    onChange(id);
    setOpen(false);
    setSearch("");
  };

  useEffect(() => {
    // close dropdown on route change / outside click
    function onDoc(e) {
      // nothing for now
    }
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  return (
    <div className="dropdown-wrapper">
      <div className="dropdown-selected" onClick={toggle}>
        {selected ? (
          <>
            <img src={selected.avatarUrl} alt="" className="dropdown-avatar" />
            <span>{selected.name || selected.email}</span>
          </>
        ) : (
          <span className="dropdown-placeholder">-- Choose --</span>
        )}
        <span className={`dropdown-arrow ${open ? "open" : ""}`}>▼</span>
      </div>

      {open && (
        <div className="dropdown-menu">
          {/* SEARCH */}
          <div className="dropdown-search-box" style={{ padding: 8 }}>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e6e9ef",
                outline: "none",
              }}
            />
          </div>

          {filteredGroups.length > 0 && (
            <>
              <div className="dropdown-section-label">Groups</div>
              {filteredGroups.map((g) => (
                <div
                  key={g._id}
                  className="dropdown-item"
                  onClick={() => select(g._id)}
                >
                  <img src={g.avatarUrl} className="dropdown-avatar" alt="" />
                  <span>{g.name}</span>
                </div>
              ))}
            </>
          )}

          {filteredUsers.length > 0 && (
            <>
              <div className="dropdown-section-label">Contacts</div>
              {filteredUsers.map((u) => (
                <div
                  key={u._id}
                  className="dropdown-item"
                  onClick={() => select(u._id)}
                >
                  <img src={u.avatarUrl} className="dropdown-avatar" alt="" />
                  <span>{u.name || u.email}</span>
                </div>
              ))}
            </>
          )}

          {filteredGroups.length === 0 &&
            filteredUsers.length === 0 &&
            search.trim() !== "" && (
              <div style={{ padding: 10, color: "#666" }}>No results found</div>
            )}
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ✅ Chat Page                                                               */
/* -------------------------------------------------------------------------- */
export default function ChatPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const navigate = useNavigate();

  const [socketInitialized, setSocketInitialized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [locationPreview, setLocationPreview] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [chatId, setChatIdState] = useState(
    localStorage.getItem("lastChatId") || null
  );
  const [receiverIdentifier, setReceiverIdentifierState] = useState(
    localStorage.getItem("lastReceiverId") || ""
  );

  const [contacts, setContacts] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const [watchId, setWatchId] = useState(null);

  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  const chatMainRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // derived selectedContact
  const selectedContact = contacts.find(
    (c) => String(c._id) === String(receiverIdentifier)
  );

  // local setter that also persists
  const setChatId = (id) => {
    setChatIdState(id);
    if (id) localStorage.setItem("lastChatId", id);
    else localStorage.removeItem("lastChatId");
    // join chat room on backend when changed
    const s = getSocket();
    if (s && id) s.emit("chat:join", { chatId: id });
  };

  const setReceiverIdentifier = (id) => {
    setReceiverIdentifierState(id);
    if (id) localStorage.setItem("lastReceiverId", id);
    else localStorage.removeItem("lastReceiverId");
  };

  /* -------------------- Load Contacts + Groups -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [usersRes, chatsRes] = await Promise.all([
          api.get(`/api/auth/users?excludeId=${user?._id || ""}`),
          api.get(`/api/chats/my?userId=${user?._id}`),
        ]);

        const users = usersRes.data?.users || [];
        const groups = chatsRes.data?.chats?.filter((c) => c.isGroup) || [];

        const combined = [
          ...groups.map((g) => ({
            _id: g._id,
            name: g.groupName || "Unnamed Group",
            isGroup: true,
            avatarUrl:
              g.groupAvatar && g.groupAvatar.startsWith("http")
                ? g.groupAvatar
                : g.groupAvatar
                ? `${api.defaults.baseURL}${g.groupAvatar}`
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    g.groupName || "Group"
                  )}&background=2563eb&color=fff`,
            unreadCount: 0,
            online: false,
          })),
          ...users.map((u) => ({
            ...u,
            isGroup: false,
            avatarUrl:
              u.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                u.name || u.email
              )}&background=2563eb&color=fff`,
            unreadCount: 0,
            online: !!u.online,
          })),
        ];

        setContacts(combined);
      } catch (err) {
        console.error("❌ Failed to load contacts/groups:", err);
      }
    })();
  }, [user?._id]);

  /* -------------------- Emoji Picker Outside Click -------------------- */
  useEffect(() => {
    function handleClickOutside(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    }
    if (showEmojiPicker) document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [showEmojiPicker]);

  /* -------------------- Socket Setup -------------------- */
  useEffect(() => {
    if (!token || !user) return;
    const s = createSocket(token);
    if (!s) return;

    // If reconnect/new connect
    const onConnect = (ev) => {
      setSocketInitialized(true);
      if (chatId) s.emit("chat:join", { chatId });
    };
    window.addEventListener("socket:connect", onConnect);

    // message:new
    const onMessageNew = (e) => {
      const msg = e.detail;
      // if the incoming msg belongs to active chat -> display
      

if (String(msg.chatId) === String(chatId)) {
  // Active chat - append message
  setMessages((prev) => [...prev, msg]);

  // Mark as read immediately (same behaviour as before)
  setTimeout(() => {
    try {
      const unreadIds = (messages || [])
        .filter((m) => !m.readBy?.includes(user._id))
        .map((m) => m._id);

      if (unreadIds.length)
        getSocket()?.emit("message:read", { chatId, messageIds: unreadIds });
    } catch {}
  }, 300);

  scrollToBottom();
} else {
  // FIXED: unread should count ONLY using chatId, not senderId
  setContacts((prev) =>
    prev.map((c) =>
      String(c._id) === String(msg.chatId)
        ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
        : c
    )
  );
}




//
    };
    window.addEventListener("socket:message:new", onMessageNew);

    // typing indicator
    const onTyping = (e) => {
      const { chatId: tChatId, from, typing } = e.detail || {};
      if (String(tChatId) === String(chatId) && String(from) === String(receiverIdentifier)) {
        setIsTyping(Boolean(typing));
      }
    };
    window.addEventListener("socket:typing:update", onTyping);

    // message:update (status changes)
    const onMessageUpdate = (e) => {
      const payload = e.detail;
      const { messageId, status, chatId: updChatId } = payload || {};
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(messageId) ? { ...m, status } : m))
      );
    };
    window.addEventListener("socket:message:update", onMessageUpdate);

    // presence updates (online/offline)
    const onPresence = (e) => {
      const p = e.detail;
      setContacts((prev) =>
        prev.map((c) =>
          String(c._id) === String(p.userId) ? { ...c, online: p.online } : c
        )
      );
    };
    window.addEventListener("socket:presence:update", onPresence);

    // cleanup
    return () => {
      window.removeEventListener("socket:connect", onConnect);
      window.removeEventListener("socket:message:new", onMessageNew);
      window.removeEventListener("socket:typing:update", onTyping);
      window.removeEventListener("socket:message:update", onMessageUpdate);
      window.removeEventListener("socket:presence:update", onPresence);
      disconnectSocket();
      setSocketInitialized(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, chatId, user, receiverIdentifier]);

  /* -------------------- Load Messages -------------------- */
  useEffect(() => {
    (async () => {
      if (!chatId) {
        setMessages([]);
        return;
      }
      try {
        const res = await api.get(`/api/chats/${chatId}/messages?limit=200`);
        if (res.data?.messages) {
          setMessages(res.data.messages);
          setTimeout(() => scrollToBottom(false), 80);

          // mark read after loading (emit to server)
          const messageIds = res.data.messages
            .filter((m) => String(m.senderId) !== String(user._id) && m.status !== "read")
            .map((m) => m._id);
          if (messageIds.length) {
            getSocket()?.emit("message:read", { chatId, messageIds });
          }

          // reset unread count for this contact
          setContacts((prev) =>
            prev.map((c) =>
              String(c._id) === String(chatId) || String(c._id) === String(receiverIdentifier)
                ? { ...c, unreadCount: 0 }
                : c
            )
          );
        }
      } catch (err) {
        console.error("❌ Failed to load messages:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  const scrollToBottom = (smooth = true) => {
    const c = chatMainRef.current;
    if (c)
      c.scrollTo({
        top: c.scrollHeight,
        behavior: smooth ? "smooth" : "auto",
      });
  };

  /* -------------------- File Handling -------------------- */
  const handleFileSelect = (file) => {
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target.result);
    reader.readAsDataURL(file);
    setShowAttachmentMenu(false);
  };

  /* -------------------- Location Handling -------------------- */
  const handleShareLocation = () => {
    if (!navigator.geolocation) return alert("Location not supported");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocationPreview({ lat, lng });
      },
      () => alert("Unable to get location")
    );

    setShowAttachmentMenu(false);
  };

  const handleLiveShare = () => {
    if (liveSharing) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setLiveSharing(false);
      alert("Live location stopped");
    } else if (navigator.geolocation) {
      const id = navigator.geolocation.watchPosition((pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const payload = {
          chatId,
          content: { lat, lng },
          contentType: "location",
          attachments: [],
        };
        getSocket()?.emit("message:send", payload);
      });
      setWatchId(id);
      setLiveSharing(true);
      alert("Live location started");
    }
    setShowAttachmentMenu(false);
  };

  /* -------------------- Create or Get Chat (when user selected a contact) -------------------- */
  const ensureChatExists = async (targetId) => {
    // if we already have a chatId (private chat), return it
    if (chatId) return chatId;

    // If targetId is a user id (not a chat id), attempt to create/find chat
    try {
      // POST /api/chats/create with userA (current) and userB (target)
      const res = await api.post("/api/chats/create", {
        userA: user._id,
        userB: targetId,
      });
      if (res.data?.ok && res.data.chat) {
        const createdChat = res.data.chat;
        setChatId(createdChat._id);
        return createdChat._id;
      }
    } catch (err) {
      console.error("❌ ensureChatExists error:", err);
    }
    return null;
  };

  /* -------------------- Send Message -------------------- */
  const sendMessage = async (e) => {
    e?.preventDefault();

    if (!input.trim() && !file && !locationPreview) return;

    // make sure socket exists
    const s = getSocket();
    if (!s) return;

    // Determine active chat (create if needed)
    let activeChat = chatId;
    if (!activeChat) {
      // if receiverIdentifier is present, create/find chat
      const possible = await ensureChatExists(receiverIdentifier);
      if (!possible) return alert("Unable to find or create chat.");
      activeChat = possible;
    }

    let uploadedFile = null;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("chatId", activeChat);
      try {
        const res = await api.post("/api/chats/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.data?.ok) uploadedFile = res.data.file;
      } catch (err) {
        console.error("❌ upload error:", err);
      }
    }

    const selected = contacts.find((c) => String(c._id) === String(receiverIdentifier));
    const isGroup = selected?.isGroup;

    const payload = {
      chatId: activeChat,
      content: locationPreview || input.trim(),
      contentType:
        locationPreview
          ? "location"
          : file
          ? file.type.startsWith("image")
            ? "image"
            : file.type.startsWith("video")
            ? "video"
            : file.type.startsWith("audio")
            ? "audio"
            : "file"
          : "text",
      attachments: uploadedFile ? [uploadedFile] : [],
    };

    // Add temporary message for optimistic UI
    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      ...payload,
      _id: tempId,
      senderId: user._id,
      senderName: user.name,
      createdAt: new Date().toISOString(),
      status: "sent",
    };

    setMessages((m) => [...m, tempMessage]);
    setInput("");
    setFile(null);
    setFilePreview(null);
    setLocationPreview(null);
    scrollToBottom();

    // emit with ack so server can return real id/status
    if (isGroup) {
      s.emit("message:send", payload, (ack) => {
        if (ack?.ok && ack.messageId) {
          // replace temp id with real id & update status
          setMessages((prev) =>
            prev.map((mm) =>
              mm._id === tempId ? { ...mm, _id: ack.messageId, status: "delivered" } : mm
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((mm) => (mm._id === tempId ? { ...mm, status: "sent" } : mm))
          );
        }
      });
    } else {
      // private: include recipients
      s.emit("message:send", { ...payload, recipients: [receiverIdentifier] }, (ack) => {
        if (ack?.ok && ack.messageId) {
          setMessages((prev) =>
            prev.map((mm) =>
              mm._id === tempId ? { ...mm, _id: ack.messageId, status: "delivered" } : mm
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((mm) => (mm._id === tempId ? { ...mm, status: "sent" } : mm))
          );
        }
      });
    }
  };

  /* -------------------- Typing -------------------- */
  const handleTyping = (e) => {
    setInput(e.target.value);
    const s = getSocket();
    if (!s || !chatId || !receiverIdentifier) return;
    s.emit("typing:start", { chatId, receiverId: receiverIdentifier });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      s.emit("typing:stop", { chatId, receiverId: receiverIdentifier });
    }, 1500);
  };

  /* -------------------- UI -------------------- */
  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="chat-contact">
          {selectedContact ? (
            <>
              <img
                src={selectedContact.avatarUrl}
                className="chat-avatar"
                alt="Avatar"
                onClick={() => setShowProfilePopup(true)}
              />

              <span
                className="contact-name-clickable"
                onClick={() => setShowProfilePopup(true)}
              >
                {selectedContact.name || selectedContact.email}
              </span>

              {selectedContact.isGroup ? (
                <>
                  <span className="group-badge">🧑‍🤝‍🧑 Group</span>

                  <button
                    title="Group Info"
                    onClick={() => setShowGroupSettings(true)}
                    style={{
                      background: "transparent",
                      border: "none",
                      fontSize: "18px",
                      cursor: "pointer",
                      marginLeft: "6px",
                    }}
                  >
                    ℹ️
                  </button>
                </>
              ) : (
                <span
                  className={`status-dot ${
                    selectedContact.online ? "status-online" : "status-offline"
                  }`}
                />
              )}
            </>
          ) : (
            <h3>Start a Chat</h3>
          )}
        </div>

        <button className="create-group-btn" onClick={() => setShowCreateGroup(true)}>
          ➕ Create Group
        </button>

        <div
          className="user-info"
          onClick={() => navigate("/profile-settings")}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <img
            src={
              user?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email)}&background=2563eb&color=fff`
            }
            className="user-avatar"
            alt="User"
          />
          <span>{user?.name || user?.email}</span>
        </div>
      </header>

      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} onCreated={() => window.location.reload()} />
      )}

      {showGroupSettings && selectedContact?.isGroup && (
        <GroupSettingsModal
          groupId={selectedContact._id}
          onClose={() => {
            setShowGroupSettings(false);
            setTimeout(() => window.location.reload(), 300);
          }}
        />
      )}

      {!chatId && (
        <div className="receiver-input">
          <label>Select chat or group:</label>

          <ContactDropdown
            contacts={contacts}
            value={receiverIdentifier}
            onChange={(id) => {
              setReceiverIdentifier(id);
            }}
          />

          <button onClick={async () => {
            // ensure chat if selecting a user
            if (!receiverIdentifier) return;
            const created = await ensureChatExists(receiverIdentifier);
            if (created) setChatId(created);
          }}>
            Start Chat
          </button>
        </div>
      )}

      <main className="chat-main" ref={chatMainRef}>
        <div className="messages">
          {messages.map((m) => (
            <MessageItem
              key={m._id}
              m={m}
              currentUserId={user._id}
              isGroup={selectedContact?.isGroup}
            />
          ))}
        </div>
      </main>

      {chatId && (
        <footer className="chat-footer">
          {isTyping && (
            <div className="typing-indicator-footer">
              💬 {selectedContact?.name} is typing...
            </div>
          )}

          {(filePreview || locationPreview) && (
            <div className="preview-container">
              {filePreview && file?.type?.startsWith("image") ? (
                <img src={filePreview} alt="preview" className="preview-image" />
              ) : filePreview ? (
                <div className="preview-file">{filePreview}</div>
              ) : (
                <div className="preview-file">📍 Location Ready to Send</div>
              )}

              <button
                className="remove-preview"
                onClick={() => {
                  setFile(null);
                  setFilePreview(null);
                  setLocationPreview(null);
                }}
              >
                ✕
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="send-form">
            <button
              type="button"
              className="emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              😀
            </button>

            {showEmojiPicker && (
              <div className="emoji-picker-container" ref={pickerRef}>
                <EmojiPicker
                  onEmojiClick={(e) => setInput((prev) => prev + e.emoji)}
                  autoFocusSearch={false}
                />
              </div>
            )}

            <input placeholder="Type a message..." value={input} onChange={handleTyping} />

            <div className="attach-wrapper">
              <button
                type="button"
                className="file-upload-btn"
                onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              >
                📎
              </button>

              {showAttachmentMenu && (
                <div className="attachment-menu">
                  <label>
                    📷
                    <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    🎥
                    <input type="file" accept="video/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    🎵
                    <input type="file" accept="audio/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    📄
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label onClick={handleShareLocation}>📍 Send Location</label>

                  <label onClick={handleLiveShare}>🌐 {liveSharing ? "Stop Live" : "Live Location"}</label>
                </div>
              )}
            </div>

            <button type="submit" disabled={!socketInitialized}>
              ➤
            </button>
          </form>
        </footer>
      )}

      {showProfilePopup && selectedContact && (
        <ProfilePopup contact={selectedContact} onClose={() => setShowProfilePopup(false)} />
      )}
    </div>
  );
}










// // src/pages/ChatPage.jsx
// import dayjs from "dayjs";
// import relativeTime from "dayjs/plugin/relativeTime";
// import EmojiPicker from "emoji-picker-react";
// import { useEffect, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import CreateGroupModal from "../components/Chat/CreateGroupModal";
// import GroupSettingsModal from "../components/Chat/GroupSettingsModal";
// import ProfilePopup from "../components/ProfilePopup";
// import api from "../services/api";
// import { createSocket, disconnectSocket, getSocket } from "../services/socket";
// import useAuthStore from "../store/useAuthStore";
// import "./ChatPage.css";

// dayjs.extend(relativeTime);

// /* ---------------- MESSAGE ITEM ---------------- */
// function MessageItem({ m, currentUserId, isGroup }) {
//   const isMine = String(m.senderId) === String(currentUserId);

//   const renderAttachment = () => {
//     if (m.contentType === "location" && m.content) {
//       const { lat, lng } = m.content;
//       const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
//       return (
//         <div className="location-card">
//           📍 <strong>Location Shared</strong>
//           <br />
//           <a href={mapUrl} target="_blank" rel="noopener noreferrer">
//             View on Map
//           </a>
//         </div>
//       );
//     }

//     if (!m.attachments?.length) return m.content;
//     const a = m.attachments[0];
//     if (m.contentType === "image")
//       return <img src={a.url} alt={a.name} className="chat-image" />;
//     if (m.contentType === "video")
//       return (
//         <video controls className="chat-video">
//           <source src={a.url} type="video/mp4" />
//         </video>
//       );
//     if (m.contentType === "audio")
//       return (
//         <audio controls className="chat-audio">
//           <source src={a.url} />
//         </audio>
//       );
//     return (
//       <a
//         href={a.url}
//         download={a.name}
//         target="_blank"
//         rel="noopener noreferrer"
//         className="file-link"
//       >
//         📎 {a.name}
//       </a>
//     );
//   };

//   const renderStatus = () => {
//     if (!isMine) return null;
//     if (m.status === "read") return <span className="tick tick-read">✓✓</span>;
//     if (m.status === "delivered")
//       return <span className="tick tick-delivered">✓✓</span>;
//     if (m.status === "sent") return <span className="tick tick-sent">✓</span>;
//     return null;
//   };

//   return (
//     <div className={`message ${isMine ? "mine" : "other"}`}>
//       {isGroup && !isMine && (
//         <div className="group-sender-name">👤 {m.senderName || "Member"}</div>
//       )}
//       <div className="message-body">{renderAttachment()}</div>
//       <div className="message-meta">
//         {dayjs(m.createdAt).format("HH:mm")} {renderStatus()}
//       </div>
//     </div>
//   );
// }

// /* ---------------- CONTACT DROPDOWN ---------------- */
// function ContactDropdown({ contacts, value, onChange }) {
//   const [open, setOpen] = useState(false);
//   const [search, setSearch] = useState("");

//   const selected = contacts.find((c) => c._id === value) || null;

//   const filteredGroups = contacts
//     .filter((c) => c.isGroup)
//     .filter((g) =>
//       (g.name || "")
//         .toString()
//         .toLowerCase()
//         .includes(search.trim().toLowerCase())
//     );

//   const filteredUsers = contacts
//     .filter((c) => !c.isGroup)
//     .filter((u) =>
//       ((u.name || u.email) + "")
//         .toLowerCase()
//         .includes(search.trim().toLowerCase())
//     );

//   const toggle = () => setOpen((o) => !o);
//   const select = (id) => {
//     onChange(id);
//     setOpen(false);
//     setSearch("");
//   };

//   return (
//     <div className="dropdown-wrapper">
//       <div className="dropdown-selected" onClick={toggle}>
//         {selected ? (
//           <>
//             <img src={selected.avatarUrl} alt="" className="dropdown-avatar" />
//             <span>{selected.name || selected.email}</span>
//           </>
//         ) : (
//           <span className="dropdown-placeholder">-- Choose --</span>
//         )}
//         <span className={`dropdown-arrow ${open ? "open" : ""}`}>▼</span>
//       </div>

//       {open && (
//         <div className="dropdown-menu">
//           <div className="dropdown-search-box" style={{ padding: 8 }}>
//             <input
//               type="text"
//               placeholder="🔍 Search..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{
//                 width: "100%",
//                 padding: "8px 10px",
//                 borderRadius: 8,
//                 border: "1px solid #e6e9ef",
//                 outline: "none",
//               }}
//             />
//           </div>

//           {filteredGroups.length > 0 && (
//             <>
//               <div className="dropdown-section-label">Groups</div>
//               {filteredGroups.map((g) => (
//                 <div
//                   key={g._id}
//                   className="dropdown-item"
//                   onClick={() => select(g._id)}
//                 >
//                   <img src={g.avatarUrl} className="dropdown-avatar" alt="" />
//                   <span>{g.name}</span>
//                 </div>
//               ))}
//             </>
//           )}

//           {filteredUsers.length > 0 && (
//             <>
//               <div className="dropdown-section-label">Contacts</div>
//               {filteredUsers.map((u) => (
//                 <div
//                   key={u._id}
//                   className="dropdown-item"
//                   onClick={() => select(u._id)}
//                 >
//                   <img src={u.avatarUrl} className="dropdown-avatar" alt="" />
//                   <span>{u.name || u.email}</span>
//                 </div>
//               ))}
//             </>
//           )}

//           {filteredGroups.length === 0 &&
//             filteredUsers.length === 0 &&
//             search.trim() !== "" && (
//               <div style={{ padding: 10, color: "#666" }}>
//                 No results found
//               </div>
//             )}
//         </div>
//       )}
//     </div>
//   );
// }

// /* -------------------------------------------------------------------------- */
// /* CHAT PAGE                                                                  */
// /* -------------------------------------------------------------------------- */
// export default function ChatPage() {
//   const user = useAuthStore((s) => s.user);
//   const token = useAuthStore((s) => s.token);
//   const navigate = useNavigate();

//   const [socketInitialized, setSocketInitialized] = useState(false);
//   const [messages, setMessages] = useState([]);

//   const [input, setInput] = useState("");
//   const [file, setFile] = useState(null);
//   const [filePreview, setFilePreview] = useState(null);
//   const [locationPreview, setLocationPreview] = useState(null);

//   const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);

//   const [chatId, setChatIdState] = useState(
//     localStorage.getItem("lastChatId") || null
//   );

//   const [receiverIdentifier, setReceiverIdentifierState] = useState(
//     localStorage.getItem("lastReceiverId") || ""
//   );

//   const [contacts, setContacts] = useState([]);
//   const [isTyping, setIsTyping] = useState(false);

//   const [liveSharing, setLiveSharing] = useState(false);
//   const [watchId, setWatchId] = useState(null);

//   const [showProfilePopup, setShowProfilePopup] = useState(false);
//   const [showCreateGroup, setShowCreateGroup] = useState(false);
//   const [showGroupSettings, setShowGroupSettings] = useState(false);

//   const chatMainRef = useRef(null);
//   const pickerRef = useRef(null);
//   const typingTimeoutRef = useRef(null);

//   const selectedContact = contacts.find(
//     (c) => String(c._id) === String(receiverIdentifier)
//   );

//   const setChatId = (id) => {
//     setChatIdState(id);
//     if (id) localStorage.setItem("lastChatId", id);
//     else localStorage.removeItem("lastChatId");

//     const s = getSocket();
//     if (s && id) {
//       // join base chat room
//       s.emit("chat:join", { chatId: id });

//       // join group room if it's a group
//       const target = contacts.find((c) => String(c._id) === String(id));
//       if (target?.isGroup) {
//         s.emit("group:join", { groupId: id });
//       }
//     }
//   };

//   const setReceiverIdentifier = (id) => {
//     setReceiverIdentifierState(id);
//     if (id) localStorage.setItem("lastReceiverId", id);
//     else localStorage.removeItem("lastReceiverId");
//   };


//   /* -------------------- Load Contacts + Groups -------------------- */
//   useEffect(() => {
//     (async () => {
//       try {
//         const [usersRes, chatsRes] = await Promise.all([
//           api.get(`/api/auth/users?excludeId=${user?._id || ""}`),
//           api.get(`/api/chats/my?userId=${user?._id}`),
//         ]);

//         const users = usersRes.data?.users || [];
//         const groups = chatsRes.data?.chats?.filter((c) => c.isGroup) || [];

//         const combined = [
//           ...groups.map((g) => ({
//             _id: g._id,
//             name: g.groupName || "Unnamed Group",
//             isGroup: true,
//             avatarUrl:
//               g.groupAvatar && g.groupAvatar.startsWith("http")
//                 ? g.groupAvatar
//                 : g.groupAvatar
//                 ? `${api.defaults.baseURL}${g.groupAvatar}`
//                 : `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                     g.groupName || "Group"
//                   )}&background=2563eb&color=fff`,
//             unreadCount: 0,
//             online: false,
//           })),
//           ...users.map((u) => ({
//             ...u,
//             isGroup: false,
//             avatarUrl:
//               u.avatarUrl ||
//               `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                 u.name || u.email
//               )}&background=2563eb&color=fff`,
//             unreadCount: 0,
//             online: !!u.online,
//           })),
//         ];

//         setContacts(combined);
//       } catch (err) {
//         console.error("❌ Failed to load contacts/groups:", err);
//       }
//     })();
//   }, [user?._id]);

//   /* -------------------- Emoji Picker Outside Click -------------------- */
//   useEffect(() => {
//     function handleClickOutside(e) {
//       if (pickerRef.current && !pickerRef.current.contains(e.target)) {
//         setShowEmojiPicker(false);
//       }
//     }
//     if (showEmojiPicker)
//       document.addEventListener("click", handleClickOutside);
//     return () =>
//       document.removeEventListener("click", handleClickOutside);
//   }, [showEmojiPicker]);

//   /* -------------------- Socket Setup -------------------- */
//   useEffect(() => {
//     if (!token || !user) return;
//     const s = createSocket(token);
//     if (!s) return;

//     /* --- On connect --- */
//     const onConnect = () => {
//       setSocketInitialized(true);

//       if (chatId) {
//         s.emit("chat:join", { chatId });

//         const selected = contacts.find((c) => String(c._id) === String(chatId));
//         if (selected?.isGroup) {
//           s.emit("group:join", { groupId: chatId });
//         }
//       }
//     };
//     window.addEventListener("socket:connect", onConnect);

//     /* --- NEW FIX: unified "socket:message:new" handles both private + group --- */
//     const onMessageNew = (e) => {
//       const msg = e.detail;

//       /* 1️⃣ If this is the currently open chat → append */
//       if (String(msg.chatId) === String(chatId)) {
//         setMessages((prev) => [...prev, msg]);

//         setTimeout(() => {
//           try {
//             const unreadIds = (messages || [])
//               .filter(
//                 (m) =>
//                   !m.readBy?.includes(user._id) &&
//                   String(m.senderId) !== String(user._id)
//               )
//               .map((m) => m._id);

//             if (unreadIds.length)
//               getSocket()?.emit("message:read", {
//                 chatId,
//                 messageIds: unreadIds,
//               });
//           } catch {}
//         }, 200);

//         scrollToBottom();
//       } else {
//         /* 2️⃣ If NOT open chat → increment unreadCount based on chatId */
//         setContacts((prev) =>
//           prev.map((c) =>
//             String(c._id) === String(msg.chatId)
//               ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
//               : c
//           )
//         );
//       }
//     };
//     window.addEventListener("socket:message:new", onMessageNew);

//     /* --- Typing indicator --- */
//     const onTyping = (e) => {
//       const { chatId: tChatId, from, typing } = e.detail || {};
//       if (
//         String(tChatId) === String(chatId) &&
//         String(from) === String(receiverIdentifier)
//       ) {
//         setIsTyping(Boolean(typing));
//       }
//     };
//     window.addEventListener("socket:typing:update", onTyping);

//     /* --- Status updates --- */
//     const onMessageUpdate = (e) => {
//       const { messageId, status } = e.detail || {};
//       if (!messageId) return;
//       setMessages((prev) =>
//         prev.map((m) =>
//           String(m._id) === String(messageId) ? { ...m, status } : m
//         )
//       );
//     };
//     window.addEventListener("socket:message:update", onMessageUpdate);

//     /* --- Presence updates --- */
//     const onPresence = (e) => {
//       const p = e.detail;
//       setContacts((prev) =>
//         prev.map((c) =>
//           String(c._id) === String(p.userId)
//             ? { ...c, online: p.online }
//             : c
//         )
//       );
//     };
//     window.addEventListener("socket:presence:update", onPresence);

//     return () => {
//       window.removeEventListener("socket:connect", onConnect);
//       window.removeEventListener("socket:message:new", onMessageNew);
//       window.removeEventListener("socket:typing:update", onTyping);
//       window.removeEventListener("socket:message:update", onMessageUpdate);
//       window.removeEventListener("socket:presence:update", onPresence);
//       disconnectSocket();
//       setSocketInitialized(false);
//     };
//   }, [token, chatId, user, receiverIdentifier, contacts]);

//   /* -------------------- Load Messages -------------------- */
//   useEffect(() => {
//     (async () => {
//       if (!chatId) {
//         setMessages([]);
//         return;
//       }
//       try {
//         const res = await api.get(`/api/chats/${chatId}/messages?limit=200`);
//         if (res.data?.messages) {
//           setMessages(res.data.messages);
//           setTimeout(() => scrollToBottom(false), 80);

//           /* Mark messages as read */
//           const messageIds = res.data.messages
//             .filter(
//               (m) =>
//                 String(m.senderId) !== String(user._id) &&
//                 m.status !== "read"
//             )
//             .map((m) => m._id);

//           if (messageIds.length) {
//             getSocket()?.emit("message:read", {
//               chatId,
//               messageIds,
//             });
//           }

//           /* Reset unread counter */
//           setContacts((prev) =>
//             prev.map((c) =>
//               String(c._id) === String(chatId)
//                 ? { ...c, unreadCount: 0 }
//                 : c
//             )
//           );
//         }
//       } catch (err) {
//         console.error("❌ Failed to load messages:", err);
//       }
//     })();
//   }, [chatId]);



//   const scrollToBottom = (smooth = true) => {
//     const c = chatMainRef.current;
//     if (c)
//       c.scrollTo({
//         top: c.scrollHeight,
//         behavior: smooth ? "smooth" : "auto",
//       });
//   };

//   /* -------------------- File Handling -------------------- */
//   const handleFileSelect = (file) => {
//     if (!file) return;
//     setFile(file);
//     const reader = new FileReader();
//     reader.onload = (e) => setFilePreview(e.target.result);
//     reader.readAsDataURL(file);
//     setShowAttachmentMenu(false);
//   };

//   /* -------------------- Location Handling -------------------- */
//   const handleShareLocation = () => {
//     if (!navigator.geolocation) return alert("Location not supported");

//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         const { latitude: lat, longitude: lng } = pos.coords;
//         setLocationPreview({ lat, lng });
//       },
//       () => alert("Unable to get location")
//     );

//     setShowAttachmentMenu(false);
//   };

//   const handleLiveShare = () => {
//     if (liveSharing) {
//       navigator.geolocation.clearWatch(watchId);
//       setWatchId(null);
//       setLiveSharing(false);
//       alert("Live location stopped");
//     } else if (navigator.geolocation) {
//       const id = navigator.geolocation.watchPosition((pos) => {
//         const { latitude: lat, longitude: lng } = pos.coords;
//         const payload = {
//           chatId,
//           content: { lat, lng },
//           contentType: "location",
//           attachments: [],
//         };
//         getSocket()?.emit("message:send", payload);
//       });
//       setWatchId(id);
//       setLiveSharing(true);
//       alert("Live location started");
//     }
//     setShowAttachmentMenu(false);
//   };

//   /* -------------------- Create or Get Chat -------------------- */
//   const ensureChatExists = async (targetId) => {
//     if (chatId) return chatId;

//     try {
//       const res = await api.post("/api/chats/create", {
//         userA: user._id,
//         userB: targetId,
//       });
//       if (res.data?.ok && res.data.chat) {
//         const createdChat = res.data.chat;
//         setChatId(createdChat._id);
//         return createdChat._id;
//       }
//     } catch (err) {
//       console.error("❌ ensureChatExists error:", err);
//     }
//     return null;
//   };

//   /* -------------------- Send Message -------------------- */
//   const sendMessage = async (e) => {
//     e?.preventDefault();

//     if (!input.trim() && !file && !locationPreview) return;

//     const s = getSocket();
//     if (!s) return;

//     let activeChat = chatId;
//     if (!activeChat) {
//       const possible = await ensureChatExists(receiverIdentifier);
//       if (!possible) return alert("Unable to find or create chat.");
//       activeChat = possible;
//     }

//     let uploadedFile = null;
//     if (file) {
//       const fd = new FormData();
//       fd.append("file", file);
//       fd.append("chatId", activeChat);
//       try {
//         const res = await api.post("/api/chats/upload", fd, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });
//         if (res.data?.ok) uploadedFile = res.data.file;
//       } catch (err) {
//         console.error("❌ upload error:", err);
//       }
//     }

//     const selected = contacts.find(
//       (c) => String(c._id) === String(receiverIdentifier)
//     );
//     const isGroup = selected?.isGroup;

//     const payload = {
//       chatId: activeChat,
//       content: locationPreview || input.trim(),
//       contentType: locationPreview
//         ? "location"
//         : file
//         ? file.type.startsWith("image")
//           ? "image"
//           : file.type.startsWith("video")
//           ? "video"
//           : file.type.startsWith("audio")
//           ? "audio"
//           : "file"
//         : "text",
//       attachments: uploadedFile ? [uploadedFile] : [],
//     };

//     /* Temporary optimistic message */
//     const tempId = `temp-${Date.now()}`;
//     const tempMessage = {
//       ...payload,
//       _id: tempId,
//       senderId: user._id,
//       senderName: user.name,
//       createdAt: new Date().toISOString(),
//       status: "sent",
//     };

//     setMessages((m) => [...m, tempMessage]);
//     setInput("");
//     setFile(null);
//     setFilePreview(null);
//     setLocationPreview(null);
//     scrollToBottom();

//     /* Send actual message */
//     if (isGroup) {
//       s.emit("message:send", payload, (ack) => {
//         if (ack?.ok && ack.messageId) {
//           setMessages((prev) =>
//             prev.map((mm) =>
//               mm._id === tempId
//                 ? { ...mm, _id: ack.messageId, status: "delivered" }
//                 : mm
//             )
//           );
//         }
//       });
//     } else {
//       s.emit(
//         "message:send",
//         { ...payload, recipients: [receiverIdentifier] },
//         (ack) => {
//           if (ack?.ok && ack.messageId) {
//             setMessages((prev) =>
//               prev.map((mm) =>
//                 mm._id === tempId
//                   ? { ...mm, _id: ack.messageId, status: "delivered" }
//                   : mm
//               )
//             );
//           }
//         }
//       );
//     }
//   };

//   /* -------------------- Typing -------------------- */
//   const handleTyping = (e) => {
//     setInput(e.target.value);
//     const s = getSocket();
//     if (!s || !chatId || !receiverIdentifier) return;
//     s.emit("typing:start", { chatId, receiverId: receiverIdentifier });
//     clearTimeout(typingTimeoutRef.current);
//     typingTimeoutRef.current = setTimeout(() => {
//       s.emit("typing:stop", { chatId, receiverId: receiverIdentifier });
//     }, 1500);
//   };

//   /* -------------------- UI -------------------- */
//   return (
//     <div className="chat-page">
//       <header className="chat-header">
//         <div className="chat-contact">
//           {selectedContact ? (
//             <>
//               <img
//                 src={selectedContact.avatarUrl}
//                 className="chat-avatar"
//                 alt="Avatar"
//                 onClick={() => setShowProfilePopup(true)}
//               />
//               <span
//                 className="contact-name-clickable"
//                 onClick={() => setShowProfilePopup(true)}
//               >
//                 {selectedContact.name || selectedContact.email}
//               </span>

//               {selectedContact.isGroup ? (
//                 <>
//                   <span className="group-badge">🧑‍🤝‍🧑 Group</span>
//                   <button
//                     title="Group Info"
//                     onClick={() => setShowGroupSettings(true)}
//                     style={{
//                       background: "transparent",
//                       border: "none",
//                       fontSize: "18px",
//                       cursor: "pointer",
//                       marginLeft: "6px",
//                     }}
//                   >
//                     ℹ️
//                   </button>
//                 </>
//               ) : (
//                 <span
//                   className={`status-dot ${
//                     selectedContact.online
//                       ? "status-online"
//                       : "status-offline"
//                   }`}
//                 />
//               )}
//             </>
//           ) : (
//             <h3>Start a Chat</h3>
//           )}
//         </div>

//         <button
//           className="create-group-btn"
//           onClick={() => setShowCreateGroup(true)}
//         >
//           ➕ Create Group
//         </button>

//         <div
//           className="user-info"
//           onClick={() => navigate("/profile-settings")}
//           style={{
//             cursor: "pointer",
//             display: "flex",
//             alignItems: "center",
//             gap: "8px",
//           }}
//         >
//           <img
//             src={
//               user?.avatarUrl ||
//               `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                 user?.name || user?.email
//               )}&background=2563eb&color=fff`
//             }
//             className="user-avatar"
//             alt="User"
//           />
//           <span>{user?.name || user?.email}</span>
//         </div>
//       </header>

//       {showCreateGroup && (
//         <CreateGroupModal
//           onClose={() => setShowCreateGroup(false)}
//           onCreated={() => window.location.reload()}
//         />
//       )}

//       {showGroupSettings && selectedContact?.isGroup && (
//         <GroupSettingsModal
//           groupId={selectedContact._id}
//           onClose={() => {
//             setShowGroupSettings(false);
//             setTimeout(() => window.location.reload(), 300);
//           }}
//         />
//       )}

//       {!chatId && (
//         <div className="receiver-input">
//           <label>Select chat or group:</label>

//           <ContactDropdown
//             contacts={contacts}
//             value={receiverIdentifier}
//             onChange={(id) => setReceiverIdentifier(id)}
//           />

//           <button
//             onClick={async () => {
//               if (!receiverIdentifier) return;
//               const created = await ensureChatExists(receiverIdentifier);
//               if (created) setChatId(created);
//             }}
//           >
//             Start Chat
//           </button>
//         </div>
//       )}

//       <main className="chat-main" ref={chatMainRef}>
//         <div className="messages">
//           {messages.map((m) => (
//             <MessageItem
//               key={m._id}
//               m={m}
//               currentUserId={user._id}
//               isGroup={selectedContact?.isGroup}
//             />
//           ))}
//         </div>
//       </main>

//       {chatId && (
//         <footer className="chat-footer">
//           {isTyping && (
//             <div className="typing-indicator-footer">
//               💬 {selectedContact?.name} is typing...
//             </div>
//           )}

//           {(filePreview || locationPreview) && (
//             <div className="preview-container">
//               {filePreview && file?.type?.startsWith("image") ? (
//                 <img
//                   src={filePreview}
//                   alt="preview"
//                   className="preview-image"
//                 />
//               ) : filePreview ? (
//                 <div className="preview-file">{filePreview}</div>
//               ) : (
//                 <div className="preview-file">
//                   📍 Location Ready to Send
//                 </div>
//               )}

//               <button
//                 className="remove-preview"
//                 onClick={() => {
//                   setFile(null);
//                   setFilePreview(null);
//                   setLocationPreview(null);
//                 }}
//               >
//                 ✕
//               </button>
//             </div>
//           )}

//           <form onSubmit={sendMessage} className="send-form">
//             <button
//               type="button"
//               className="emoji-btn"
//               onClick={() => setShowEmojiPicker(!showEmojiPicker)}
//             >
//               😀
//             </button>

//             {showEmojiPicker && (
//               <div className="emoji-picker-container" ref={pickerRef}>
//                 <EmojiPicker
//                   onEmojiClick={(e) =>
//                     setInput((prev) => prev + e.emoji)
//                   }
//                   autoFocusSearch={false}
//                 />
//               </div>
//             )}

//             <input
//               placeholder="Type a message..."
//               value={input}
//               onChange={handleTyping}
//             />

//             <div className="attach-wrapper">
//               <button
//                 type="button"
//                 className="file-upload-btn"
//                 onClick={() =>
//                   setShowAttachmentMenu(!showAttachmentMenu)
//                 }
//               >
//                 📎
//               </button>

//               {showAttachmentMenu && (
//                 <div className="attachment-menu">
//                   <label>
//                     📷
//                     <input
//                       type="file"
//                       accept="image/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     🎥
//                     <input
//                       type="file"
//                       accept="video/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     🎵
//                     <input
//                       type="file"
//                       accept="audio/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     📄
//                     <input
//                       type="file"
//                       accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label onClick={handleShareLocation}>
//                     📍 Send Location
//                   </label>

//                   <label onClick={handleLiveShare}>
//                     🌐 {liveSharing ? "Stop Live" : "Live Location"}
//                   </label>
//                 </div>
//               )}
//             </div>

//             <button type="submit" disabled={!socketInitialized}>
//               ➤
//             </button>
//           </form>
//         </footer>
//       )}

//       {showProfilePopup && selectedContact && (
//         <ProfilePopup
//           contact={selectedContact}
//           onClose={() => setShowProfilePopup(false)}
//         />
//       )}
//     </div>
//   );
// }






























// // src/pages/ChatPage.jsx
// import dayjs from "dayjs";
// import relativeTime from "dayjs/plugin/relativeTime";
// import EmojiPicker from "emoji-picker-react";
// import { useEffect, useRef, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import CreateGroupModal from "../components/Chat/CreateGroupModal";
// import GroupSettingsModal from "../components/Chat/GroupSettingsModal";
// import ProfilePopup from "../components/ProfilePopup";
// import api from "../services/api";
// import { createSocket, disconnectSocket, getSocket } from "../services/socket";
// import useAuthStore from "../store/useAuthStore";
// import "./ChatPage.css";

// dayjs.extend(relativeTime);

// /* ---------------- MESSAGE ITEM ---------------- */
// function MessageItem({ m, currentUserId, isGroup }) {
//   const isMine = String(m.senderId) === String(currentUserId);

//   const renderAttachment = () => {
//     if (m.contentType === "location" && m.content) {
//       const { lat, lng } = m.content;
//       const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
//       return (
//         <div className="location-card">
//           📍 <strong>Location Shared</strong>
//           <br />
//           <a href={mapUrl} target="_blank" rel="noopener noreferrer">
//             View on Map
//           </a>
//         </div>
//       );
//     }

//     if (!m.attachments?.length) return m.content;
//     const a = m.attachments[0];
//     if (m.contentType === "image")
//       return <img src={a.url} alt={a.name} className="chat-image" />;
//     if (m.contentType === "video")
//       return (
//         <video controls className="chat-video">
//           <source src={a.url} type="video/mp4" />
//         </video>
//       );
//     if (m.contentType === "audio")
//       return (
//         <audio controls className="chat-audio">
//           <source src={a.url} />
//         </audio>
//       );
//     return (
//       <a
//         href={a.url}
//         download={a.name}
//         target="_blank"
//         rel="noopener noreferrer"
//         className="file-link"
//       >
//         📎 {a.name}
//       </a>
//     );
//   };

//   const renderStatus = () => {
//     if (!isMine) return null;
//     if (m.status === "read") return <span className="tick tick-read">✓✓</span>;
//     if (m.status === "delivered")
//       return <span className="tick tick-delivered">✓✓</span>;
//     if (m.status === "sent") return <span className="tick tick-sent">✓</span>;
//     return null;
//   };

//   return (
//     <div className={`message ${isMine ? "mine" : "other"}`}>
//       {isGroup && !isMine && (
//         <div className="group-sender-name">👤 {m.senderName || "Member"}</div>
//       )}
//       <div className="message-body">{renderAttachment()}</div>
//       <div className="message-meta">
//         {dayjs(m.createdAt).format("HH:mm")} {renderStatus()}
//       </div>
//     </div>
//   );
// }

// /* ---------------- CONTACT DROPDOWN ---------------- */
// function ContactDropdown({ contacts, value, onChange }) {
//   const [open, setOpen] = useState(false);
//   const [search, setSearch] = useState("");

//   const selected = contacts.find((c) => c._id === value) || null;

//   const filteredGroups = contacts
//     .filter((c) => c.isGroup)
//     .filter((g) =>
//       (g.name || "")
//         .toString()
//         .toLowerCase()
//         .includes(search.trim().toLowerCase())
//     );

//   const filteredUsers = contacts
//     .filter((c) => !c.isGroup)
//     .filter((u) =>
//       ((u.name || u.email) + "")
//         .toLowerCase()
//         .includes(search.trim().toLowerCase())
//     );

//   const toggle = () => setOpen((o) => !o);
//   const select = (id) => {
//     onChange(id);
//     setOpen(false);
//     setSearch("");
//   };

//   return (
//     <div className="dropdown-wrapper">
//       <div className="dropdown-selected" onClick={toggle}>
//         {selected ? (
//           <>
//             <img src={selected.avatarUrl} alt="" className="dropdown-avatar" />
//             <span>{selected.name || selected.email}</span>
//           </>
//         ) : (
//           <span className="dropdown-placeholder">-- Choose --</span>
//         )}
//         <span className={`dropdown-arrow ${open ? "open" : ""}`}>▼</span>
//       </div>

//       {open && (
//         <div className="dropdown-menu">
//           <div className="dropdown-search-box" style={{ padding: 8 }}>
//             <input
//               type="text"
//               placeholder="🔍 Search..."
//               value={search}
//               onChange={(e) => setSearch(e.target.value)}
//               style={{
//                 width: "100%",
//                 padding: "8px 10px",
//                 borderRadius: 8,
//                 border: "1px solid #e6e9ef",
//                 outline: "none",
//               }}
//             />
//           </div>

//           {filteredGroups.length > 0 && (
//             <>
//               <div className="dropdown-section-label">Groups</div>
//               {filteredGroups.map((g) => (
//                 <div
//                   key={g._id}
//                   className="dropdown-item"
//                   onClick={() => select(g._id)}
//                 >
//                   <img src={g.avatarUrl} className="dropdown-avatar" alt="" />
//                   <span>{g.name}</span>
//                 </div>
//               ))}
//             </>
//           )}

//           {filteredUsers.length > 0 && (
//             <>
//               <div className="dropdown-section-label">Contacts</div>
//               {filteredUsers.map((u) => (
//                 <div
//                   key={u._id}
//                   className="dropdown-item"
//                   onClick={() => select(u._id)}
//                 >
//                   <img src={u.avatarUrl} className="dropdown-avatar" alt="" />
//                   <span>{u.name || u.email}</span>
//                 </div>
//               ))}
//             </>
//           )}

//           {filteredGroups.length === 0 &&
//             filteredUsers.length === 0 &&
//             search.trim() !== "" && (
//               <div style={{ padding: 10, color: "#666" }}>
//                 No results found
//               </div>
//             )}
//         </div>
//       )}
//     </div>
//   );
// }

// /*********************************************/
// /*                CHAT PAGE                  */
// /*********************************************/
// export default function ChatPage() {
//   const user = useAuthStore((s) => s.user);
//   const token = useAuthStore((s) => s.token);
//   const navigate = useNavigate();

//   const [socketInitialized, setSocketInitialized] = useState(false);
//   const [messages, setMessages] = useState([]);

//   const [input, setInput] = useState("");
//   const [file, setFile] = useState(null);
//   const [filePreview, setFilePreview] = useState(null);
//   const [locationPreview, setLocationPreview] = useState(null);

//   const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
//   const [showEmojiPicker, setShowEmojiPicker] = useState(false);

//   const [chatId, setChatIdState] = useState(
//     localStorage.getItem("lastChatId") || null
//   );

//   const [receiverIdentifier, setReceiverIdentifierState] = useState(
//     localStorage.getItem("lastReceiverId") || ""
//   );

//   const [contacts, setContacts] = useState([]);
//   const [isTyping, setIsTyping] = useState(false);

//   const [liveSharing, setLiveSharing] = useState(false);
//   const [watchId, setWatchId] = useState(null);

//   const [showProfilePopup, setShowProfilePopup] = useState(false);
//   const [showCreateGroup, setShowCreateGroup] = useState(false);
//   const [showGroupSettings, setShowGroupSettings] = useState(false);

//   const chatMainRef = useRef(null);
//   const pickerRef = useRef(null);
//   const typingTimeoutRef = useRef(null);

//   const selectedContact = contacts.find(
//     (c) => String(c._id) === String(receiverIdentifier)
//   );

//   /*************************************************/
//   /* setChatId with safe group join                */
//   /*************************************************/
//   const setChatId = (id) => {
//     setChatIdState(id);
//     if (id) localStorage.setItem("lastChatId", id);
//     else localStorage.removeItem("lastChatId");

//     const s = getSocket();
//     if (s && id) {
//       s.emit("chat:join", { chatId: id });

//       const target = contacts.find((c) => String(c._id) === String(id));
//       if (target?.isGroup) {
//         s.emit("group:join", { groupId: id });
//       }
//     }
//   };

//   const setReceiverIdentifier = (id) => {
//     setReceiverIdentifierState(id);
//     if (id) localStorage.setItem("lastReceiverId", id);
//     else localStorage.removeItem("lastReceiverId");
//   };

//   /*************************************************/
//   /* Load Contacts + Groups                        */
//   /*************************************************/
//   useEffect(() => {
//     (async () => {
//       try {
//         const [usersRes, chatsRes] = await Promise.all([
//           api.get(`/api/auth/users?excludeId=${user?._id || ""}`),
//           api.get(`/api/chats/my?userId=${user?._id}`),
//         ]);

//         const users = usersRes.data?.users || [];
//         const groups = chatsRes.data?.chats?.filter((c) => c.isGroup) || [];

//         const combined = [
//           ...groups.map((g) => ({
//             _id: g._id,
//             name: g.groupName || "Unnamed Group",
//             isGroup: true,
//             avatarUrl:
//               g.groupAvatar && g.groupAvatar.startsWith("http")
//                 ? g.groupAvatar
//                 : g.groupAvatar
//                 ? `${api.defaults.baseURL}${g.groupAvatar}`
//                 : `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                     g.groupName || "Group"
//                   )}&background=2563eb&color=fff`,
//             unreadCount: 0,
//             online: false,
//           })),
//           ...users.map((u) => ({
//             ...u,
//             isGroup: false,
//             avatarUrl:
//               u.avatarUrl ||
//               `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                 u.name || u.email
//               )}&background=2563eb&color=fff`,
//             unreadCount: 0,
//             online: !!u.online,
//           })),
//         ];

//         setContacts(combined);
//       } catch (err) {
//         console.error("❌ Failed to load contacts/groups:", err);
//       }
//     })();
//   }, [user?._id]);

//   /*************************************************/
//   /* Close emoji picker on outside click           */
//   /*************************************************/
//   useEffect(() => {
//     function handleClickOutside(e) {
//       if (pickerRef.current && !pickerRef.current.contains(e.target)) {
//         setShowEmojiPicker(false);
//       }
//     }
//     if (showEmojiPicker)
//       document.addEventListener("click", handleClickOutside);
//     return () =>
//       document.removeEventListener("click", handleClickOutside);
//   }, [showEmojiPicker]);

//   /*************************************************/
//   /*  ⭐ SOCKET SETUP — FIXED (no infinite loops)  */
//   /*  Removed contacts from dependency array       */
//   /*************************************************/
//   useEffect(() => {
//     if (!token || !user) return;
//     const s = createSocket(token);
//     if (!s) return;

//     /* CONNECT EVENT */
//     const onConnect = () => {
//       setSocketInitialized(true);

//       if (chatId) {
//         s.emit("chat:join", { chatId });

//         const selected = contacts.find((c) => String(c._id) === String(chatId));
//         if (selected?.isGroup) s.emit("group:join", { groupId: chatId });
//       }
//     };
//     window.addEventListener("socket:connect", onConnect);

//     /*************************************************/
//     /* UNIFIED message:new handler (private + group) */
//     /*************************************************/
//     const onMessageNew = (e) => {
//       const msg = e.detail;

//       if (String(msg.chatId) === String(chatId)) {
//         setMessages((prev) => [...prev, msg]);

//         setTimeout(() => {
//           try {
//             const unreadIds = (messages || [])
//               .filter(
//                 (m) =>
//                   !m.readBy?.includes(user._id) &&
//                   String(m.senderId) !== String(user._id)
//               )
//               .map((m) => m._id);

//             if (unreadIds.length)
//               getSocket()?.emit("message:read", {
//                 chatId,
//                 messageIds: unreadIds,
//               });
//           } catch {}
//         }, 200);

//         scrollToBottom();
//       } else {
//         setContacts((prev) =>
//           prev.map((c) =>
//             String(c._id) === String(msg.chatId)
//               ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
//               : c
//           )
//         );
//       }
//     };
//     window.addEventListener("socket:message:new", onMessageNew);

//     /* TYPING */
//     const onTyping = (e) => {
//       const { chatId: tChatId, from, typing } = e.detail || {};
//       if (
//         String(tChatId) === String(chatId) &&
//         String(from) === String(receiverIdentifier)
//       ) {
//         setIsTyping(Boolean(typing));
//       }
//     };
//     window.addEventListener("socket:typing:update", onTyping);

//     /* STATUS UPDATES */
//     const onMessageUpdate = (e) => {
//       const { messageId, status } = e.detail || {};
//       if (!messageId) return;
//       setMessages((prev) =>
//         prev.map((m) =>
//           String(m._id) === String(messageId) ? { ...m, status } : m
//         )
//       );
//     };
//     window.addEventListener("socket:message:update", onMessageUpdate);

//     /* PRESENCE */
//     const onPresence = (e) => {
//       const p = e.detail;
//       setContacts((prev) =>
//         prev.map((c) =>
//           String(c._id) === String(p.userId)
//             ? { ...c, online: p.online }
//             : c
//         )
//       );
//     };
//     window.addEventListener("socket:presence:update", onPresence);

//     /*************************************************/
//     /* CLEANUP (IMPORTANT — prevents duplicate events) */
//     /*************************************************/
//     return () => {
//       window.removeEventListener("socket:connect", onConnect);
//       window.removeEventListener("socket:message:new", onMessageNew);
//       window.removeEventListener("socket:typing:update", onTyping);
//       window.removeEventListener("socket:message:update", onMessageUpdate);
//       window.removeEventListener("socket:presence:update", onPresence);
//       disconnectSocket();
//       setSocketInitialized(false);
//     };
//   }, [token, chatId, user, receiverIdentifier]); 
//   // ❗ contacts REMOVED from dependency — FIXED

//   /*************************************************/
//   /* Load messages when chatId changes             */
//   /*************************************************/
//   useEffect(() => {
//     (async () => {
//       if (!chatId) {
//         setMessages([]);
//         return;
//       }
//       try {
//         const res = await api.get(`/api/chats/${chatId}/messages?limit=200`);
//         if (res.data?.messages) {
//           setMessages(res.data.messages);
//           setTimeout(() => scrollToBottom(false), 80);

//           const messageIds = res.data.messages
//             .filter(
//               (m) =>
//                 String(m.senderId) !== String(user._id) &&
//                 m.status !== "read"
//             )
//             .map((m) => m._id);

//           if (messageIds.length) {
//             getSocket()?.emit("message:read", {
//               chatId,
//               messageIds,
//             });
//           }

//           setContacts((prev) =>
//             prev.map((c) =>
//               String(c._id) === String(chatId)
//                 ? { ...c, unreadCount: 0 }
//                 : c
//             )
//           );
//         }
//       } catch (err) {
//         console.error("❌ Failed to load messages:", err);
//       }
//     })();
//   }, [chatId]);


//   const scrollToBottom = (smooth = true) => {
//     const c = chatMainRef.current;
//     if (c)
//       c.scrollTo({
//         top: c.scrollHeight,
//         behavior: smooth ? "smooth" : "auto",
//       });
//   };

//   /*************************************************/
//   /* File Handling                                  */
//   /*************************************************/
//   const handleFileSelect = (file) => {
//     if (!file) return;
//     setFile(file);
//     const reader = new FileReader();
//     reader.onload = (e) => setFilePreview(e.target.result);
//     reader.readAsDataURL(file);
//     setShowAttachmentMenu(false);
//   };

//   /*************************************************/
//   /* Location                                      */
//   /*************************************************/
//   const handleShareLocation = () => {
//     if (!navigator.geolocation) return alert("Location not supported");

//     navigator.geolocation.getCurrentPosition(
//       (pos) => {
//         const { latitude: lat, longitude: lng } = pos.coords;
//         setLocationPreview({ lat, lng });
//       },
//       () => alert("Unable to get location")
//     );

//     setShowAttachmentMenu(false);
//   };

//   /*************************************************/
//   /* Live Location                                 */
//   /*************************************************/
//   const handleLiveShare = () => {
//     if (liveSharing) {
//       navigator.geolocation.clearWatch(watchId);
//       setWatchId(null);
//       setLiveSharing(false);
//       alert("Live location stopped");
//     } else if (navigator.geolocation) {
//       const id = navigator.geolocation.watchPosition((pos) => {
//         const { latitude: lat, longitude: lng } = pos.coords;
//         const payload = {
//           chatId,
//           content: { lat, lng },
//           contentType: "location",
//           attachments: [],
//         };
//         getSocket()?.emit("message:send", payload);
//       });
//       setWatchId(id);
//       setLiveSharing(true);
//       alert("Live location started");
//     }
//     setShowAttachmentMenu(false);
//   };

//   /*************************************************/
//   /* Ensure chat exists (private chat only)        */
//   /*************************************************/
//   const ensureChatExists = async (targetId) => {
//     if (chatId) return chatId;

//     try {
//       const res = await api.post("/api/chats/create", {
//         userA: user._id,
//         userB: targetId,
//       });
//       if (res.data?.ok && res.data.chat) {
//         const createdChat = res.data.chat;
//         setChatId(createdChat._id);
//         return createdChat._id;
//       }
//     } catch (err) {
//       console.error("❌ ensureChatExists error:", err);
//     }
//     return null;
//   };

//   /*************************************************/
//   /* Send Message (private + group unified)        */
//   /*************************************************/
//   const sendMessage = async (e) => {
//     e?.preventDefault();

//     if (!input.trim() && !file && !locationPreview) return;

//     const s = getSocket();
//     if (!s) return;

//     let activeChat = chatId;
//     if (!activeChat) {
//       const possible = await ensureChatExists(receiverIdentifier);
//       if (!possible) return alert("Unable to find or create chat.");
//       activeChat = possible;
//     }

//     let uploadedFile = null;
//     if (file) {
//       const fd = new FormData();
//       fd.append("file", file);
//       fd.append("chatId", activeChat);
//       try {
//         const res = await api.post("/api/chats/upload", fd, {
//           headers: { "Content-Type": "multipart/form-data" },
//         });
//         if (res.data?.ok) uploadedFile = res.data.file;
//       } catch (err) {
//         console.error("❌ upload error:", err);
//       }
//     }

//     const selected = contacts.find(
//       (c) => String(c._id) === String(receiverIdentifier)
//     );
//     const isGroup = selected?.isGroup;

//     const payload = {
//       chatId: activeChat,
//       content: locationPreview || input.trim(),
//       contentType: locationPreview
//         ? "location"
//         : file
//         ? file.type.startsWith("image")
//           ? "image"
//           : file.type.startsWith("video")
//           ? "video"
//           : file.type.startsWith("audio")
//           ? "audio"
//           : "file"
//         : "text",
//       attachments: uploadedFile ? [uploadedFile] : [],
//     };

//     /* optimistic temp message */
//     const tempId = `temp-${Date.now()}`;
//     const tempMessage = {
//       ...payload,
//       _id: tempId,
//       senderId: user._id,
//       senderName: user.name,
//       createdAt: new Date().toISOString(),
//       status: "sent",
//     };

//     setMessages((m) => [...m, tempMessage]);
//     setInput("");
//     setFile(null);
//     setFilePreview(null);
//     setLocationPreview(null);
//     scrollToBottom();

//     if (isGroup) {
//       /* GROUP SEND — uses same event "message:send" */
//       s.emit("message:send", payload, (ack) => {
//         if (ack?.ok && ack.messageId) {
//           setMessages((prev) =>
//             prev.map((mm) =>
//               mm._id === tempId
//                 ? { ...mm, _id: ack.messageId, status: "delivered" }
//                 : mm
//             )
//           );
//         }
//       });
//     } else {
//       s.emit(
//         "message:send",
//         { ...payload, recipients: [receiverIdentifier] },
//         (ack) => {
//           if (ack?.ok && ack.messageId) {
//             setMessages((prev) =>
//               prev.map((mm) =>
//                 mm._id === tempId
//                   ? { ...mm, _id: ack.messageId, status: "delivered" }
//                   : mm
//               )
//             );
//           }
//         }
//       );
//     }
//   };

//   /*************************************************/
//   /* Typing indicator                               */
//   /*************************************************/
//   const handleTyping = (e) => {
//     setInput(e.target.value);
//     const s = getSocket();
//     if (!s || !chatId || !receiverIdentifier) return;

//     s.emit("typing:start", { chatId, receiverId: receiverIdentifier });

//     clearTimeout(typingTimeoutRef.current);
//     typingTimeoutRef.current = setTimeout(() => {
//       s.emit("typing:stop", { chatId, receiverId: receiverIdentifier });
//     }, 1500);
//   };

//   /*************************************************/
//   /*                    UI                          */
//   /*************************************************/
//   return (
//     <div className="chat-page">
//       <header className="chat-header">
//         <div className="chat-contact">
//           {selectedContact ? (
//             <>
//               <img
//                 src={selectedContact.avatarUrl}
//                 className="chat-avatar"
//                 alt="Avatar"
//                 onClick={() => setShowProfilePopup(true)}
//               />
//               <span
//                 className="contact-name-clickable"
//                 onClick={() => setShowProfilePopup(true)}
//               >
//                 {selectedContact.name || selectedContact.email}
//               </span>

//               {selectedContact.isGroup ? (
//                 <>
//                   <span className="group-badge">🧑‍🤝‍🧑 Group</span>
//                   <button
//                     title="Group Info"
//                     onClick={() => setShowGroupSettings(true)}
//                     style={{
//                       background: "transparent",
//                       border: "none",
//                       fontSize: "18px",
//                       cursor: "pointer",
//                       marginLeft: "6px",
//                     }}
//                   >
//                     ℹ️
//                   </button>
//                 </>
//               ) : (
//                 <span
//                   className={`status-dot ${
//                     selectedContact.online
//                       ? "status-online"
//                       : "status-offline"
//                   }`}
//                 />
//               )}
//             </>
//           ) : (
//             <h3>Start a Chat</h3>
//           )}
//         </div>

//         <button
//           className="create-group-btn"
//           onClick={() => setShowCreateGroup(true)}
//         >
//           ➕ Create Group
//         </button>

//         <div
//           className="user-info"
//           onClick={() => navigate("/profile-settings")}
//           style={{
//             cursor: "pointer",
//             display: "flex",
//             alignItems: "center",
//             gap: "8px",
//           }}
//         >
//           <img
//             src={
//               user?.avatarUrl ||
//               `https://ui-avatars.com/api/?name=${encodeURIComponent(
//                 user?.name || user?.email
//               )}&background=2563eb&color=fff`
//             }
//             className="user-avatar"
//             alt="User"
//           />
//           <span>{user?.name || user?.email}</span>
//         </div>
//       </header>

//       {showCreateGroup && (
//         <CreateGroupModal
//           onClose={() => setShowCreateGroup(false)}
//           onCreated={() => window.location.reload()}
//         />
//       )}

//       {showGroupSettings && selectedContact?.isGroup && (
//         <GroupSettingsModal
//           groupId={selectedContact._id}
//           onClose={() => {
//             setShowGroupSettings(false);
//             setTimeout(() => window.location.reload(), 300);
//           }}
//         />
//       )}

//       {!chatId && (
//         <div className="receiver-input">
//           <label>Select chat or group:</label>

//           <ContactDropdown
//             contacts={contacts}
//             value={receiverIdentifier}
//             onChange={(id) => setReceiverIdentifier(id)}
//           />

//           <button
//             onClick={async () => {
//               if (!receiverIdentifier) return;
//               const created = await ensureChatExists(receiverIdentifier);
//               if (created) setChatId(created);
//             }}
//           >
//             Start Chat
//           </button>
//         </div>
//       )}

//       <main className="chat-main" ref={chatMainRef}>
//         <div className="messages">
//           {messages.map((m) => (
//             <MessageItem
//               key={m._id}
//               m={m}
//               currentUserId={user._id}
//               isGroup={selectedContact?.isGroup}
//             />
//           ))}
//         </div>
//       </main>

//       {chatId && (
//         <footer className="chat-footer">
//           {isTyping && (
//             <div className="typing-indicator-footer">
//               💬 {selectedContact?.name} is typing...
//             </div>
//           )}

//           {(filePreview || locationPreview) && (
//             <div className="preview-container">
//               {filePreview && file?.type?.startsWith("image") ? (
//                 <img
//                   src={filePreview}
//                   alt="preview"
//                   className="preview-image"
//                 />
//               ) : filePreview ? (
//                 <div className="preview-file">{filePreview}</div>
//               ) : (
//                 <div className="preview-file">
//                   📍 Location Ready to Send
//                 </div>
//               )}

//               <button
//                 className="remove-preview"
//                 onClick={() => {
//                   setFile(null);
//                   setFilePreview(null);
//                   setLocationPreview(null);
//                 }}
//               >
//                 ✕
//               </button>
//             </div>
//           )}

//           <form onSubmit={sendMessage} className="send-form">
//             <button
//               type="button"
//               className="emoji-btn"
//               onClick={() => setShowEmojiPicker(!showEmojiPicker)}
//             >
//               😀
//             </button>

//             {showEmojiPicker && (
//               <div className="emoji-picker-container" ref={pickerRef}>
//                 <EmojiPicker
//                   onEmojiClick={(e) =>
//                     setInput((prev) => prev + e.emoji)
//                   }
//                   autoFocusSearch={false}
//                 />
//               </div>
//             )}

//             <input
//               placeholder="Type a message..."
//               value={input}
//               onChange={handleTyping}
//             />

//             <div className="attach-wrapper">
//               <button
//                 type="button"
//                 className="file-upload-btn"
//                 onClick={() =>
//                   setShowAttachmentMenu(!showAttachmentMenu)
//                 }
//               >
//                 📎
//               </button>

//               {showAttachmentMenu && (
//                 <div className="attachment-menu">
//                   <label>
//                     📷
//                     <input
//                       type="file"
//                       accept="image/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     🎥
//                     <input
//                       type="file"
//                       accept="video/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     🎵
//                     <input
//                       type="file"
//                       accept="audio/*"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label>
//                     📄
//                     <input
//                       type="file"
//                       accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt"
//                       hidden
//                       onChange={(e) =>
//                         handleFileSelect(e.target.files[0])
//                       }
//                     />
//                   </label>

//                   <label onClick={handleShareLocation}>
//                     📍 Send Location
//                   </label>

//                   <label onClick={handleLiveShare}>
//                     🌐 {liveSharing ? "Stop Live" : "Live Location"}
//                   </label>
//                 </div>
//               )}
//             </div>

//             <button type="submit" disabled={!socketInitialized}>
//               ➤
//             </button>
//           </form>
//         </footer>
//       )}

//       {showProfilePopup && selectedContact && (
//         <ProfilePopup
//           contact={selectedContact}
//           onClose={() => setShowProfilePopup(false)}
//         />
//       )}
//     </div>
//   );
// }
