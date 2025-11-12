

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuthStore from "../store/useAuthStore";
import "./ProfileSettings.css";

export default function ProfileSettings() {
  const { user, token, setAuth } = useAuthStore();
  const [preview, setPreview] = useState(user?.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // ⚠️ client-side size check (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      alert("⚠️ File too large. Maximum allowed size is 10 MB.");
      return;
    }

    setPreview(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append("avatar", file);
    formData.append("userId", user._id);

    try {
      setUploading(true);
      const res = await api.post("/api/auth/upload-avatar", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data.ok) {
        const updatedUser = { ...user, avatarUrl: res.data.avatarUrl };
        setAuth(token, updatedUser);
        setUploaded(true);
        alert("✅ Profile picture updated successfully!");
      } else {
        alert("⚠️ Failed to update avatar. Try again.");
      }
    } catch (err) {
      console.error("❌ Upload error:", err);
      if (err?.response?.data?.error?.includes("File too large"))
        alert("⚠️ File too large (max 10 MB).");
      else alert("❌ Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="profile-settings">
      <h2 className="settings-title">Profile Settings</h2>

      <div className="avatar-section">
        <img
          src={
            preview ||
            user?.avatarUrl ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(
              user?.name || user?.email || "User"
            )}&background=2563eb&color=fff`
          }
          alt="avatar"
          className="avatar-preview"
        />

        <label className="upload-btn">
          {uploading ? "Uploading..." : "Change Avatar"}
          <input type="file" accept="image/*" hidden onChange={handleFileChange} />
        </label>
      </div>

      <div style={{ marginTop: "20px" }}>
        <button
          className="upload-btn"
          onClick={() => navigate("/chat")}
          disabled={uploading}
        >
          ← Back to Chat
        </button>
      </div>

      {uploaded && (
        <p style={{ color: "#16a34a", marginTop: "10px" }}>
          ✅ Avatar updated! Go back to see your new profile.
        </p>
      )}
    </div>
  );
}
