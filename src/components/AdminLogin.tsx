import React, { useState } from "react";
import { Lock, Mail, Loader2, AlertCircle, ShieldAlert } from "lucide-react";

interface AdminLoginProps {
  onLoginSuccess: (token: string, admin: { email: string; role: string }) => void;
  collegeName: string;
}

export default function AdminLogin({ onLoginSuccess, collegeName }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError("Please enter the secure administrative password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/public/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Administrative authentication failed.");
      }

      onLoginSuccess(data.token, data.admin);
    } catch (err: any) {
      console.error("Login submission error:", err);
      setError(err.message || "An unexpected error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-neutral-50 min-h-[calc(100vh-4rem)] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" id="login-view">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        
        {/* Pragjyotish College Official Logo */}
        <div className="mx-auto w-24 h-24 mb-4 flex items-center justify-center">
          <img 
            src="/college_logo.jpg" 
            alt="Pragjyotish College Logo" 
            className="w-full h-full object-contain rounded-full shadow-md border border-neutral-100"
            referrerPolicy="no-referrer"
          />
        </div>

        <h2 className="text-2xl font-black text-neutral-900 tracking-tight uppercase">
          BCA Admin
        </h2>
        <p className="mt-1.5 text-xs text-neutral-500 font-bold uppercase tracking-wider">
          Pragjyotish College Student Registry
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl rounded-2xl border border-neutral-100 sm:px-10">
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-lg flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <span className="leading-normal font-medium">{error}</span>
              </div>
            )}

            {/* Password field */}
            <div>
              <label htmlFor="password" className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-400 mb-1.5">
                Administrative Password
              </label>
              <div className="relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-neutral-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2.5 border border-neutral-200 rounded-lg text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                id="login-submit-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Secure Key...</span>
                  </span>
                ) : (
                  <span>Access Dashboard</span>
                )}
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  );
}
