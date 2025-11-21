

import EmojiPicker from "emoji-picker-react";
import { useEffect, useRef, useState } from "react";
import api from "../services/api";
import useAuthStore from "../store/useAuthStore";
import "./GroupSettingsModal.css";

export default function GroupSettingsModal({ groupId, onClose }) {
  const { user } = useAuthStore();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [description, setDescription] = useState("");
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [showNameEmojiPicker, setShowNameEmojiPicker] = useState(false);
  const [showDescEmojiPicker, setShowDescEmojiPicker] = useState(false);

  const nameEmojiRef = useRef(null);
  const descEmojiRef = useRef(null);

  const isAdmin = group && String(group.groupAdmin?._id) === String(user._id);

  /* -------------------- Fetch Group Info -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/api/groups/${groupId}`);
        if (res.data?.ok) {
          setGroup(res.data.group);
          setNewName(res.data.group.groupName);
          setDescription(res.data.group.groupDescription || "");
        }
      } catch {
        alert("Failed to load group info");
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  /* -------------------- Load Available Users -------------------- */
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await api.get("/api/auth/users");
        if (res.data?.ok || res.data?.users) {
          const users = res.data.users || res.data.data || [];
          const filtered = users.filter(
            (u) => !group?.participants?.some((p) => p._id === u._id)
          );
          setAvailableUsers(filtered);
        }
      } catch {
        console.warn("Could not load available users");
      }
    })();
  }, [isAdmin, group]);

  /* -------------------- Click Outside Emoji Picker -------------------- */
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        nameEmojiRef.current &&
        !nameEmojiRef.current.contains(e.target)
      ) {
        setShowNameEmojiPicker(false);
      }
      if (
        descEmojiRef.current &&
        !descEmojiRef.current.contains(e.target)
      ) {
        setShowDescEmojiPicker(false);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (loading) return <div className="modal-backdrop">Loading...</div>;
  if (!group) return null;

  /* -------------------- Rename Group -------------------- */
  const handleRenameSave = async () => {
    if (!newName.trim()) return;
    await api.put("/api/groups/rename", { groupId, name: newName });
    alert("✅ Group name updated");
    setIsRenaming(false);
  };

  /* -------------------- Update Description -------------------- */
  const handleDescriptionSave = async () => {
    await api.put("/api/groups/rename", { groupId, description });
    alert("✅ Description updated");
  };

  /* -------------------- Leave Group -------------------- */
  const handleLeave = async () => {
    if (isAdmin) {
      alert("❌ Admin cannot leave the group");
      return;
    }
    if (!window.confirm("Leave this group?")) return;
    await api.delete("/api/groups/leave", { data: { groupId } });
    alert("You left the group");
    onClose();
  };

  /* -------------------- Add Member (Admin Only) -------------------- */
  const handleAddMember = async () => {
    if (!selectedUser) return;
    try {
      const res = await api.put("/api/groups/add", {
        groupId,
        userId: selectedUser,
        requesterId: user._id,
      });
      if (res.data?.ok) {
        alert("✅ Member added");
        setGroup(res.data.group);
        setSelectedUser(null);
      }
    } catch {
      alert("Failed to add member");
    }
  };

  /* -------------------- Remove Member (Admin Only) -------------------- */
  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      const res = await api.put("/api/groups/remove", {
        groupId,
        userId: memberId,
        requesterId: user._id,
      });
      if (res.data?.ok) {
        alert("✅ Member removed");
        setGroup(res.data.group);
      }
    } catch {
      alert("Failed to remove member");
    }
  };

  /* -------------------- Upload Group Avatar -------------------- */
  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("avatar", file);
    try {
      const res = await api.put(`/api/groups/avatar/${groupId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.ok) {
        // show uploaded image instantly
        const newUrl = URL.createObjectURL(file);
        setGroup((prev) => ({ ...prev, groupAvatar: newUrl }));
      }
    } catch {
      alert("❌ Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-card scrollable-modal">
        <h3>Group Info</h3>

        {/* Group Avatar Section */}
        <div className="group-avatar-container">
          <img
            src={
              group.groupAvatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                group.groupName
              )}`
            }
            className="group-avatar"
            alt="Group"
          />
          {isAdmin && (
            <label className="change-avatar-btn">
              📷 Change
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarUpload}
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {/* Group Name */}
        <div className="input-with-emoji">
          <input
            type="text"
            value={newName}
            readOnly={!isRenaming}
            onChange={(e) => setNewName(e.target.value)}
          />
          {isRenaming && (
            <button
              type="button"
              className="emoji-btn"
              onClick={() =>
                setShowNameEmojiPicker((prev) => !prev)
              }
            >
              😀
            </button>
          )}
          {showNameEmojiPicker && (
            <div
              className="emoji-picker"
              ref={nameEmojiRef}
            >
              <EmojiPicker
                onEmojiClick={(e) =>
                  setNewName((prev) => prev + e.emoji)
                }
              />
            </div>
          )}
        </div>

        {isAdmin && (
          <>
            {!isRenaming ? (
              <button
                onClick={() => setIsRenaming(true)}
                className="btn-primary"
              >
                ✏️ Rename Group
              </button>
            ) : (
              <button
                onClick={handleRenameSave}
                className="btn-primary"
              >
                💾 Save Name
              </button>
            )}
          </>
        )}

        {/* Group Description */}
        <div className="description-section">
          <div className="textarea-with-emoji">
            <textarea
              placeholder="Add group description..."
              value={description}
              disabled={!isAdmin}
              onChange={(e) => setDescription(e.target.value)}
            />
            {isAdmin && (
              <button
                type="button"
                className="emoji-btn"
                onClick={() =>
                  setShowDescEmojiPicker((prev) => !prev)
                }
              >
                😀
              </button>
            )}
            {showDescEmojiPicker && (
              <div
                className="emoji-picker"
                ref={descEmojiRef}
              >
                <EmojiPicker
                  onEmojiClick={(e) =>
                    setDescription((prev) => prev + e.emoji)
                  }
                />
              </div>
            )}
          </div>
          {isAdmin && (
            <button onClick={handleDescriptionSave} className="btn-primary">
              💾 Save Description
            </button>
          )}
        </div>

        {/* Members */}
        <h4>
          Members ({group.participants.length}){" "}
          <span className="admin-tag">
            Admin: {group.groupAdmin?.name || "N/A"}
          </span>
        </h4>
        <ul className="member-list">
          {group.participants.map((m) => (
            <li key={m._id} className="member-item">
              <img
                src={
                  m.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    m.name || "User"
                  )}`
                }
                alt={m.name}
                className="member-avatar"
              />
              <span>
                {m.name || m.email}{" "}
                {String(m._id) === String(group.groupAdmin?._id) && (
                  <span className="admin-tag">(Admin)</span>
                )}
              </span>
              {isAdmin &&
                String(m._id) !== String(group.groupAdmin?._id) && (
                  <button
                    className="remove-btn"
                    onClick={() => handleRemoveMember(m._id)}
                  >
                    ✖
                  </button>
                )}
            </li>
          ))}
        </ul>

        {/* Add Member */}
        {isAdmin && (
          <div className="add-member-section">
            <select
              value={selectedUser || ""}
              onChange={(e) => setSelectedUser(e.target.value)}
            >
              <option value="">-- Select user to add --</option>
              {availableUsers.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.email}
                </option>
              ))}
            </select>
            <button onClick={handleAddMember} className="btn-primary">
              ➕ Add
            </button>
          </div>
        )}

        <button className="btn-danger" onClick={handleLeave}>
          🚪 Leave Group
        </button>
        <button className="btn-close" onClick={onClose}>
          ✖
        </button>
      </div>
    </div>
  );
}
