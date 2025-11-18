import React, { useState } from 'react';
import './ProfileView.css';
import { IoClose } from "react-icons/io5";
// import useAuthStore from "../store/useAuthStore";

function ProfileView({ selectedChat, onClose }) {
  const [preview, setPreview] = useState(selectedChat?.avatarUrl || "");
  // const { token, setAuth } = useAuthStore();

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
    formData.append("userId", selectedChat._id);

    try {
      const res = await api.post("/api/auth/upload-avatar", formData );

      if (res.data.ok) {
        // const updatedUser = { ...selectedChat, avatarUrl: res.data.avatarUrl };
        // setAuth(token, updatedUser);
        alert("✅ Profile picture updated successfully!");
      } else {
        alert("⚠️ Failed to update avatar. Try again.");
      }
    } catch (err) {
      console.error("❌ Upload error:", err);
      if (err?.response?.data?.error?.includes("File too large"))
        alert("⚠️ File too large (max 10 MB).");
      else alert("❌ Upload failed. Please try again.");
}
  };

  return (
    <>
      <div className="profileDiv">
        <div className="crossImg" onClick={onClose}>
          <IoClose size={32} />
        </div>

        <div className="profileName">Profile</div>

        <div className="profileImg">
          <label>
            <img
              src={
                preview ||
                selectedChat?.avatarUrl ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  selectedChat?.name || selectedChat?.email || "User"
                )}&background=baf3db&color=fff`
              }
              className="profileAvatar"
              alt="User"
              style={{ cursor: "pointer" }}
            />

            {/* Hidden File Input */}
            <input type="file" accept="image/*" hidden onChange={handleFileChange} />
          </label>
        </div>

       

        <div className="Name">{selectedChat?.name}</div>
        
      </div>
    </>
  );
}

export default ProfileView;
