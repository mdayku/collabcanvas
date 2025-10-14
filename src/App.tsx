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
    // Check for existing session
    const checkSession = async () => {
      try {
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
      console.log('Handling auth success for:', authUser.email);
      setUser(authUser);
      
      // Get user profile from database if not provided
      let profile = providedProfile;
      if (!profile) {
        console.log('Fetching user profile...');
        
        try {
          // Add timeout protection to prevent hanging
          const profilePromise = supabase
            .from('user_profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
            
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
          );
          
          const { data, error } = await Promise.race([profilePromise, timeoutPromise]) as any;
          
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
      console.error('Auth success handler failed:', error);
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
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

  if (!user || !userProfile) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  return <Canvas onSignOut={handleSignOut} />;
}
