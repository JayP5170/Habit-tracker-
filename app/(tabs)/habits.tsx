import { LinearGradient } from "expo-linear-gradient";
import * as Notifications from "expo-notifications";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import {
  registerForPushNotifications,
  scheduleDailyReminder,
} from "../../utils/notifications";
import { useAuth } from "../_layout";

type Habit = {
  id: string;
  title: string;
  description?: string;
  created_at: string;
  streak: number;
  completedToday: boolean;
  lastCompletedAt?: string;
  notificationScheduled?: boolean;
};

// Shimmer Effect Component
function ShimmerPlaceholder({
  width = "100%",
  height = 20,
  borderRadius = 6,
}: {
  width?: string | number;
  height?: number;
  borderRadius?: number;
}) {
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "#e5e7eb",
        opacity,
      }}
    />
  );
}

// Skeleton Loader for Habit Card
function HabitCardSkeleton() {
  return (
    <View
      style={{
        backgroundColor: "#F5F3FF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      {/* Content Section */}
      <View style={{ flex: 1, marginRight: 12 }}>
        {/* Title */}
        <ShimmerPlaceholder width="60%" height={16} borderRadius={4} />

        {/* Streak + warning row */}
        <View style={{ flexDirection: "row", marginTop: 6 }}>
          <ShimmerPlaceholder width={80} height={14} borderRadius={4} />
          <View style={{ marginLeft: 8 }}>
            <ShimmerPlaceholder width={70} height={12} borderRadius={4} />
          </View>
        </View>

        {/* Description */}
        <View style={{ marginTop: 6 }}>
          <ShimmerPlaceholder width="85%" height={13} borderRadius={4} />
        </View>
      </View>

      {/* Actions Section */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {/* Edit icon */}
        <ShimmerPlaceholder width={20} height={20} borderRadius={10} />

        {/* Delete icon */}
        <ShimmerPlaceholder width={20} height={20} borderRadius={10} />

        {/* Checkbox */}
        <ShimmerPlaceholder width={28} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

export default function HabitsScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const insets = useSafeAreaInsets();

  const [habits, setHabits] = React.useState<Habit[]>([]);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [updatingHabitId, setUpdatingHabitId] = React.useState<string | null>(
    null
  );

  // Modal state
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formTitle, setFormTitle] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");

  // Notification settings
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(false);
  const [reminderHour, setReminderHour] = React.useState("09");
  const [reminderMinute, setReminderMinute] = React.useState("00");
  const [showSettings, setShowSettings] = React.useState(false);

  const scheduledNotificationsRef = React.useRef<Map<string, string>>(
    new Map()
  );

  // Initialize notifications on mount
  React.useEffect(() => {
    initializeNotifications();

    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {}
    );

    const responseSubscription =
      Notifications.addNotificationResponseReceivedListener((response) => {});

    return () => {
      subscription.remove();
      responseSubscription.remove();
    };
  }, []);

  const initializeNotifications = async () => {
    const hasPermission = await registerForPushNotifications();
    if (hasPermission) {
      const savedSettings = await loadNotificationSettings();
      if (savedSettings) {
        setNotificationsEnabled(savedSettings.enabled);
        setReminderHour(savedSettings.hour);
        setReminderMinute(savedSettings.minute);
      }
    }
  };

  const loadNotificationSettings = async () => {
    return null;
  };

  const saveNotificationSettings = async (
    enabled: boolean,
    hour: string,
    minute: string
  ) => {
    // TODO: Save to Supabase or AsyncStorage
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);

    if (value) {
      const hour = parseInt(reminderHour);
      const minute = parseInt(reminderMinute);
      const dailyNotificationId = await scheduleDailyReminder(hour, minute);

      scheduledNotificationsRef.current.set(
        "daily_reminder",
        dailyNotificationId
      );

      Alert.alert(
        "✅ Notifications Enabled",
        `You'll receive daily reminders at ${reminderHour}:${reminderMinute}`
      );
    } else {
      const dailyId = scheduledNotificationsRef.current.get("daily_reminder");
      if (dailyId) {
        await Notifications.cancelScheduledNotificationAsync(dailyId);
        scheduledNotificationsRef.current.delete("daily_reminder");
      }

      Alert.alert(
        "🔕 Notifications Disabled",
        "Daily reminders have been turned off"
      );
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

    await saveNotificationSettings(
      notificationsEnabled,
      reminderHour,
      reminderMinute
    );
  };

  const load = React.useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const today = new Date().toISOString().slice(0, 10);

      const { data: habitsData } = await supabase
        .from("habits")
        .select("id, title, description, created_at")
        .eq("user_id", userId);

      const { data: logsData } = await supabase
        .from("habit_logs")
        .select("habit_id, completed, day")
        .eq("user_id", userId)
        .eq("day", today);

      const { data: lastCompletions } = await supabase
        .from("habit_logs")
        .select("habit_id, completed_at")
        .eq("user_id", userId)
        .eq("completed", true)
        .order("completed_at", { ascending: false });

      const habitsWithExtras = await Promise.all(
        (habitsData ?? []).map(async (h: any) => {
          const { data: streakData } = await supabase.rpc("current_streak", {
            h: h.id,
            u: userId,
          });

          const todayLog = logsData?.find((l: any) => l.habit_id === h.id);
          const completedToday = todayLog?.completed ?? false;

          const lastCompletion = lastCompletions?.find(
            (l: any) => l.habit_id === h.id
          );

          return {
            ...h,
            streak: streakData ?? 0,
            completedToday,
            lastCompletedAt: lastCompletion?.completed_at,
          };
        })
      );

      setHabits(habitsWithExtras);
    } catch (error) {
      console.error("Error loading habits:", error);
      Alert.alert("Error", "Failed to load habits. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // Open modal for adding new habit
  const openAddModal = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setModalVisible(true);
  };

  // Open modal for editing existing habit
  const openEditModal = (habit: Habit) => {
    setEditingId(habit.id);
    setFormTitle(habit.title);
    setFormDescription(habit.description || "");
    setModalVisible(true);
  };

  // Save habit (add or edit)
  const saveHabit = async () => {
    if (!formTitle.trim()) {
      Alert.alert("Error", "Habit title cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);

      if (editingId) {
        // Update existing habit
        await supabase
          .from("habits")
          .update({
            title: formTitle.trim(),
            description: formDescription.trim(),
          })
          .eq("id", editingId)
          .eq("user_id", userId);
      } else {
        // Add new habit
        await supabase.from("habits").insert({
          title: formTitle.trim(),
          user_id: userId,
          description: formDescription.trim(),
        });
      }

      setModalVisible(false);
      setFormTitle("");
      setFormDescription("");
      setEditingId(null);
      await load();
    } catch (error) {
      console.error("Error saving habit:", error);
      Alert.alert("Error", "Failed to save habit. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const scheduleStreakNotificationAtCompletion = async (habit: Habit) => {
    try {
      const notificationTime = new Date();
      notificationTime.setHours(notificationTime.getHours() + 11);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `⚠️ Streak Alert: ${habit.title}`,
          body: `You have 13 hours left to complete "${habit.title}" and maintain your streak! 🔥`,
          data: { habitId: habit.id, type: "streak_reminder" },
        },
        trigger: notificationTime,
      });

      scheduledNotificationsRef.current.set(habit.id, notificationId);
    } catch (error) {
      console.error("Failed to schedule streak notification:", error);
    }
  };

  const toggleCompleteToday = async (habitId: string) => {
    try {
      setUpdatingHabitId(habitId);
      const today = new Date().toISOString().slice(0, 10);

      const { data } = await supabase
        .from("habit_logs")
        .select("id, completed")
        .eq("habit_id", habitId)
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle();

      if (!data) {
        await cancelHabitNotifications(habitId);

        await supabase.from("habit_logs").insert({
          habit_id: habitId,
          user_id: userId,
          day: today,
          completed: true,
          completed_at: new Date().toISOString(),
        });

        const habit = habits.find((h) => h.id === habitId);
        if (habit) {
          await scheduleStreakNotificationAtCompletion(habit);
        }
      }

      await load();
    } catch (error) {
      console.error("Error updating habit:", error);
      Alert.alert("Error", "Failed to update habit. Please try again.");
    } finally {
      setUpdatingHabitId(null);
    }
  };

  const cancelHabitNotifications = async (habitId: string) => {
    const notificationId = scheduledNotificationsRef.current.get(habitId);

    if (notificationId) {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      scheduledNotificationsRef.current.delete(habitId);
    }
  };

  const deleteHabit = async (id: string) => {
    try {
      setUpdatingHabitId(id);
      await cancelHabitNotifications(id);
      await supabase.from("habits").delete().eq("id", id).eq("user_id", userId);
      await supabase.from("habit_logs").delete().eq("habit_id", id);
      await load();
    } catch (error) {
      console.error("Error deleting habit:", error);
      Alert.alert("Error", "Failed to delete habit. Please try again.");
    } finally {
      setUpdatingHabitId(null);
    }
  };

  const filteredHabits = [...habits]
    .sort((a, b) => b.streak - a.streak)
    .filter((h) => (showCompleted ? true : !h.completedToday));

  return (
    <LinearGradient
      colors={["#FDEFF9", "#E0C3FC", "#C2E9FB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, paddingTop: insets.top, paddingInline: 16 }}>
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
              💪 My Habits
            </Text>

            {/* Notification Settings Card */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.8)",
                padding: 14,
                borderRadius: 6,
                marginBottom: 16,
              }}
            >
              <Pressable
                onPress={() => setShowSettings(!showSettings)}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 16, fontWeight: "600", color: "#4c1d95" }}
                >
                  🔔 Daily Reminders
                </Text>
                <Text style={{ color: "#6366F1" }}>
                  {showSettings ? "Hide ▲" : "Show ▼"}
                </Text>
              </Pressable>

              {showSettings && (
                <View style={{ marginTop: 12 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginBottom: 12,
                    }}
                  >
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
                      <Text
                        style={{
                          fontSize: 14,
                          color: "#6b7280",
                          marginBottom: 8,
                        }}
                      >
                        Reminder Time (24-hour format)
                      </Text>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                        }}
                      >
                        <TextInput
                          value={reminderHour}
                          onChangeText={setReminderHour}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="09"
                          style={{
                            backgroundColor: "#fff",
                            padding: 10,
                            borderRadius: 6,
                            width: 60,
                            textAlign: "center",
                            fontSize: 16,
                          }}
                        />
                        <Text style={{ fontSize: 18, fontWeight: "bold" }}>
                          :
                        </Text>
                        <TextInput
                          value={reminderMinute}
                          onChangeText={setReminderMinute}
                          keyboardType="number-pad"
                          maxLength={2}
                          placeholder="00"
                          style={{
                            backgroundColor: "#fff",
                            padding: 10,
                            borderRadius: 6,
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
                            borderRadius: 6,
                          }}
                        >
                          <Text style={{ color: "white", fontWeight: "600" }}>
                            Update
                          </Text>
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>

            {/* Stats Card */}
            <View
              style={{
                backgroundColor: "rgba(255,255,255,0.6)",
                padding: 14,
                borderRadius: 6,
                marginBottom: 12,
              }}
            >
              {isLoading ? (
                <>
                  <ShimmerPlaceholder width="60%" height={18} />
                  <View style={{ marginTop: 10 }}>
                    <ShimmerPlaceholder width="40%" height={16} />
                  </View>
                </>
              ) : (
                <>
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
                      ? `${habits.filter((h) => h.completedToday).length} / ${
                          habits.length
                        }`
                      : "No habits yet"}
                  </Text>

                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text
                      style={{
                        fontSize: 15,
                        color: "#3b0764",
                        marginRight: 10,
                      }}
                    >
                      Show All
                    </Text>
                    <Switch
                      value={showCompleted}
                      onValueChange={setShowCompleted}
                      trackColor={{ false: "#d4d4d8", true: "#c4b5fd" }}
                      thumbColor={showCompleted ? "#7C3AED" : "#f4f3f4"}
                    />
                  </View>
                </>
              )}
            </View>

            {/* Habit List */}
            {isLoading ? (
              <>
                <HabitCardSkeleton />
                <HabitCardSkeleton />
                <HabitCardSkeleton />
              </>
            ) : filteredHabits.length === 0 ? (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.7)",
                  padding: 32,
                  borderRadius: 12,
                  alignItems: "center",
                  marginTop: 20,
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: 12 }}>🎯</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#4c1d95",
                    marginBottom: 8,
                  }}
                >
                  No habits yet
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  Tap the + button to create your first habit
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredHabits}
                keyExtractor={(h) => h.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <HabitCard
                    habit={item}
                    deleteHabit={deleteHabit}
                    toggleCompleteToday={toggleCompleteToday}
                    onEdit={openEditModal}
                    isUpdating={updatingHabitId === item.id}
                  />
                )}
              />
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Floating Action Button */}
        <Pressable
          onPress={openAddModal}
          style={{
            position: "absolute",
            right: 16,
            bottom: insets.bottom,
            width: 60,
            height: 60,
            borderRadius: 30,
            backgroundColor: "#7C3AED",
            justifyContent: "center",
            alignItems: "center",
            shadowColor: "#000",
            shadowOpacity: 0.3,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 8,
            elevation: 8,
          }}
        >
          <Text style={{ color: "white", fontSize: 32, fontWeight: "300" }}>
            +
          </Text>
        </Pressable>

        {/* Modal for Add/Edit */}
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "flex-end",
            }}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
            >
              <View
                style={{
                  backgroundColor: "white",
                  borderTopLeftRadius: 24,
                  borderTopRightRadius: 24,
                  padding: 24,
                  paddingBottom: insets.bottom + 24,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 20,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "700",
                      color: "#4c1d95",
                    }}
                  >
                    {editingId ? "Edit Habit" : "Add New Habit"}
                  </Text>
                  <Pressable onPress={() => setModalVisible(false)}>
                    <Text style={{ fontSize: 28, color: "#6b7280" }}>×</Text>
                  </Pressable>
                </View>

                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Habit title"
                  placeholderTextColor="#9ca3af"
                  editable={!isSaving}
                  style={{
                    backgroundColor: "#f3f4f6",
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 16,
                    marginBottom: 12,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                />

                <TextInput
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Why or how? (optional)"
                  placeholderTextColor="#9ca3af"
                  multiline
                  editable={!isSaving}
                  style={{
                    backgroundColor: "#f3f4f6",
                    borderRadius: 6,
                    padding: 16,
                    fontSize: 16,
                    minHeight: 100,
                    textAlignVertical: "top",
                    marginBottom: 20,
                    opacity: isSaving ? 0.6 : 1,
                  }}
                />

                <Pressable
                  onPress={saveHabit}
                  disabled={isSaving}
                  style={{
                    backgroundColor: isSaving ? "#9333EA" : "#7C3AED",
                    paddingVertical: 16,
                    borderRadius: 6,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    opacity: isSaving ? 0.7 : 1,
                  }}
                >
                  {isSaving && (
                    <ActivityIndicator
                      color="white"
                      size="small"
                      style={{ marginRight: 8 }}
                    />
                  )}
                  <Text
                    style={{ color: "white", fontSize: 16, fontWeight: "600" }}
                  >
                    {isSaving
                      ? "Saving..."
                      : editingId
                      ? "Save Changes"
                      : "Add Habit"}
                  </Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </View>
    </LinearGradient>
  );
}

