import { useState, useEffect } from "react";
import { supabase } from "./lib/supabaseClient";
import { randomColor } from "./state/store";
import { useTheme } from "./contexts/ThemeContext";

interface AuthProps {
  onAuthSuccess: (user: any, profile?: any) => void;
}


export default function Auth({ onAuthSuccess }: AuthProps) {
  const { colors } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [passwordUpdated, setPasswordUpdated] = useState(false);

  // Check if we're in password reset mode from Supabase auth event
  useEffect(() => {
    // Check both URL params and hash fragment (Supabase uses hash for tokens)
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    // Supabase includes "type=recovery" in the URL hash when redirecting from reset link
    const isRecoveryLink = hashParams.get('type') === 'recovery' || params.get('reset') === 'true';
    
    if (isRecoveryLink) {
      console.log('Password reset mode detected from URL');
      setIsResettingPassword(true);
    }

    // Listen for Supabase auth events (password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event - showing reset form');
        setIsResettingPassword(true);
        setError(""); // Clear any errors
      }
      
      // If session exists and we're in recovery mode, we're good to go
      if (event === 'SIGNED_IN' && isRecoveryLink) {
        console.log('Session established for password reset');
        setIsResettingPassword(true);
      }
    });

    // Also check if there's already an active session (user refreshed page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && isRecoveryLink) {
        console.log('Existing session found for password reset');
        setIsResettingPassword(true);
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

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

          // Login tracking no longer needed - canvas selector logic simplified
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

          // Login tracking no longer needed - canvas selector logic simplified
          onAuthSuccess(data.user, profile);
        }
      }
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResetSent(false);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/?reset=true&app=collabcanvas`,
      });

      if (error) throw error;

      setResetSent(true);
      setError("");
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setPasswordUpdated(false);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      // Check if we have an active session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Your reset link has expired or is invalid. Please request a new password reset.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setPasswordUpdated(true);
      setError("");
      
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-redirect to login after 3 seconds
      setTimeout(() => {
        setIsResettingPassword(false);
        setPasswordUpdated(false);
      }, 3000);
    } catch (error: any) {
      console.error('Password update error:', error);
      setError(error.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: colors.bgSecondary }}
    >
      <div 
        className="max-w-md w-full rounded-lg shadow-lg p-6 border"
        style={{ 
          backgroundColor: colors.bgPrimary,
          borderColor: colors.border 
        }}
      >
        <div className="text-center mb-6">
          <h1 
            className="text-3xl font-bold mb-2"
            style={{ color: colors.text }}
          >
            CollabCanvas
          </h1>
          <p style={{ color: colors.textSecondary }}>
            {isResettingPassword
              ? "Set your new password"
              : isForgotPassword 
              ? "Reset your password" 
              : isSignUp 
              ? "Create your account" 
              : "Sign in to your account"}
          </p>
        </div>

        {/* Password Reset Form (from email link) */}
        {isResettingPassword ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            {passwordUpdated ? (
              <div 
                className="text-sm p-4 rounded-md border"
                style={{ 
                  color: '#059669',
                  backgroundColor: colors.bgSecondary,
                  borderColor: '#6ee7b7'
                }}
              >
                <div className="font-medium mb-1">✅ Password Updated!</div>
                <div>Your password has been successfully reset. Redirecting to login...</div>
              </div>
            ) : (
              <>
                <div>
                  <label 
                    htmlFor="new-password" 
                    className="block text-sm font-medium mb-1"
                    style={{ color: colors.text }}
                  >
                    New Password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    placeholder="••••••••"
                  />
                </div>

                <div>
                  <label 
                    htmlFor="confirm-password" 
                    className="block text-sm font-medium mb-1"
                    style={{ color: colors.text }}
                  >
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    placeholder="••••••••"
                  />
                </div>

                {error && (
                  <div 
                    className="text-sm p-3 rounded-md border"
                    style={{ 
                      color: '#dc2626',
                      backgroundColor: colors.bgSecondary,
                      borderColor: '#fca5a5'
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50"
                  style={{
                    backgroundColor: loading ? colors.buttonBg : '#3b82f6',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </>
            )}
          </form>
        ) : isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            {resetSent ? (
              <div 
                className="text-sm p-4 rounded-md border"
                style={{ 
                  color: '#059669',
                  backgroundColor: colors.bgSecondary,
                  borderColor: '#6ee7b7'
                }}
              >
                <div className="font-medium mb-1">✅ Check your email!</div>
                <div>We've sent a password reset link to <strong>{email}</strong></div>
              </div>
            ) : (
              <>
                <div>
                  <label 
                    htmlFor="reset-email" 
                    className="block text-sm font-medium mb-1"
                    style={{ color: colors.text }}
                  >
                    Email Address
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                      color: colors.text
                    }}
                    placeholder="you@example.com"
                  />
                </div>

                {error && (
                  <div 
                    className="text-sm p-3 rounded-md border"
                    style={{ 
                      color: '#dc2626',
                      backgroundColor: colors.bgSecondary,
                      borderColor: '#fca5a5'
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50"
                  style={{
                    backgroundColor: loading ? colors.buttonBg : '#3b82f6',
                    color: 'white'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </>
            )}
          </form>
        ) : (
          /* Regular Login/Signup Form */
          <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && (
            <div>
              <label 
                htmlFor="displayName" 
                className="block text-sm font-medium mb-1"
                style={{ color: colors.text }}
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
                  color: colors.text
                }}
                placeholder="Your display name"
              />
            </div>
          )}

          <div>
            <label 
              htmlFor="email" 
              className="block text-sm font-medium mb-1"
              style={{ color: colors.text }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text
              }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label 
              htmlFor="password" 
              className="block text-sm font-medium mb-1"
              style={{ color: colors.text }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: colors.bgSecondary,
                borderColor: colors.border,
                color: colors.text
              }}
              placeholder="••••••••"
            />
            {!isSignUp && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setError("");
                  }}
                  className="text-sm transition-colors"
                  style={{ color: '#3b82f6' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#3b82f6';
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {error && (
            <div 
              className="text-sm p-3 rounded-md border"
              style={{ 
                color: '#dc2626',
                backgroundColor: colors.bgSecondary,
                borderColor: '#fca5a5'
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50"
            style={{
              backgroundColor: loading ? colors.buttonBg : '#3b82f6',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2563eb';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#3b82f6';
              }
            }}
          >
            {loading ? "Loading..." : (isSignUp ? "Sign Up" : "Sign In")}
          </button>
        </form>
        )}

        <div className="mt-6 text-center">
          {isForgotPassword ? (
            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setResetSent(false);
                setError("");
              }}
              className="text-sm font-medium transition-colors"
              style={{ color: '#3b82f6' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#3b82f6';
              }}
            >
              ← Back to Sign In
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm font-medium transition-colors"
              style={{ color: '#3b82f6' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#3b82f6';
              }}
            >
              {isSignUp 
                ? "Already have an account? Sign in" 
                : "Don't have an account? Sign up"
              }
            </button>
          )}
        </div>

        <div className="mt-4 text-xs text-center">
          <p style={{ color: colors.textSecondary }}>
            Secure authentication powered by Supabase
          </p>
        </div>
      </div>
    </div>
  );
}
