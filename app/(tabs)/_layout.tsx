import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // headerStyle: {
        //   height: 60,
        // },
        headerTitleStyle: {
          display: "none",
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          tabBarIcon: ({ color, focused }) =>
            focused ? (
              <Ionicons name="today" size={24} color={color} />
            ) : (
              <Ionicons name="today-outline" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="habits"
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="fitness-center" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="insights" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="settings" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
