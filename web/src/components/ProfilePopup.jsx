
import { useEffect } from "react";
import "./ProfilePopup.css";

export default function ProfilePopup({ contact, onClose }) {
  useEffect(() => {
    const handleKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!contact) return null;

  return (
    <div className="profile-popup-overlay" onClick={onClose}>
      <div className="profile-popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="popup-avatar">
          <img
            src={
              contact.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                contact.name || contact.email || "User"
              )}&background=2563eb&color=fff`
            }
            alt="avatar"
          />
          <span
            style={{
              position: "absolute",
              bottom: "10px",
              right: "10px",
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: contact.online ? "#22c55e" : "#dc2626",
              border: "2px solid white",
            }}
          ></span>
        </div>

        <div className="popup-info">
          <h3>{contact.name || "User"}</h3>
          <p className="popup-email">{contact.email}</p>
          {!contact.online && contact.lastSeen && (
            <p className="popup-status">
              Last seen {new Date(contact.lastSeen).toLocaleString()}
            </p>
          )}
        </div>

        <p className="popup-note">ℹ️ You can only view this profile.</p>

        <button className="popup-close" onClick={onClose}>
          ✕
        </button>
      </div>
    </div>
  );
}
