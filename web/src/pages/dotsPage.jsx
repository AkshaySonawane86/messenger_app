import React, { useEffect, useState } from 'react'
import './dotsPage.css';
import CreateGroupModal from "../Dashboard/CreateGroupModal";
import api from "../services/api";

function dotsPage({receiverIdentifier,user}) {
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [showGroupSettings, setShowGroupSettings] = useState(false);

    const [contacts, setContacts] = useState([]);

    // derived selectedContact
  const selectedContact = contacts.find(
    (c) => String(c._id) === String(receiverIdentifier)
  );

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
  return (
    <>
    <div className="dotsDiv">
        <div className="profile">
            Profile
        </div>
        <div className="groupChat" onClick={() => setShowCreateGroup(true)}>
            ➕ Create Group
        </div>
         <div className="logout">
            Logout
         </div>
    </div>
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
    </>
  )
}

export default dotsPage