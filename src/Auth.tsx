import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { randomColor } from "./state/store";

interface AuthProps {
  onAuthSuccess: (user: any, profile?: any) => void;
}

export default function Auth({ onAuthSuccess }: AuthProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleDemoLogin = async (demoUser: { email: string; name: string; color: string }) => {
    try {
      setLoading(true);
      setError('');
      
      // Create a demo user profile directly
      const demoProfile = {
        id: `demo-${demoUser.email.split('@')[0]}`,
        email: demoUser.email,
        display_name: demoUser.name,
        avatar_color: demoUser.color,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Store demo user in localStorage to persist the session
      localStorage.setItem('demo-user', JSON.stringify(demoProfile));
      
      // Call onAuthSuccess with the demo profile - pass null as user since it's demo mode
      onAuthSuccess(null, demoProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoUsers = [
    { email: 'demo1@collabcanvas.com', name: 'Demo User 1', color: '#3b82f6' }, // Blue
    { email: 'demo2@collabcanvas.com', name: 'Demo User 2', color: '#ef4444' }, // Red  
    { email: 'demo3@collabcanvas.com', name: 'Demo User 3', color: '#10b981' }, // Green
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        // Sign up new user
        const avatarColor = randomColor();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName || "User",
              avatar_color: avatarColor,
            }
          }
        });

        if (error) throw error;

        if (data.user) {
          // Get the user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          onAuthSuccess(data.user, profile || {
            id: data.user.id,
            display_name: displayName || "User",
            avatar_color: avatarColor
          });
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Get the user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          onAuthSuccess(data.user, profile);
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">CollabCanvas</h1>
          <p className="text-gray-600">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </p>
        </div>

        {/* Demo Login Section */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">🚀 Quick Demo (No signup required)</h3>
          <div className="grid gap-2">
            {demoUsers.map((user) => (
              <button
                key={user.email}
                onClick={() => handleDemoLogin(user)}
                disabled={loading}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: user.color }}
                  ></div>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                </div>
                <span className="text-xs text-gray-500">Click to join</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            💡 Open multiple browser tabs/windows to test multiplayer features
          </p>
        </div>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">Or sign in with your account</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Your display name"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
          >
            {loading ? "Loading..." : (isSignUp ? "Sign Up" : "Sign In")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {isSignUp 
              ? "Already have an account? Sign in" 
              : "Don't have an account? Sign up"
            }
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p>Secure authentication powered by Supabase</p>
        </div>
      </div>
    </div>
  );
}
