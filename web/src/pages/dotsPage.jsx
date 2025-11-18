import React, { useState } from 'react'
import './dotsPage.css';
import CreateGroupModal from "../Dashboard/CreateGroupModal";

function dotsPage() {
    const [showCreateGroup, setShowCreateGroup] = useState(false);
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
    </>
  )
}

export default dotsPage