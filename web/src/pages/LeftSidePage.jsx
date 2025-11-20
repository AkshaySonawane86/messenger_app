import React, { useState } from 'react';
import "./ChatPage.css";

function LeftSidePage({
  contacts,
  setSelectedChat,
  setReceiverIdentifier,
  receiverIdentifier,
  ensureChatExists
}) {


    const [search, setSearch] = useState("");

    const filteredGroups = contacts
    .filter((c) => c.isGroup)
    .filter((g) =>
      (g.name || "")
        .toString()
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );

  const filteredUsers = contacts
    .filter((c) => !c.isGroup)
    .filter((u) =>
      ((u.name || u.email) + "")
        .toLowerCase()
        .includes(search.trim().toLowerCase())
    );


    const select = (id) => {
    onChange(id);
    // setOpen(false);
    setSearch("");
  };
  return (
    <>
      <div className="chart">
        {/* SEARCH */}
          <div className="dropdown-search-box" style={{ padding: 8 }}>
            <input
              type="text"
              placeholder="🔍 Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e6e9ef",
                outline: "none",
              }}
            />
          </div>

          {filteredGroups.length > 0 && (
            <>
              
              {filteredGroups.map((g) => (
                <div
                  key={g._id}
                 
                  onClick={() =>{
                 setSelectedChat(g);
                 setReceiverIdentifier(g._id);
                 ensureChatExists();
                }}
                className="chartData"
            style={{
              backgroundColor:
                receiverIdentifier === g._id ? "#e6f9f0" : "transparent",
            }}
                >
                 <div className="chartImgdiv">
                  <img src={g.avatarUrl} className="user-avatar"  alt="" />
                 </div>

                 <div className="chartImgName">
                  {g.name}
               </div>
                  
                </div>
              ))}
            </>
          )}



       {filteredUsers.length > 0 && (
            <>
        {filteredUsers.map((chat) => (
          <div
            key={chat._id}
            onClick={() => {
              setSelectedChat(chat);
              setReceiverIdentifier(chat._id);
              ensureChatExists();
            }}
            className="chartData"
            style={{
              backgroundColor:
                receiverIdentifier === chat._id ? "#e6f9f0" : "transparent",
            }}
          >
            <div className="chartImgdiv">
              <img
                src={
                  chat?.avatarUrl ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                    chat?.name || chat?.email
                  )}&background=baf3db&color=fff`
                }
                className="user-avatar"
                alt="User"
              />
            </div>

            <div className="chartImgName">
              {chat.name || chat.email}
            </div>
          </div>
        ))}

        </>
          )}


          {filteredGroups.length === 0 &&
            filteredUsers.length === 0 &&
            search.trim() !== "" && (
              <div style={{ padding: 10, color: "#666" }}>No results found</div>
            )}
      </div>
    </>
  );
}

export default LeftSidePage;
