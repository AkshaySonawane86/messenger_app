

// // src/components/Chat/ChatList.jsx
// import { useEffect, useState } from "react";
// import api from "../../services/api"; // 👈 for backend integration (optional)
// import "./ChatList.css";

// export default function ChatList({ onSelectChat }) {
//   const [chats, setChats] = useState([
//     { id: 1, name: "John Doe", lastMessage: "Hey there!", time: "10:45 AM" },
//     { id: 2, name: "Sarah", lastMessage: "Let’s meet tomorrow!", time: "Yesterday" },
//   ]);
//   const [loading, setLoading] = useState(false);

//   // ✅ Optional: load from backend (if API ready)
//   useEffect(() => {
//     const fetchChats = async () => {
//       try {
//         setLoading(true);
//         const res = await api.get("/api/chats");
//         if (res.data?.chats) setChats(res.data.chats);
//       } catch (err) {
//         console.warn("⚠️ Failed to load chats:", err.message);
//       } finally {
//         setLoading(false);
//       }
//     };
//     // Uncomment below once backend route is active
//     // fetchChats();
//   }, []);

//   return (
//     <div className="chat-list">
//       <div className="chat-list-header">Chats</div>

//       <div className="chat-list-body">
//         {loading && <div className="chat-loading">Loading...</div>}

//         {!loading && chats.length === 0 && (
//           <div className="no-chats">No chats yet.</div>
//         )}

//         {!loading &&
//           chats.map((chat) => (
//             <div
//               key={chat._id || chat.id}
//               className="chat-item"
//               onClick={() => onSelectChat && onSelectChat(chat._id || chat.id)} // ✅ allows ChatContainer to open it
//             >
//               <div className="chat-avatar">
//                 {chat.name?.[0]?.toUpperCase() || "?"}
//               </div>

//               <div className="chat-info">
//                 <div className="chat-name">{chat.name || "Unnamed"}</div>
//                 <div className="chat-last">{chat.lastMessage || "No messages yet"}</div>
//               </div>

//               <div className="chat-time">{chat.time || ""}</div>
//             </div>
//           ))}
//       </div>
//     </div>
//   );
// }




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
      if (res.data?.chats) setChats(res.data.chats);
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
              <div className="chat-avatar">
                {chat.isGroup
                  ? "👥"
                  : chat.name?.[0]?.toUpperCase() || chat.groupName?.[0] || "?"}
              </div>

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
        <CreateGroupModal
          onClose={() => setShowModal(false)}
          onCreated={fetchChats}
        />
      )}
    </div>
  );
}
