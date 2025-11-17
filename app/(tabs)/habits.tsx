import React from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  Switch,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";
import * as Notifications from 'expo-notifications';
import {
  registerForPushNotifications,
  scheduleDailyReminder,
  cancelAllNotifications,
  sendTestNotification,
} from '../../utils/notifications';

type Habit = {
  id: string;
  title: string;
  description?: string;
};

export default function HabitsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [habits, setHabits] = React.useState<
  (Habit & { streak: number; completedToday: boolean; created_at: string })[]
  >([]);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [showCompleted, setShowCompleted] = React.useState(true);
  
  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);
  const [reminderHour, setReminderHour] = React.useState("09");
  const [reminderMinute, setReminderMinute] = React.useState("00");
  const [showSettings, setShowSettings] = React.useState(false);

  // Initialize notifications on mount
  React.useEffect(() => {
    initializeNotifications();
    
    // Handle notification received while app is foregrounded
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification tapped
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
    });

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const initializeNotifications = async () => {
    const hasPermission = await registerForPushNotifications();
    if (hasPermission) {
      // Load saved notification preferences
      const savedSettings = await loadNotificationSettings();
      if (savedSettings) {
        setNotificationsEnabled(savedSettings.enabled);
        setReminderHour(savedSettings.hour);
        setReminderMinute(savedSettings.minute);
      }
    }
  };

  const loadNotificationSettings = async () => {
    // You can store these in Supabase or AsyncStorage
    // For now, returning null - implement your storage solution
    return null;
  };

  const saveNotificationSettings = async (enabled: boolean, hour: string, minute: string) => {
    // Save to Supabase or AsyncStorage
    // Example: await AsyncStorage.setItem('notificationSettings', JSON.stringify({enabled, hour, minute}));
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    
    if (value) {
      const hour = parseInt(reminderHour);
      const minute = parseInt(reminderMinute);
      await scheduleDailyReminder(hour, minute);
      Alert.alert(
        "✅ Notifications Enabled",
        `You'll receive daily reminders at ${reminderHour}:${reminderMinute}`
      );
    } else {
      await cancelAllNotifications();
      Alert.alert("🔕 Notifications Disabled", "Daily reminders have been turned off");
    }
    
    await saveNotificationSettings(value, reminderHour, reminderMinute);
  };

  const updateReminderTime = async () => {
    const hour = parseInt(reminderHour);
    const minute = parseInt(reminderMinute);
    
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      Alert.alert("Invalid Time", "Please enter a valid time (00:00 - 23:59)");
      return;
    }

    if (notificationsEnabled) {
      await scheduleDailyReminder(hour, minute);
      Alert.alert(
        "⏰ Time Updated",
        `Daily reminder set for ${reminderHour}:${reminderMinute}`
      );
    }
    
    await saveNotificationSettings(notificationsEnabled, reminderHour, reminderMinute);
  };

  const testNotification = async () => {
    await sendTestNotification();
    Alert.alert("🔔 Test Sent", "Check your notifications in a few seconds!");
  };

  const load = React.useCallback(async () => {
    if (!userId) return;
    const today = new Date().toISOString().slice(0, 10);

    const { data: habitsData } = await supabase
      .from("habits")
      .select("id, title, description, created_at")
      .eq("user_id", userId);

    const { data: logsData } = await supabase
      .from("habit_logs")
      .select("habit_id, completed")
      .eq("user_id", userId)
      .eq("day", today);

    const habitsWithExtras = await Promise.all(
      (habitsData ?? []).map(async (h: any) => {
        const { data: streakData } = await supabase.rpc("current_streak", {
          h: h.id,
          u: userId,
        });
        console.log('data: ', { data: streakData });
        const todayLog = logsData?.find((l: any) => l.habit_id === h.id);
        return {
          ...h,
          streak: streakData ?? 0,
          completedToday: todayLog?.completed ?? false,
        };
      })
    );
    setHabits(habitsWithExtras);
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const addHabit = async () => {
    if (!newTitle.trim()) return alert("Habit title cannot be empty.");
    await supabase.from("habits").insert({
      title: newTitle.trim(),
      user_id: userId,
      description: newDescription.trim(),
    });
    setNewTitle("");
    setNewDescription("");
    load();
  };

  const toggleCompleteToday = async (habitId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("habit_logs")
      .select("id, completed")
      .eq("habit_id", habitId)
      .eq("user_id", userId)
      .eq("day", today)
      .maybeSingle();
    if (!data) {
      await supabase.from("habit_logs").insert({
        habit_id: habitId,
        user_id: userId,
        day: today,
        completed: true,
      });
    }
    load();
  };

  const saveEditHabit = async () => {
    if (!editingId) return;
    const title = editTitle.trim();
    if (!title) return alert("Habit title cannot be empty.");
    await supabase
      .from("habits")
      .update({
        title: editTitle.trim(),
        description: editDescription.trim(),
      })
      .eq("id", editingId)
      .eq("user_id", userId);
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    load();
  };

  const deleteHabit = async (id: string) => {
    await supabase.from("habits").delete().eq("id", id).eq("user_id", userId);
    await supabase.from("habit_logs").delete().eq("habit_id", id);
    load();
  };

  return (
    <LinearGradient
      colors={["#FDEFF9", "#E0C3FC", "#C2E9FB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, padding: Platform.OS === "ios" ? 16 : 0 }}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 80 }}
          >
            <Text
              style={{
                fontSize: 28,
                fontWeight: "800",
                color: "#3b0764",
                textAlign: "center",
                marginBottom: 20,
              }}
            >
              🌈 My Habits
            </Text>

            {/* Notification Settings Card */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.8)",
                padding: 14,
                borderRadius: 16,
                marginBottom: 16,
              }}
            >
              <Pressable
                onPress={() => setShowSettings(!showSettings)}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#4c1d95" }}>
                  🔔 Daily Reminders
                </Text>
                <Text style={{ color: "#6366F1" }}>
                  {showSettings ? "Hide ▲" : "Show ▼"}
                </Text>
              </Pressable>

              {showSettings && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                    <Text style={{ fontSize: 15, color: "#3b0764", flex: 1 }}>
                      Enable Notifications
                    </Text>
                    <Switch
                      value={notificationsEnabled}
                      onValueChange={toggleNotifications}
                      trackColor={{ false: "#d4d4d8", true: "#c4b5fd" }}
                      thumbColor={notificationsEnabled ? "#7C3AED" : "#f4f3f4"}
                    />
                  </View>

                  {notificationsEnabled && (
                    <>
                      <Text style={{ fontSize: 14, color: "#6b7280", marginBottom: 8 }}>
                        Reminder Time (24-hour format)
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <TextInput
                          value={reminderHour}
                          onChangeText={setReminderHour}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="09"
                          style={{
                            backgroundColor: "#fff",
                            padding: 10,
                            borderRadius: 8,
                            width: 60,
                            textAlign: "center",
                            fontSize: 16,
                          }}
                        />
                        <Text style={{ fontSize: 18, fontWeight: "bold" }}>:</Text>
                        <TextInput
                          value={reminderMinute}
                          onChangeText={setReminderMinute}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="00"
                          style={{
                            backgroundColor: "#fff",
                            padding: 10,
                            borderRadius: 8,
                            width: 60,
                            textAlign: "center",
                            fontSize: 16,
                          }}
                        />
                        <Pressable
                          onPress={updateReminderTime}
                          style={{
                            backgroundColor: "#7C3AED",
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ color: "white", fontWeight: "600" }}>Update</Text>
                        </Pressable>
                      </View>

                      {/* <Pressable
                        onPress={testNotification}
                        style={{
                          backgroundColor: "#6366F1",
                          paddingVertical: 10,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{ color: "white", fontWeight: "600" }}>
                          🔔 Send Test Notification
                        </Text>
                      </Pressable> */}
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Input Card */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.7)",
                padding: 14,
                borderRadius: 16,
                marginBottom: 20,
                shadowColor: "#aaa",
                shadowOpacity: 0.2,
                shadowOffset: { width: 0, height: 3 },
                shadowRadius: 6,
              }}
            >
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="Add a new habit..."
                placeholderTextColor="#6b7280"
                style={{
                  borderRadius: 10,
                  padding: 12,
                  backgroundColor: "#fff",
                  marginBottom: 10,
                }}
              />
              <TextInput
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Why or how? (optional)"
                placeholderTextColor="#9ca3af"
                multiline
                style={{
                  borderRadius: 10,
                  padding: 12,
                  backgroundColor: "#fff",
                  minHeight: 60,
                }}
              />
              <Pressable
                onPress={addHabit}
                style={{
                  backgroundColor: "#7C3AED",
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  marginTop: 10,
                  shadowColor: "#7C3AED",
                  shadowOpacity: 0.25,
                  shadowOffset: { width: 0, height: 4 },
                  shadowRadius: 6,
                }}
              >
                <Text
                  style={{ color: "white", fontSize: 16, fontWeight: "600" }}
                >
                  + Add Habit
                </Text>
              </Pressable>
            </View>

            {/* Stats Card */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.6)",
                padding: 14,
                borderRadius: 16,
                marginBottom: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "600",
                  color: "#4c1d95",
                  marginBottom: 6,
                }}
              >
                Progress:{" "}
                {habits.length > 0
                  ? `${habits.filter((h) => h.completedToday).length} / ${habits.length}`
                  : "No habits yet"}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 15, color: "#3b0764", marginRight: 10 }}>
                  Show Completed
                </Text>
                <Switch
                  value={showCompleted}
                  onValueChange={setShowCompleted}
                  trackColor={{ false: "#d4d4d8", true: "#c4b5fd" }}
                  thumbColor={showCompleted ? "#7C3AED" : "#f4f3f4"}
                />
              </View>
            </View>

            {/* Habit List */}
            <FlatList
              data={[...habits]
                .sort((a, b) => b.streak - a.streak)
                .filter((h) => (showCompleted ? true : !h.completedToday))}
              keyExtractor={(h) => h.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <HabitCard
                  habit={item}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  editDescription={editDescription}
                  setEditDescription={setEditDescription}
                  saveEditHabit={saveEditHabit}
                  deleteHabit={deleteHabit}
                  toggleCompleteToday={toggleCompleteToday}
                />
              )}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

