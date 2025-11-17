import React from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from "react-native";
import { supabase } from "../../supabaseClient";
import { Link, router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function SignupScreen() {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [name, setName] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const onSignup = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;

      const user = data.user;
      if (user) {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          display_name: name || user.email,
        });

        // redirect to home or sign-in page
        router.replace("/Auth/SigninScreen");
      }
    } catch (e: any) {
      Alert.alert("Signup error", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#eef2ff", "#c7d2fe", "#e0e7ff"]}
      style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{
          width: "100%",
          maxWidth: 400,
          backgroundColor: "white",
          borderRadius: 20,
          padding: 24,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 10,
          elevation: 5,
        }}
      >
        <View style={{ alignItems: "center", marginBottom: 24 }}>
          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/456/456212.png" }}
            style={{ width: 70, height: 70, marginBottom: 12 }}
          />
          <Text style={{ fontSize: 26, fontWeight: "700", color: "#111827" }}>Create Account 🎉</Text>
          <Text style={{ color: "#6b7280", marginTop: 4 }}>Join us and get started</Text>
        </View>

        <View style={{ gap: 14 }}>
          <TextInput
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 14,
              borderRadius: 10,
              fontSize: 16,
            }}
          />
          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 14,
              borderRadius: 10,
              fontSize: 16,
            }}
          />
          <TextInput
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              backgroundColor: "#f9fafb",
              padding: 14,
              borderRadius: 10,
              fontSize: 16,
            }}
          />
        </View>

        <TouchableOpacity
          disabled={loading}
          onPress={onSignup}
          style={{
            backgroundColor: "#4f46e5",
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
            marginTop: 22,
            opacity: loading ? 0.8 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={{ color: "white", fontWeight: "600", fontSize: 16 }}>Sign Up</Text>
          )}
        </TouchableOpacity>

        <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 18 }}>
          <Text style={{ color: "#6b7280" }}>Already have an account? </Text>
          <Link href="/Auth/SigninScreen" asChild>
            <Pressable>
              <Text style={{ color: "#4f46e5", fontWeight: "600", marginBottom: 10 }}>Sign In</Text>
            </Pressable>
          </Link>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}
