

// src/pages/ChatPage.jsx
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
// import ProfilePopup from "../components/ProfilePopup";
import api from "../services/api";
import { createSocket, disconnectSocket, getSocket } from "../services/socket";
import useAuthStore from "../store/useAuthStore";
import "./ChatPage.css";
import dots from '../img/dots.png';
import DotsPage from './dotsPage';
import ProfileView from "./ProfileView";
import LeftSidePage from "./LeftSidePage";
// import MessageItem from "../components/MessageItem";
import GroupSettingsModal from '../Dashboard/GroupSettingsModal';

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
  const [chatId, setChatId] = useState(localStorage.getItem("lastChatId") || null);
  const [receiverIdentifier, setReceiverIdentifier] = useState(localStorage.getItem("lastReceiverId") || "");
  const [contacts, setContacts] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [liveSharing, setLiveSharing] = useState(false);
  const [watchId, setWatchId] = useState(null);
  // const [showProfilePopup, setShowProfilePopup] = useState(false);

  const chatMainRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

   const selectedContact = contacts.find((c) => String(c._id) === String(receiverIdentifier));

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

  /* -------------------- Chat setup -------------------- */
  async function ensureChatExists() {
    if (!user?._id || !receiverIdentifier) return;
    const res = await api.post("/api/chats/create", { userA: user._id, userB: receiverIdentifier });
    if (res.data?.chat?._id) {
      const cid = res.data.chat._id;
      setChatId(cid);
      localStorage.setItem("lastChatId", cid);
      localStorage.setItem("lastReceiverId", receiverIdentifier);
      getSocket()?.emit("chat:join", { chatId: cid });
      return cid;
    }
  }

  useEffect(() => {
    if (!chatId) return;
    (async () => {
      try {
        const res = await api.get(`/api/chats/${chatId}/messages?limit=100`);
        if (res.data?.messages) {
          setMessages(res.data.messages);
          setTimeout(() => scrollToBottom(false), 100);
        }
      } catch {}
    })();
  }, [chatId]);

  useEffect(() => {
    if (!token || !user) return;
    const s = createSocket(token);
    s.on("connect", () => {
      setSocketInitialized(true);
      if (chatId) s.emit("chat:join", { chatId });
    });
    s.on("message:new", (msg) => {
      if (msg.chatId === chatId) {
        setMessages((p) => [...p, msg]);
        scrollToBottom();
      }
    });
    s.on("typing:update", (d) => {
      if (d.chatId === chatId && d.from !== user?._id) setIsTyping(d.typing);
    });
    s.on("disconnect", () => setSocketInitialized(false));
    return () => disconnectSocket();
  }, [token, chatId, user]);

  const scrollToBottom = (smooth = true) => {
    const c = chatMainRef.current;
    if (c) c.scrollTo({ top: c.scrollHeight, behavior: smooth ? "smooth" : "auto" });
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


  // Akshay


  // console.log('This is reciverIdentifier',receiverIdentifier);
  // console.log('THis is user id',contacts[0]);
  
  // console.log('THis ',contacts);
  // console.log('selectchart',{selectedChat});

  const [selectedChat,setSelectedChat]=useState([]);
  const [dotsImgClick,setDotsImgClick]=useState(false);
  const [profileView,setProfileView]=useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);

  return (
    <>

    {/* Rahul code */}
<div
      className="chat-container"
      
    >
{/* Sidebar */}
      <div
        className="sidebar"
      >

        <div
        className="quickChart"
          
        >
          QuickChat
          <img className="dotsImg" src={dots} alt="Three decorative dots" onClick={()=>setDotsImgClick(!dotsImgClick)} />
        </div>
       {dotsImgClick && <DotsPage receiverIdentifier={receiverIdentifier} selectedChat={selectedChat} />} 
        

        <LeftSidePage
           contacts={contacts}
           setSelectedChat={setSelectedChat}
           setReceiverIdentifier={setReceiverIdentifier}
           receiverIdentifier={receiverIdentifier}
           ensureChatExists={ensureChatExists}
        />

        </div>

        {/* Chat Area */}
      <div
        className="chat-area"
      >
    
       {receiverIdentifier ? (
      <>
       {/* Chat Header */}
            <div
            
              style={{
                padding: "15px 20px",
                borderBottom: "1px solid #e0e0e0",
                backgroundColor: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
              className="chat-header-img"
              >
              <img
            src={
              selectedChat?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat?.name || selectedChat?.email)}&background=baf3db&color=fff`
            }
            className="user-avatar"
            alt="User"
          />
              </div>
            <h2 className="chat-header-name" onClick={()=>{
              const isGroup=selectedChat.isGroup;

              isGroup ? setShowGroupSettings(true) :
              setProfileView(!profileView)}}>
                {selectedChat.name || selectedChat.email}
              </h2>
              {profileView && <ProfileView selectedChat={selectedChat} onClose={() => setProfileView(false)} />}
              
              {showGroupSettings && selectedContact?.isGroup && (
        <GroupSettingsModal
          groupId={selectedContact._id}
          onClose={() => {
            setShowGroupSettings(false);
            setTimeout(() => window.location.reload(), 300);
          }}
        />
      )}
            </div>


            {/* Messages */}
            <div
            className="messages-rahul"
            >
          <div className="chat-messages">
          {messages.map((m) => (
            <MessageItem key={m._id} m={m} currentUserId={user._id} isGroup={selectedContact?.isGroup} />
          ))}
        </div>
       </div>

         {/* Footer */}
        {chatId && (
          <footer className="chat-footer">
            {isTyping && (
              <div className="typing-indicator-footer">
                💬 {selectedContact?.name} is typing...
              </div>
            )}
            {/* Preview Section */}
            {(filePreview || locationPreview) && (
              <div className="preview-container">
                {filePreview && file?.type.startsWith("image") ? (
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
            {/* Message Input Form */}
            <form className="send-form" onSubmit={sendMessage}>
<button
  type="button"
  className="emoji-btn"
  onClick={(e) => {
    e.stopPropagation();
    setShowEmojiPicker(!showEmojiPicker);
  }}
>
  😄
</button>
{showEmojiPicker && (
  <div
    className="emoji-picker-container"
    ref={pickerRef}
    onClick={(e) => e.stopPropagation()} // Prevent auto-close
  >
    <EmojiPicker
      onEmojiClick={(emojiData) => {
        setInput((prev) => prev + emojiData.emoji);
        
        // setShowEmojiPicker(false); // auto-close after select
      }}
      autoFocusSearch={false}
    />
  </div>
)}
              <input
                placeholder="Type a message..."
                value={input}
                onChange={handleTyping}
              />
              {/* Attachment Menu */}
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
                    📷 Image
                    <input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    🎥 Video
                    <input type="file" accept="video/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    🎵 Audio
                    <input type="file" accept="audio/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label>
                    📄 Document
                    <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt" hidden onChange={(e) => handleFileSelect(e.target.files[0])} />
                  </label>

                  <label onClick={handleShareLocation}>📍 Send Location</label>

                  <label onClick={handleLiveShare}>🌐 {liveSharing ? "Stop Live" : "Live Location"}</label>
                </div>
              )}
              </div>
              <button type="submit" disabled={!socketInitialized}>➤</button>
            </form>
          </footer>
        )}

            
      </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
            }}
          >
            Select a chat to start messaging
          </div>
        )}

        

      </div>
    </div>

    </>
  );
}
