"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/AuthContext";

export function AuthButton() {
  const { user, ready, login, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  if (!ready) return null;

  if (user) {
    return (
      <div className="auth-widget">
        <span className="auth-username">{user.username}</span>
        <button type="button" className="auth-button" onClick={logout}>
          Log out
        </button>
      </div>
    );
  }

  if (!showForm) {
    return (
      <button type="button" className="auth-button" onClick={() => setShowForm(true)}>
        Log in
      </button>
    );
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      await login(username, password);
      setShowForm(false);
      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <form className="auth-widget auth-form" onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" className="auth-button" disabled={pending}>
        {pending ? "..." : "Log in"}
      </button>
      <button type="button" className="auth-cancel" onClick={() => setShowForm(false)}>
        Cancel
      </button>
      {error && <div className="auth-error">{error}</div>}
    </form>
  );
}
