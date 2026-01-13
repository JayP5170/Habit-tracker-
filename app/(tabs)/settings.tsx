import { LinearGradient as ExpoLinearGradient, LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function Settings() {
  const { session } = useAuth();

  const insets = useSafeAreaInsets();
  const [name, setName] = React.useState("");
  const [initial, setInitial] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .maybeSingle();
      if (data) {
        setName(data.display_name ?? "");
        setInitial(true);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      await supabase.from("profiles").upsert({
        id: session?.user.id,
        display_name: name,
        email: session?.user.email,
      });
      Alert.alert("Profile updated successfully!");
    } catch (e) {
      Alert.alert("Error", "Failed to save changes.");
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Error", "Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) Alert.alert("Error", error.message);
    else {
      setNewPassword("");
      setConfirmPassword("");
      Alert.alert("Password changed successfully!");
    }
  };

  if (!initial)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );

  return (
    <LinearGradient
      colors={["#FDEFF9", "#E0C3FC", "#C2E9FB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        {/* Gradient Header */}
        <ExpoLinearGradient
          colors={["#6366F1", "#8B5CF6"]}
          style={{
            padding: 17,
            alignItems: "center",
            justifyContent: "center",
            borderBottomLeftRadius: 10,
            borderBottomRightRadius: 10,
          }}
        >
          <Text style={{ fontSize: 28, fontWeight: "700", color: "white" }}>
            Settings
          </Text>
          <Text style={{ color: "#E0E7FF", marginTop: 4 }}>
            Manage your profile and password
          </Text>
        </ExpoLinearGradient>

        <ScrollView
          contentContainerStyle={{
            padding: 20,
            paddingBottom: 60,
            gap: 24,
          }}
        >
          {/* Profile Card */}
          <View
            style={{
              backgroundColor: "white",
              borderRadius: 6,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              gap: 14,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827" }}>
              Profile
            </Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Display name"
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 6,
                padding: 12,
                backgroundColor: "#f9fafb",
                fontSize: 16,
              }}
            />

            <Pressable
              onPress={saveProfile}
              disabled={loading}
              style={{
                backgroundColor: "#6366F1",
                paddingVertical: 14,
                borderRadius: 6,
                alignItems: "center",
                opacity: loading ? 0.8 : 1,
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                {loading ? "Saving..." : "Save Changes"}
              </Text>
            </Pressable>
          {/* </View> */}

          {/* Change Password Card */}
          {/* <View
            style={{
              backgroundColor: "white",
              borderRadius: 16,
              padding: 20,
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 10,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
              gap: 14,
            }}
          > */}
            <Text style={{ fontSize: 18, fontWeight: "600", color: "#111827", marginTop: 20 }}>
              Change Password
            </Text>

            <TextInput
              secureTextEntry
              placeholder="New password"
              value={newPassword}
              onChangeText={setNewPassword}
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 6,
                padding: 12,
                backgroundColor: "#f9fafb",
                fontSize: 16,
              }}
            />
            <TextInput
              secureTextEntry
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholderTextColor="#9ca3af"
              style={{
                borderWidth: 1,
                borderColor: "#e5e7eb",
                borderRadius: 6,
                padding: 12,
                backgroundColor: "#f9fafb",
                fontSize: 16,
              }}
            />

            <Pressable
              onPress={changePassword}
              style={{
                backgroundColor: "#8B5CF6",
                paddingVertical: 14,
                borderRadius: 6,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Change Password
              </Text>
            </Pressable>
          </View>
          <View >
            <Pressable
              onPress={async () => {
                await supabase.auth.signOut();
              }}
              style={{
                backgroundColor: "#EF4444",
                paddingVertical: 14,
                borderRadius: 6,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "white",
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Sign Out
              </Text>
            </Pressable>  
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
}
