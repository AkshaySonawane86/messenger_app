
// src/components/Chat/ChatContainer.jsx
import { useState } from "react";
import "./ChatContainer.css";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";

export default function ChatContainer() {
  const [activeChatId, setActiveChatId] = useState(null);

  return (
    <div className="chat-container">
      <div className="chat-list-section">
        <ChatList onSelectChat={(id) => setActiveChatId(id)} />
      </div>
      <div className="chat-window-section">
        {activeChatId ? (
          <ChatWindow activeChatId={activeChatId} />
        ) : (
          <div className="no-chat-selected">Select or create a chat</div>
        )}
      </div>
    </div>
  );
}
