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
    // Check URL params first
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true') {
      setIsResettingPassword(true);
    }

    // Listen for Supabase auth events (password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Password recovery detected! Session established.');
        setIsResettingPassword(true);
        setError(""); // Clear any errors
      }
      
      // If session exists and we're in recovery mode, we're good to go
      if (event === 'SIGNED_IN' && params.get('reset') === 'true') {
        console.log('Session established for password reset');
        setIsResettingPassword(true);
      }
    });

    // Also check if there's already an active session (user refreshed page)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && params.get('reset') === 'true') {
        console.log('Existing session found for password reset');
        setIsResettingPassword(true);
      }
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleDemoLogin = async (demoUser: { email: string; name: string; color: string }) => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🎭 Attempting demo login for:', demoUser.email);
      
      // Test Supabase connectivity first
      try {
        const { data: testData, error: testError } = await supabase.from('canvases').select('count').limit(1);
        console.log('🔍 Supabase connectivity test:', { 
          connected: !testError, 
          error: testError?.message 
        });
      } catch (connError) {
        console.error('❌ Supabase connection failed:', connError);
      }
      
      // Clear localStorage to prevent conflicts
      localStorage.clear();
      
      // Create/sign in with a real Supabase account for demo users
      // This bypasses RLS policy issues by making them "real" users
      const demoPassword = 'demo123456'; // Simple password for demo accounts
      
      try {
        // First try to sign in (account might already exist)
        console.log('🔐 Attempting sign in for demo user:', demoUser.email);
        // Try to sign in with the individual demo user email
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: demoUser.email,
          password: demoPassword,
        });
        
        console.log('🔍 Demo sign in result:', { 
          user: signInData?.user?.id, 
          error: signInError?.message,
          email: demoUser.email 
        });

        if (signInError && (signInError.message.includes('Invalid login credentials') || 
                         signInError.message.includes('Email not confirmed'))) {
          console.log('🆕 Demo account not found, creating new one...');
          
          // Account doesn't exist, create it
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: demoUser.email,
            password: demoPassword,
            options: {
              data: {
                display_name: demoUser.name,
                avatar_color: demoUser.color,
                is_demo: true
              }
            }
          });

          if (signUpError) {
            console.error('❌ Demo account creation failed:', signUpError);
            throw signUpError;
          }

          console.log('✅ Demo account created successfully');
          
          // For demo accounts, we can proceed immediately (skip email confirmation)
          if (signUpData.user) {
            // Create profile manually
            const profile = {
              id: signUpData.user.id,
              email: demoUser.email,
              display_name: demoUser.name,
              avatar_color: demoUser.color,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            // Login tracking no longer needed - canvas selector logic simplified
          onAuthSuccess(signUpData.user, profile);
          }
        } else if (signInError) {
          console.error('❌ Demo sign in failed:', signInError);
          throw signInError;
        } else {
          console.log('✅ Demo user signed in successfully');
          
          // Demo user signed in successfully
          
          // Get the user profile
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', signInData.user.id)
            .single();

          const finalProfile = profile || {
            id: signInData.user.id,
            email: demoUser.email,
            display_name: demoUser.name,
            avatar_color: demoUser.color,
            is_demo: true,
            is_verified: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          // Login tracking no longer needed - canvas selector logic simplified
        onAuthSuccess(signInData.user, finalProfile);
        }
      } catch (authError) {
        console.error('❌ Demo authentication failed:', authError);
        throw authError;
      }
      
    } catch (err) {
      console.error('❌ Demo login error:', err);
      setError(err instanceof Error ? err.message : 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  // With email verification disabled, we can use individual demo emails again
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

        {/* Demo Login Section - Hide in forgot password and reset mode */}
        {!isForgotPassword && !isResettingPassword && (
          <div className="mb-6">
            <h3 
              className="text-sm font-medium mb-3"
              style={{ color: colors.text }}
            >
              🚀 Quick Demo
            </h3>
          
          
          <div className="grid gap-2">
            {demoUsers.map((user) => (
              <button
                key={user.email}
                onClick={() => handleDemoLogin(user)}
                disabled={loading}
                className="flex items-center justify-between p-3 border rounded-md transition-colors disabled:opacity-50"
                style={{
                  borderColor: colors.border,
                  backgroundColor: colors.bgSecondary
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.buttonHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = colors.bgSecondary;
                }}
              >
                <div className="flex items-center space-x-3">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: user.color }}
                  ></div>
                  <div>
                    <div 
                      className="text-sm font-medium"
                      style={{ color: colors.text }}
                    >
                      {user.name}
                    </div>
                    <div 
                      className="text-xs"
                      style={{ color: colors.textSecondary }}
                    >
                      {user.email} • demo123456
                    </div>
                  </div>
                </div>
                <span 
                  className="text-xs px-2 py-1 rounded"
                  style={{ 
                    color: colors.primary,
                    backgroundColor: colors.bgTertiary
                  }}
                >
                  Sign In
                </span>
              </button>
            ))}
          </div>
          <p 
            className="text-xs mt-2"
            style={{ color: colors.textSecondary }}
          >
            💡 Demo accounts are real Supabase accounts with shared credentials
          </p>
        </div>
        )}

        {!isForgotPassword && !isResettingPassword && (
          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div 
                className="w-full border-t" 
                style={{ borderColor: colors.border }}
              />
            </div>
            <div className="relative flex justify-center text-sm">
              <span 
                className="px-2"
                style={{ 
                  backgroundColor: colors.bgPrimary, 
                  color: colors.textSecondary 
                }}
              >
                Or sign in with your account
              </span>
            </div>
          </div>
        )}

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
