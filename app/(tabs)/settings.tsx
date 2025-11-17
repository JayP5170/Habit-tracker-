import React from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../_layout';
import { supabase } from '../../supabaseClient';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';

export default function Settings() {
  const { session } = useAuth();
  const [name, setName] = React.useState('');
  const [initial, setInitial] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session!.user.id)
        .maybeSingle();
      if (data) {
        setName(data.display_name ?? '');
        setInitial(true);
      }
    })();
  }, []);

  const saveProfile = async () => {
    setLoading(true);
    try {
      await supabase.from('profiles').upsert({
        id: session?.user.id,
        display_name: name,
        email: session?.user.email,
      });
      Alert.alert('Profile updated successfully!');
    } catch (e) {
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async () => {
    if ( !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match.');
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) Alert.alert('Error', error.message);
    else {
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password changed successfully!');
    }
  };

  if (!initial)
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );

  return (
    <View style={{ flex: 1, backgroundColor: '#f1f5f9' }}>
      {/* Gradient Header */}
      <ExpoLinearGradient
        colors={['#6366F1', '#8B5CF6']}
        style={{
          paddingVertical: 50,
          paddingHorizontal: 20,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      >
        <Text style={{ fontSize: 28, fontWeight: '700', color: 'white' }}>
          Settings
        </Text>
        <Text style={{ color: '#E0E7FF', marginTop: 4 }}>
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
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
            Profile
          </Text>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            placeholderTextColor="#9ca3af"
            style={{
              borderWidth: 1,
              borderColor: '#e5e7eb',
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#f9fafb',
              fontSize: 16,
            }}
          />

          <Pressable
            onPress={saveProfile}
            disabled={loading}
            style={{
              backgroundColor: '#6366F1',
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: 'center',
              opacity: loading ? 0.8 : 1,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 16,
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Text>
          </Pressable>
        </View>

        {/* Change Password Card */}
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 16,
            padding: 20,
            shadowColor: '#000',
            shadowOpacity: 0.08,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4,
            gap: 14,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>
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
              borderColor: '#e5e7eb',
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#f9fafb',
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
              borderColor: '#e5e7eb',
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#f9fafb',
              fontSize: 16,
            }}
          />

          <Pressable
            onPress={changePassword}
            style={{
              backgroundColor: '#8B5CF6',
              paddingVertical: 14,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '600',
                fontSize: 16,
              }}
            >
              Change Password
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
