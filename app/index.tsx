import { Redirect } from "expo-router";
import { useAuth } from "./_layout";

export default function Index() {
  const { session } = useAuth();
  
  // Redirect to appropriate screen based on auth state
  if (session) {
    return <Redirect href="/(tabs)/today" />;
  }
  
  return <Redirect href="/Auth/SigninScreen" />;
}