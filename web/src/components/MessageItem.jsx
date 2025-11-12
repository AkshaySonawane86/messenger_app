


import dayjs from "dayjs";
import "./MessageItem.css";

export default function MessageItem({ m, currentUserId }) {
  const isMine = String(m.senderId) === String(currentUserId);

  return (
    <div className={`message ${isMine ? "mine" : "other"}`}>
      <div className="message-body">
        {m.contentType === "image" && m.attachments?.[0] ? (
          <img src={m.attachments[0].url} className="chat-image" />
        ) : m.contentType === "file" && m.attachments?.[0] ? (
          <a href={m.attachments[0].url} download={m.attachments[0].name}>
            📎 {m.attachments[0].name}
          </a>
        ) : (
          m.content
        )}
      </div>
      <div className="message-meta">{dayjs(m.createdAt).format("HH:mm")}</div>
    </div>
  );
}
