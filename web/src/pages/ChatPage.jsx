

// src/pages/ChatPage.jsx
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ProfilePopup from "../components/ProfilePopup";
import api from "../services/api";
import { createSocket, disconnectSocket, getSocket } from "../services/socket";
import useAuthStore from "../store/useAuthStore";
import "./ChatPage.css";

dayjs.extend(relativeTime);

function MessageItem({ m, currentUserId }) {
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
      <a href={a.url} download={a.name} target="_blank" rel="noopener noreferrer" className="file-link">
        📎 {a.name}
      </a>
    );
  };

  const renderStatus = () => {
    if (!isMine) return null;
    if (m.status === "read") return <span className="tick tick-read">✓✓</span>;
    if (m.status === "delivered") return <span className="tick tick-delivered">✓✓</span>;
    if (m.status === "sent") return <span className="tick tick-sent">✓</span>;
    return null;
  };

  return (
    <div className={`message ${isMine ? "mine" : "other"}`}>
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
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  const chatMainRef = useRef(null);
  const pickerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  /* -------------------- Load contacts -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/auth/users?excludeId=${user?._id || ""}`);
        if (res.data?.ok) setContacts(res.data.users);
      } catch {}
    })();
  }, [user?._id]);

  const selectedContact = contacts.find((c) => String(c._id) === String(receiverIdentifier));

  /* -------------------- Outside click for emoji picker -------------------- */
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

  /* -------------------- File handling -------------------- */
  const handleFileSelect = (file) => {
    if (!file) return;
    setFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setFilePreview(e.target.result);
    reader.readAsDataURL(file);
    setShowAttachmentMenu(false);
  };

  /* -------------------- Location handling -------------------- */
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
          recipients: [receiverIdentifier],
        };
        getSocket()?.emit("message:send", payload);
      });
      setWatchId(id);
      setLiveSharing(true);
      alert("Live location started");
    }
    setShowAttachmentMenu(false);
  };

  /* -------------------- Send message -------------------- */
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() && !file && !locationPreview) return;
    const activeChat = chatId || (await ensureChatExists());
    if (!activeChat) return;

    let uploadedFile = null;
    if (file) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("chatId", activeChat);
      const res = await api.post("/api/chats/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.ok) uploadedFile = res.data.file;
    }

    const payload = {
      chatId: activeChat,
      content: locationPreview || input.trim(),
      contentType: locationPreview
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
      recipients: [receiverIdentifier],
    };

    setMessages((m) => [
      ...m,
      { ...payload, _id: `temp-${Date.now()}`, senderId: user._id, createdAt: new Date() },
    ]);
    setInput("");
    setFile(null);
    setFilePreview(null);
    setLocationPreview(null);
    scrollToBottom();
    getSocket()?.emit("message:send", payload);
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
    }, 2000);
  };


  // Akshay
  // console.log('This is reciverIdentifier',receiverIdentifier);
  // console.log('THis is user id',contacts[0]);
  
  // console.log('THis ',contacts);
  // console.log('selectchart',{selectedChat});

  const [selectedChat,setSelectedChat]=useState([]);
  // console.log(selectedChat);

  // async function ensureChatExist(id) {
  //   if (!user?._id || !receiverIdentifier) return;
  //   const res = await api.post("/api/chats/create", { userA: user._id, userB: id });
  //   if (res.data?.chat?._id) {
  //     const cid = res.data.chat._id;
  //     setChatId(cid);
  //     localStorage.setItem("lastChatId", cid);
  //     localStorage.setItem("lastReceiverId", receiverIdentifier);
  //     getSocket()?.emit("chat:join", { chatId: cid });
  //     return cid;
  //   }
  // }

  

  return (
    <>
    <div className="chat-page" style={{display: "none"}}>
      <header className="chat-header" style={{border: '10px solid #000'}}>
        <div className="chat-contact">
          {selectedContact ? (
            <>
              <img
                src={
                  selectedContact.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedContact.name || selectedContact.email)}&background=2563eb&color=fff`
                }
                className="chat-avatar"
              />
              <span className="contact-name-clickable" onClick={() => setShowProfilePopup(true)}>
                {selectedContact.name || selectedContact.email}
              </span>
              <span className={`status-dot ${selectedContact.online ? "status-online" : "status-offline"}`} />
            </>
          ) : (
            <h3>Start a Chat</h3>
          )}
        </div>

        <div className="user-info" onClick={() => navigate("/profile-settings")} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <img
            src={
              user?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || user?.email)}&background=2563eb&color=fff`
            }
            className="user-avatar"
          />
          <span>{user?.name || user?.email}</span>
        </div>
      </header>

      {!chatId && (
        <div className="receiver-input">
          <label>Select a user:</label>
          <select value={receiverIdentifier} onChange={(e) => setReceiverIdentifier(e.target.value)}>
            <option value="">-- Choose --</option>
            {contacts.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name || c.email}
              </option>
            ))}
          </select>
          <button onClick={ensureChatExists}>Start Chat</button>
        </div>
      )}

      <main className="chat-main" ref={chatMainRef}>
        <div className="messages">
          {messages.map((m) => (
            <MessageItem key={m._id} m={m} currentUserId={user._id} />
          ))}
        </div>
      </main>

      {chatId && (
        <footer className="chat-footer">
          {isTyping && <div className="typing-indicator-footer">💬 {selectedContact?.name} is typing...</div>}

          {/* ✅ Preview Section */}
          {(filePreview || locationPreview) && (
            <div className="preview-container">
              {filePreview && file?.type.startsWith("image") ? (
                <img src={filePreview} alt="preview" className="preview-image" />
              ) : filePreview ? (
                <div className="preview-file">{filePreview}</div>
              ) : (
                <div className="preview-file">📍 Location Ready to Send</div>
              )}
              <button className="remove-preview" onClick={() => { setFile(null); setFilePreview(null); setLocationPreview(null); }}>✕</button>
            </div>
          )}

          <form onSubmit={sendMessage} className="send-form">
            <button type="button" className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              😀
            </button>
            {showEmojiPicker && (
              <div className="emoji-picker-container" ref={pickerRef}>
                <EmojiPicker onEmojiClick={(e) => setInput((prev) => prev + e.emoji)} autoFocusSearch={false} />
              </div>
            )}
            <input placeholder="Type a message..." value={input} onChange={handleTyping} />
            <div className="attach-wrapper">
              <button type="button" className="file-upload-btn" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}>
                📎
              </button>
              {showAttachmentMenu && (
                <div className="attachment-menu">
                  <label>📷<input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>🎥<input type="file" accept="video/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>🎵<input type="file" accept="audio/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>📄<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label onClick={handleShareLocation}>📍 Send Location</label>
                  <label onClick={handleLiveShare}>🌐 {liveSharing ? "Stop Live" : "Live Location"}</label>
                </div>
              )}
            </div>
            <button type="submit" disabled={!socketInitialized}>➤</button>
          </form>
        </footer>
      )}

      {showProfilePopup && selectedContact && (
        <ProfilePopup contact={selectedContact} onClose={() => setShowProfilePopup(false)} />
      )}
    </div>

    {/* Rahul code */}