function HabitCard({
  habit,
  editingId,
  setEditingId,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  saveEditHabit,
  deleteHabit,
  toggleCompleteToday,
}: any) {
  const isEditing = editingId === habit.id;
  return (
    <LinearGradient
      colors={
        habit.completedToday
          ? ["#BBF7D0", "#DCFCE7"]
          : ["#fff", "rgba(255,255,255,0.8)"]
      }
      style={{
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
      }}
    >
      {/* Title + Streak */}
      {!isEditing ? (
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: habit.completedToday ? "#16a34a" : "#312e81",
            textDecorationLine: habit.completedToday ? "line-through" : "none",
          }}
        >
          {habit.title} 🔥 {habit.streak}
        </Text>
      ) : (
        <TextInput
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="Edit habit title"
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            padding: 8,
          }}
        />
      )}

      {/* Description */}
      {!isEditing ? (
        habit.description ? (
          <Text style={{ marginTop: 6, color: "#6b7280" }}>
            {habit.description}
          </Text>
        ) : null
      ) : (
        <TextInput
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder="Edit description"
          multiline
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            padding: 8,
            minHeight: 60,
            marginTop: 6,
          }}
        />
      )}

      <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
        {new Date(habit.created_at).toLocaleString()}
      </Text>

      {!isEditing && (
        <Pressable
          onPress={() => toggleCompleteToday(habit.id)}
          style={{
            marginTop: 10,
            backgroundColor: habit.completedToday ? "#4ade80" : "#7C3AED",
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>
            {habit.completedToday ? "🎉 Done" : "Mark as Done"}
          </Text>
        </Pressable>
      )}

      {!habit.completedToday && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: 8,
            gap: 16,
          }}
        >
          {!isEditing ? (
            <>
              <Pressable
                onPress={() => {
                  setEditingId(habit.id);
                  setEditTitle(habit.title);
                  setEditDescription(habit.description ?? "");
                }}
              >
                <Text style={{ color: "#6366F1", fontWeight: "600" }}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => deleteHabit(habit.id)}>
                <Text style={{ color: "#EF4444", fontWeight: "600" }}>
                  Delete
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={saveEditHabit}>
              <Text style={{ color: "#16a34a", fontWeight: "700" }}>Save</Text>
            </Pressable>
          )}
        </View>
      )}
    </LinearGradient>
  );
}