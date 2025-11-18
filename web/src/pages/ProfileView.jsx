import React from 'react'
import './ProfileView.css';
import { IoClose } from "react-icons/io5";

function ProfileView({selectedChat, onClose}) {
  return (
    <>
       <div className="profileDiv">
        <div className="crossImg" onClick={onClose}><IoClose value={{ className: 'xClose' }} size={32}  /></div>
        <div className="profileName">Profile</div>
        <div className="profileImg">
            <img
            src={
              selectedChat?.avatarUrl ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedChat?.name || selectedChat?.email)}&background=baf3db&color=fff`
            }
            className="profileAvatar"
            alt="User"
          />
        </div>
        <div className="Name">{selectedChat.name}</div>
       </div>
    </>
  )
}

export default ProfileView