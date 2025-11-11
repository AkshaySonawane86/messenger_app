

// src/pages/LoginPage.jsx

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "./LoginPage.css";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const nav = useNavigate();

  async function handleRequestOtp(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await api.post("/api/auth/request-otp", { email });
      if (res.data?.ok) {
        setMessage("OTP sent. Check your email.");
        nav("/verify", { state: { email } });
      } else {
        setMessage("Failed to send OTP.");
      }
    } catch (err) {
      setMessage(err?.response?.data?.error || "Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page center">
      <div className="login-card">
        <h2>Sign in</h2>
        <form onSubmit={handleRequestOtp}>
          <label>Email</label>
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
        {message && <p className="help">{message}</p>}
      </div>
    </div>
  );
}
