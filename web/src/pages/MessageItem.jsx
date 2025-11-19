import React from "react";
import dayjs from "dayjs";
import "./ChatPage.css";

function MessageItem({ m, currentUserId, isGroup }) {
  const isMine = String(m.senderId) === String(currentUserId);

 const renderAttachment = () => {
  // Location Type
  if (m.contentType === "location" && m.content) {
    const { lat, lng } = m.content;
    return (
      <div className="location-card">
        📍 <strong>Location Shared</strong>
        <br />
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Map
        </a>
      </div>
    );
  }

  // Normal Text (but safe)
  if (!m.attachments?.length) {
    if (typeof m.content === "object") {
      return ""; // or JSON.stringify(m.content)
    }
    return m.content;
  }

  const a = m.attachments[0];

  if (m.contentType === "image") {
    return <img src={a.url} alt={a.name} className="chat-image" />;
  }

  if (m.contentType === "video") {
    return (
      <video controls className="chat-video">
        <source src={a.url} type="video/mp4" />
      </video>
    );
  }

  if (m.contentType === "audio") {
    return (
      <audio controls className="chat-audio">
        <source src={a.url} />
      </audio>
    );
  }

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

    if (m.status === "read")
      return <span className="tick tick-read">✓✓</span>;

    if (m.status === "delivered")
      return <span className="tick tick-delivered">✓✓</span>;

    if (m.status === "sent")
      return <span className="tick tick-sent">✓</span>;

    return null;
  };

  return (
    <div className={`message ${isMine ? "mine" : "other"}`}>
      {/* GROUP CHAT - Show Sender Name */}
      {isGroup && !isMine && (
        <div className="group-sender-name">
          👤 {m.senderName || "Member"}
        </div>
      )}

      <div className="message-body">{renderAttachment()}</div>

      <div className="message-meta">
        {dayjs(m.createdAt).format("HH:mm")} {renderStatus()}
      </div>
    </div>
  );
}

export default MessageItem;
