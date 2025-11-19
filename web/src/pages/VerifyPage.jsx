
 // src/pages/VerifyPage.jsx
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../services/api";
import useAuthStore from "../store/useAuthStore";
import "./VerifyPage.css";

export default function VerifyPage() {
  const loc = useLocation();
  const nav = useNavigate();
  const initialEmail = loc.state?.email || "";
  const [email] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const setAuth = useAuthStore((s) => s.setAuth);

  async function handleVerify(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/api/auth/verify-otp", { email, code });
      if (res.data?.ok && res.data.token) {
        // ✅ Store token & user
        setAuth(res.data.token, res.data.user);

        // ✅ clear old chat session so dropdown shows
        localStorage.removeItem("lastChatId");
        localStorage.removeItem("lastReceiverId");

        nav("/chat");
      } else {
        setErr("Verification failed");
      }
    } catch (error) {
      setErr(error?.response?.data?.error || "Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page center">
      <div className="verify-card">
        <h2>Enter OTP</h2>
        <p>
          We sent a code to <b>{email}</b>
        </p>
        <form onSubmit={handleVerify}>
          <label>OTP Code</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <button disabled={loading}>
            {loading ? "Verifying..." : "Verify & Sign In"}
          </button>
        </form>
        {err && <p className="help error">{err}</p>}
      </div>
    </div>
  );
}
