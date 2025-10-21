import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const CORRECT_PASSWORD = "Dvoras123!";
const AUTH_KEY = "sdl_media_auth";

export default function Login({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate a brief delay for UX
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        localStorage.setItem(AUTH_KEY, "authenticated");
        toast.success("Welcome back!");
        onLogin();
      } else {
        toast.error("Incorrect password");
        setPassword("");
      }
      setIsLoading(false);
    }, 500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="glass-card p-8 rounded-2xl">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <img 
              src="/header-logo.png" 
              alt="SDL Media" 
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-center mb-2">Welcome Back</h1>
          <p className="text-gray-400 text-center mb-8">Enter your password to continue</p>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-white placeholder-gray-500"
                placeholder="Enter password"
                disabled={isLoading}
                autoFocus
              />
            </div>

            <Button
              type="submit"
              className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-semibold rounded-lg transition-colors"
              disabled={isLoading || !password}
            >
              {isLoading ? "Checking..." : "Login"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          SDL Media Live - Post Monitoring
        </p>
      </div>
    </div>
  );
}

export function checkAuth(): boolean {
  return localStorage.getItem(AUTH_KEY) === "authenticated";
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

