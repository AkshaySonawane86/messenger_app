// src/components/Chat/MessageBubble.jsx
import "./MessageBubble.css";

export default function MessageBubble({ message }) {
  const isMine = message.sender === "me";
  return (
    <div className={`message-bubble ${isMine ? "mine" : "theirs"}`}>
      <div className="message-content">{message.content}</div>
      <div className="message-time">{message.time}</div>
    </div>
  );
}
