import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/admin/dashboard");
      } else {
        setError("Wrong password.");
      }
    } catch (e) {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-shell">
      <Head>
        <title>Minnieshop — Owner login</title>
        <link rel="icon" href="/favicon.png" />
      </Head>
      <div className="login-card">
        <img src="/logo.jpg" alt="Minnieshop" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", boxShadow: "0 4px 16px rgba(183,156,240,0.35)", border: "2px solid #fff" }} />
        <h1 className="login-title">Minnieshop</h1>
        <div className="login-sub">Log in to manage your listings and orders.</div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button className="btn" type="submit" disabled={busy} style={{ justifyContent: "center" }}>
            {busy ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}
