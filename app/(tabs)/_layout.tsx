import { Tabs } from 'expo-router';
import { useAuth } from '../_layout';
import React from 'react';
import { Pressable, Text } from 'react-native';
import { supabase } from '../../supabaseClient';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

export default function TabLayout() {
  const { session } = useAuth();
  return (
    <Tabs screenOptions={{ headerRight: () => (
      <Pressable onPress={() => supabase.auth.signOut()} style={{ marginRight: 12 }}>
        <Text>Logout</Text>
      </Pressable>
    )}}>
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: ({ color, focused}) => {return focused? <Ionicons name="today" size={24} color={color} /> : <Ionicons name="today-outline" size={24} color={color} /> }}} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: ({ color}) => <MaterialIcons name="fitness-center" size={24} color={color} /> }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats', tabBarIcon: ({ color}) => <MaterialIcons name="insights" size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color}) => <MaterialIcons name="settings" size={24} color={color} /> }} />
    </Tabs>
  );
}
