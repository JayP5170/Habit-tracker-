import React from "react";
import { View, Image, ActivityIndicator } from "react-native";

export default function LoadingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Image
        source={require("../assets/images/icon.jpg")}
        style={{ width: 120, height: 120, marginBottom: 20 }}
        resizeMode="contain"
      />

      <ActivityIndicator size="large" color="#7C3AED" />
    </View>
  );
}