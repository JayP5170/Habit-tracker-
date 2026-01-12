import { Slot, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { supabase } from "../supabaseClient";
import LoadingScreen from "./LoadingScreen";

SplashScreen.preventAutoHideAsync(); // keep native splash visible

export const AuthContext = React.createContext({ session: null });
export const useAuth = () => React.useContext(AuthContext);

export default function RootLayout() {
  const [session, setSession] = useState(null);
  const [appReady, setAppReady] = useState(false);

  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    async function prepare() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);

      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, newSession) => setSession(newSession)
      );

      return () => authListener.subscription.unsubscribe();
    }

    prepare().then(() => {
      setAppReady(true); // JS ready
    });
  }, []);

  // Navigation logic
  useEffect(() => {
    if (!appReady) return;

    const inAuth = segments[0] === "Auth";

    if (!session && !inAuth) {
      router.replace("/Auth/SigninScreen");
    } else if (session && inAuth) {
      router.replace("/(tabs)/today");
    }

    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 200);
  }, [session, appReady, segments]);
  if (!appReady) {
    return <LoadingScreen />;
  }

  return (
    <AuthContext.Provider value={{ session }}>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </AuthContext.Provider>
  );
}
