import { useEffect, useState } from "react";
import Canvas from "./Canvas";
import Auth from "./Auth";
import { supabase } from "./lib/supabaseClient";
import { useCanvas } from "./state/store";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  useEffect(() => {
    // Check for demo user first
    const checkDemoUser = () => {
      const demoUser = localStorage.getItem('demo-user');
      if (demoUser) {
        try {
          const demoProfile = JSON.parse(demoUser);
          console.log('Demo user found:', demoProfile.display_name);
          setUserProfile(demoProfile);
          setUser({ id: demoProfile.id }); // Set a basic user object
          useCanvas.getState().setUser({
            id: demoProfile.id,
            name: demoProfile.display_name,
            color: demoProfile.avatar_color
          });
          useCanvas.getState().setAuthenticated(true);
          setLoading(false);
          return true; // Demo user found
        } catch (error) {
          console.error('Error parsing demo user:', error);
          localStorage.removeItem('demo-user');
        }
      }
      return false; // No demo user
    };

    // Check for existing session
    const checkSession = async () => {
      try {
        // First check for demo user
        if (checkDemoUser()) {
          return; // Demo user found, skip Supabase auth
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user && !error) {
          console.log('Found existing session:', session.user.email);
          await handleAuthSuccess(session.user, null);
        } else {
          console.log('No existing session found');
          setLoading(false);
        }
      } catch (error) {
        console.error('Session check failed:', error);
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.email);
        
        if (event === 'SIGNED_IN' && session?.user) {
          await handleAuthSuccess(session.user, null);
        } else if (event === 'SIGNED_OUT') {
          console.log('Auth state: SIGNED_OUT detected');
          
          // Don't interfere if this is a demo user session
          const demoUser = localStorage.getItem('demo-user');
          if (demoUser) {
            console.log('Demo user detected during SIGNED_OUT, ignoring Supabase auth event');
            return;
          }
          
          setUser(null);
          setUserProfile(null);
          useCanvas.getState().setUser({ id: '', name: '', color: '#666' });
          useCanvas.getState().setAuthenticated(false);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('Token refreshed for:', session.user.email);
          await handleAuthSuccess(session.user, null);
        } else if (!session) {
          // No session, stop loading
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = async (authUser: any, providedProfile: any = null) => {
    try {
      console.log('🎯 handleAuthSuccess called!');
      console.log('👤 authUser:', authUser?.email || 'null (demo mode)');
      console.log('📋 providedProfile:', providedProfile);
      console.log('🏗️ Setting user...');
      setUser(authUser);
      
      // If we have a provided profile (demo mode or signup), use it directly
      if (providedProfile) {
        console.log('📦 Using provided profile for demo/signup');
        console.log('📦 Profile data:', providedProfile);
        console.log('🔧 Setting user profile...');
        setUserProfile(providedProfile);
        
        // Update the canvas store with user info
        useCanvas.setState((s) => {
          s.me.id = providedProfile.id;
          s.me.name = providedProfile.display_name;
          s.me.color = providedProfile.avatar_color;
          s.isAuthenticated = true;
        });

        console.log('🎮 Canvas state updated for demo user');
        console.log('⏹️ Setting loading to false...');
        setLoading(false);
        console.log('✅ Demo auth success completed!');
        return;
      }
      
      // Get user profile from database if not provided
      let profile = providedProfile;
      if (!profile && authUser) {
        console.log('Fetching user profile...');
        
        try {
          // Add timeout protection to prevent hanging
          const profilePromise = supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
            
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => {
              console.log('Profile fetch timeout triggered');
              reject(new Error('Profile fetch timeout'));
            }, 5000)
          );
          
          console.log('Starting profile fetch with timeout...');
          const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
          console.log('Profile fetch completed:', { data, error });
          
          if (error) {
            console.warn('Profile fetch error (will create fallback):', error);
            
            // Check if this is a table doesn't exist error
            if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
              console.error('🚨 DATABASE SETUP REQUIRED! The user_profiles table does not exist.');
              console.log('📋 Please run this SQL in your Supabase SQL Editor:');
              console.log('https://supabase.com/dashboard → SQL Editor → paste supabase.sql contents');
            }
            
            // Try to create profile in database
            const fallbackProfile = {
              id: authUser.id,
              display_name: authUser.email?.split('@')[0] || 'User',
              avatar_color: '#3b82f6'
            };
            
            console.log('Attempting to create profile:', fallbackProfile);
            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert([fallbackProfile]);
              
            if (insertError) {
              console.warn('Failed to create profile in DB, using memory only:', insertError);
            } else {
              console.log('Successfully created profile in database');
            }
            
            profile = fallbackProfile;
          } else {
            profile = data;
            console.log('Successfully fetched profile:', profile);
          }
        } catch (err) {
          console.error('Profile fetch failed with timeout/error:', err);
          // Create fallback profile
          profile = {
            id: authUser.id,
            display_name: authUser.email?.split('@')[0] || 'User',
            avatar_color: '#3b82f6'
          };
          console.log('Using fallback profile:', profile);
        }
      }

      console.log('Using profile:', profile);
      setUserProfile(profile);
      
      // Update the canvas store with authenticated user info
      useCanvas.setState((s) => {
        s.me.id = authUser.id;
        s.me.name = profile.display_name;
        s.me.color = profile.avatar_color;
        s.isAuthenticated = true;
      });

      setLoading(false);
    } catch (error) {
      console.error('❌ Auth success handler failed:', error);
      console.log('⏹️ Error: Setting loading to false...');
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('Signing out...');
      
      // Clear demo user if it exists
      localStorage.removeItem('demo-user');
      
      // Sign out from Supabase (safe for demo users)
      await supabase.auth.signOut();
      
      // Reset canvas state
      const canvasState = useCanvas.getState();
      canvasState.setUser({ id: '', name: '', color: '#666' });
      canvasState.setAuthenticated(false);
      
      // Clear React state
      setUser(null);
      setUserProfile(null);
      setLoading(false); // Ensure we're not stuck in loading state
      
      console.log('Sign out complete');
    } catch (error) {
      console.error('Error signing out:', error);
      
      // Force clear state even if sign out fails
      localStorage.removeItem('demo-user');
      setUser(null);
      setUserProfile(null);
      setLoading(false);
      
      const canvasState = useCanvas.getState();
      canvasState.setUser({ id: '', name: '', color: '#666' });
      canvasState.setAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen grid place-items-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading CollabCanvas...</p>
        </div>
      </div>
    );
  }

  // Show Auth if no userProfile, or if no user AND no demo user in localStorage
  const hasDemoUser = localStorage.getItem('demo-user');
  if (!userProfile || (!user && !hasDemoUser)) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return <Canvas onSignOut={handleSignOut} />;
}