<div
      className="chat-container"
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: "#f4fdfa",
        fontFamily: "Arial, sans-serif",
      }}
    >
{/* Sidebar */}
      <div
        className="sidebar"
        style={{
          width: "30%",
          backgroundColor: "#fff",
          borderRight: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
        }}
      >

        <div
          style={{
            padding: "15px",
            borderBottom: "1px solid #e0e0e0",
            fontWeight: "bold",
            fontSize: "20px",
            color: "#2ac48a",
          }}
        >
          QuickChat
        </div>
        

        <div style={{ flex: 1, overflowY: "auto" }}>
            {contacts.map((chat) => (
          <div
              key={chat}
              onClick={() => {
                      setSelectedChat(chat);
                      setReceiverIdentifier(chat._id);
                      // console.log("This is selectChart",selectedChat);
                      // console.log("after the click the reciverId",receiverIdentifier);
                      // ensureChatExist('selectedChat')
                      ensureChatExists();
                   }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "12px 16px",
                cursor: "pointer",
                backgroundColor: receiverIdentifier === chat._id ? "#e6f9f0" : "transparent",
                transition: "0.2s",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#baf3db",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: "#fff",
                }}
              >
                {/* {chat.avatarUrl} */}
                <img
                src={
                  chat.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name || chat.email)}&background=baf3db&color=fff`
                }
                className="chat-avatar"
              />
              </div>
               <div style={{ fontSize: "16px", color: "#222" }}>{chat.name || chat.email}</div>

            </div>
            ))}
        </div>
        </div>

        {/* Chat Area */}
      <div
        className="chat-area"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          border: '2px solid #000'
        }}
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
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  backgroundColor: "#baf3db",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: "bold",
                  color: "#fff",
                  // border: '2px solid #000'
                }}
              >
              {/* {contacts._id === receiverIdentifier} */}
              
                {/* {receiverIdentifier[0]} */}
                {/* {selectedChat[0]} */}
                <img
                src={
                  selectedChat.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat.name || selectedChat.email)}&background=baf3db&color=fff`
                }
                className="chat-avatar"
              />
              </div>
              <h2 style={{ margin: 0, fontSize: "18px", color: "#2ac48a" }}>
                {/* {selectedChat} */}
                {/* {receiverIdentifier} */}
                {/* {contacts.map(user => user._id === receiverIdentifier) ? contacts.email : 'No name'} */}
                {selectedChat.name || selectedChat.email}
              </h2>
            </div>


            {/* Messages */}
            <div
              style={{
                flex: 1,
                padding: "15px",
                overflowY: "auto",
                backgroundColor: "#f4fdfa",
                display: "flex",
                flexDirection: "column",
              }}
            >

              {/* {messages.map((m) => (
            <MessageItem key={m._id} m={m} currentUserId={user._id} />
          ))} */}

          
          {messages.map((m) => (
            <MessageItem key={m._id} m={m} currentUserId={user._id} />
          ))}
        

       </div>

          {chatId && (
        <footer className="chat-footer">
          {isTyping && <div className="typing-indicator-footer">💬 {selectedContact?.name} is typing...</div>}

          {/* ✅ Preview Section */}
          {(filePreview || locationPreview) && (
            <div className="preview-container">
              {filePreview && file?.type.startsWith("image") ? (
                <img src={filePreview} alt="preview" className="preview-image" />
              ) : filePreview ? (
                <div className="preview-file">{filePreview}</div>
              ) : (
                <div className="preview-file">📍 Location Ready to Send</div>
              )}
              <button className="remove-preview" onClick={() => { setFile(null); setFilePreview(null); setLocationPreview(null); }}>✕</button>
            </div>
          )}

          <form onSubmit={sendMessage} className="send-form">
            <button type="button" className="emoji-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
              😀
            </button>
            {showEmojiPicker && (
              <div className="emoji-picker-container" ref={pickerRef}>
                <EmojiPicker onEmojiClick={(e) => setInput((prev) => prev + e.emoji)} autoFocusSearch={false} />
              </div>
            )}
            <input placeholder="Type a message..." value={input} onChange={handleTyping} />
            <div className="attach-wrapper">
              <button type="button" className="file-upload-btn" onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}>
                📎
              </button>
              {showAttachmentMenu && (
                <div className="attachment-menu">
                  <label>📷<input type="file" accept="image/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>🎥<input type="file" accept="video/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>🎵<input type="file" accept="audio/*" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
                  <label>📄<input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.txt" hidden onChange={(e) => handleFileSelect(e.target.files[0])} /></label>
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
