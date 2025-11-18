// src/components/Chat/CreateGroupModal.jsx
import { useEffect, useState } from "react";
import api from "../services/api";
import "./CreateGroupModal.css";

export default function CreateGroupModal({ onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/api/auth/users");
        if (res.data?.ok) setUsers(res.data.users);
      } catch {
        console.warn("⚠️ Failed to load users");
      }
    })();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.length < 2) {
      alert("Group must have a name and at least 2 members.");
      return;
    }
    try {
      setLoading(true);
      const res = await api.post("/api/groups/create", {
        groupName: name,
        participants: selected,
      });
      if (res.data?.ok) {
        alert("✅ Group created!");
        onCreated?.();
        onClose();
      } else {
        alert("❌ Failed to create group");
      }
    } catch (err) {
      alert("⚠️ Error creating group");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3>Create New Group</h3>
        <input
          type="text"
          placeholder="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="user-list">
          {users.map((u) => (
            <label key={u._id} className="user-option">
              <input
                type="checkbox"
                checked={selected.includes(u._id)}
                onChange={() => toggleSelect(u._id)}
              />
              {u.name || u.email}
            </label>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