function HabitCard({
  habit,
  deleteHabit,
  toggleCompleteToday,
  onEdit,
  isUpdating,
}: {
  habit: Habit;
  deleteHabit: (id: string) => void;
  toggleCompleteToday: (id: string) => void;
  onEdit: (habit: Habit) => void;
  isUpdating: boolean;
}) {
  const getTimeRemaining = () => {
    if (!habit.lastCompletedAt || habit.completedToday) {
      return null;
    }

    const lastCompletion = new Date(habit.lastCompletedAt);
    const deadline = new Date(lastCompletion.getTime() + 24 * 60 * 60 * 1000);

    const now = new Date();
    const timeLeft = deadline.getTime() - now.getTime();

    const hoursLeft = timeLeft / (1000 * 60 * 60);

    if (hoursLeft <= 0) {
      return { text: "Streak broken!", color: "#dc2626", urgent: false };
    } else if (hoursLeft <= 13) {
      return {
        text: `⚠️ ${hoursLeft.toFixed(1)}h left`,
        color: "#ea580c",
        urgent: true,
      };
    }
  };

  const timeRemaining = getTimeRemaining();

  return (
    <Pressable
      onLongPress={() => onEdit(habit)}
      disabled={isUpdating}
      style={{
        backgroundColor: habit.completedToday
          ? "#E8F5E9"
          : timeRemaining?.urgent
          ? "#FFF3E0"
          : "#F5F3FF",
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "center",
        opacity: isUpdating ? 0.6 : 1,
      }}
    >
      {/* Content Section */}
      <View style={{ flex: 1, marginRight: 12 }}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: "600",
            color: "#1F2937",
            marginBottom: 4,
          }}
        >
          {habit.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: habit.completedToday ? "#10B981" : "#F59E0B",
            }}
          >
            🔥 {habit.streak} Days
          </Text>
          {timeRemaining && (
            <Text
              style={{
                fontSize: 12,
                fontWeight: "500",
                color: timeRemaining.color,
              }}
            >
              {timeRemaining.text}
            </Text>
          )}
        </View>
        {habit.description && (
          <Text
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginTop: 4,
            }}
            numberOfLines={1}
          >
            {habit.description}
          </Text>
        )}
      </View>

      {/* Actions Section */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {!habit.completedToday && (
          <>
            <Pressable onPress={() => onEdit(habit)} disabled={isUpdating}>
              <Text style={{ fontSize: 20, opacity: isUpdating ? 0.5 : 1 }}>
                ✏️
              </Text>
            </Pressable>
            <Pressable
              onPress={() => deleteHabit(habit.id)}
              disabled={isUpdating}
            >
              <Text style={{ fontSize: 20, opacity: isUpdating ? 0.5 : 1 }}>
                🗑️
              </Text>
            </Pressable>
          </>
        )}

        {/* Checkbox */}
        <Pressable
          onPress={() => toggleCompleteToday(habit.id)}
          disabled={isUpdating || habit.completedToday}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: habit.completedToday ? "#10B981" : "#E5E7EB",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: habit.completedToday ? "#10B981" : "#D1D5DB",
            opacity: habit.completedToday ? 1 : isUpdating ? 0.5 : 1,
          }}
        >
          {isUpdating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            habit.completedToday && (
              <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
                ✓
              </Text>
            )
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}
