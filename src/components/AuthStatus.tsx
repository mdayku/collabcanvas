import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useTheme } from '../contexts/ThemeContext';

export function AuthStatus() {
  const [authInfo, setAuthInfo] = useState<{
    hasUser: boolean;
    hasSession: boolean;
    userId?: string;
    error?: string;
    isDemo?: boolean;
  } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // Check if this is a demo user (real Supabase user but marked as demo)
      const isDemo = user?.user_metadata?.is_demo || 
                     user?.email?.includes('@collabcanvas.com') ||
                     session?.user?.user_metadata?.is_demo ||
                     session?.user?.email?.includes('@collabcanvas.com');
      
      console.log('🔍 AuthStatus check:', {
        hasUser: !!user,
        hasSession: !!session?.user,
        isDemo,
        userEmail: user?.email,
        authError: authError?.message,
        sessionError: sessionError?.message
      });
      
      const info = {
        hasUser: !!user,
        hasSession: !!session?.user,
        userId: user?.id || session?.user?.id,
        error: authError?.message || sessionError?.message,
        isDemo: !!isDemo
      };
      
      setAuthInfo(info);
      
      // Only show auth errors for actual auth failures, not demo users
      if (!info.hasUser && !info.hasSession && !info.isDemo) {
        console.log('❌ AuthStatus: Showing auth error for non-demo user');
        setIsVisible(true);
      } else if (!info.hasUser && !info.hasSession && info.isDemo) {
        console.log('⚠️ AuthStatus: Demo user has auth issues, checking again in 2 seconds...');
        // For demo users, wait a bit and recheck
        setTimeout(async () => {
          const recheckResult = await supabase.auth.getUser();
          if (!recheckResult.data.user) {
            console.log('❌ AuthStatus: Demo user still has auth issues after recheck');
            setIsVisible(true);
          } else {
            console.log('✅ AuthStatus: Demo user auth resolved after recheck');
          }
        }, 2000);
      } else {
        console.log('✅ AuthStatus: User authenticated successfully');
        setIsVisible(false);
      }
      
    } catch (error) {
      console.error('Auth status check failed:', error);
      setAuthInfo({
        hasUser: false,
        hasSession: false,
        error: 'Failed to check authentication status',
        isDemo: false
      });
      setIsVisible(true);
    }
  };

  const handleRefreshAuth = async () => {
    await checkAuthStatus();
    if (authInfo?.hasUser || authInfo?.hasSession) {
      setIsVisible(false);
    }
  };

  const handleSignIn = async () => {
    try {
      console.log('🔐 AuthStatus: Signing out and redirecting to login...');
      
      // Hide the auth status popup first
      setIsVisible(false);
      
      // Sign out to clear any existing auth state
      await supabase.auth.signOut();
      
      // Clear local storage to ensure clean state
      localStorage.clear();
      
      // For all users, redirect to root which should show the login screen
      // This matches what the main sign-out button does
      window.location.href = window.location.origin;
      
    } catch (error) {
      console.error('Sign out failed:', error);
      // Fallback: just reload the page to get back to login
      window.location.reload();
    }
  };

  if (!isVisible || !authInfo) {
    return null;
  }

  return (
    <div 
      className="fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg border shadow-lg"
      style={{
        backgroundColor: colors.bgSecondary,
        borderColor: colors.border
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
            <h3 
              className="font-semibold text-sm"
              style={{ color: colors.text }}
            >
              Authentication Issue
            </h3>
          </div>
          
          <div 
            className="text-sm mb-3"
            style={{ color: colors.textSecondary }}
          >
            {!authInfo.hasUser && !authInfo.hasSession ? (
              <>
                <p>You are not signed in. This may cause issues with:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Saving canvases</li>
                  <li>Loading your canvases</li>
                  <li>Creating new canvases</li>
                </ul>
              </>
            ) : (
              <p>Authentication session may be expired.</p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleRefreshAuth}
              className="px-3 py-1 text-xs rounded transition-colors"
              style={{
                backgroundColor: colors.buttonBg,
                color: colors.text,
                border: `1px solid ${colors.border}`
              }}
            >
              Refresh
            </button>
            <button
              onClick={handleSignIn}
              className="px-3 py-1 text-xs rounded transition-colors bg-blue-600 text-white hover:bg-blue-700"
            >
              {authInfo?.isDemo ? 'Restart Demo' : 'Sign In Again'}
            </button>
          </div>
        </div>

        <button
          onClick={() => setIsVisible(false)}
          className="ml-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
          style={{ color: colors.textSecondary }}
        >
          ×
        </button>
      </div>

      {/* Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && (
        <details className="mt-3 text-xs">
          <summary 
            className="cursor-pointer"
            style={{ color: colors.textMuted }}
          >
            Debug Info
          </summary>
          <pre 
            className="mt-2 p-2 rounded text-xs overflow-auto"
            style={{ 
              backgroundColor: colors.bg,
              color: colors.textMuted 
            }}
          >
            {JSON.stringify(authInfo, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
