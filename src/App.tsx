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
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.user && !error) {
        await handleAuthSuccess(session.user, null, false);
      } else {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          await handleAuthSuccess(session.user, null, false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
          useCanvas.getState().setUser({ id: '', name: '', color: '#666' });
          useCanvas.getState().setAuthenticated(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleAuthSuccess = async (authUser: any, providedProfile: any = null, isNewAuth: boolean = true) => {
    setUser(authUser);
    
    // Get user profile from database if not provided
    let profile = providedProfile;
    if (!profile) {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();
      profile = data;
    }

    if (profile) {
      setUserProfile(profile);
      
      // Update the canvas store with authenticated user info
      useCanvas.setState((s) => {
        s.me.id = authUser.id;
        s.me.name = profile.display_name;
        s.me.color = profile.avatar_color;
        s.isAuthenticated = true;
      });
    }

    if (isNewAuth) {
      setLoading(false);
    } else {
      // For existing sessions, add a small delay to avoid flash
      setTimeout(() => setLoading(false), 100);
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
