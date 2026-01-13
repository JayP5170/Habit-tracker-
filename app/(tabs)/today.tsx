import { LinearGradient } from "expo-linear-gradient";
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
  RefreshControl,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";

type Task = {
  id: string;
  title: string;
  description?: string;
  completedToday?: boolean;
  created_at: string;
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
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0.8],
  });

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: "#D1D5DB",
        opacity,
      }}
    />
  );
}

// Skeleton Loader for Task Card
function TaskCardSkeleton() {
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
      <View style={{ flex: 1, marginRight: 12 }}>
        <ShimmerPlaceholder width="65%" height={18} borderRadius={4} />
        <View style={{ marginTop: 6 }}>
          <ShimmerPlaceholder width="55%" height={12} borderRadius={4} />
        </View>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <ShimmerPlaceholder width={24} height={24} borderRadius={12} />
        <ShimmerPlaceholder width={24} height={24} borderRadius={12} />
        <ShimmerPlaceholder width={28} height={28} borderRadius={14} />
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const insets = useSafeAreaInsets();

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [updatingTaskId, setUpdatingTaskId] = React.useState<string | null>(
    null
  );

  // Modal state
  const [modalVisible, setModalVisible] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [formTitle, setFormTitle] = React.useState("");
  const [formDescription, setFormDescription] = React.useState("");

  const load = React.useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .slice(0, 10);

      // 1. Delete tasks that were completed yesterday or earlier
      const { data: oldCompletedLogs } = await supabase
        .from("task_logs")
        .select("task_id")
        .eq("user_id", userId)
        .eq("completed", true)
        .lt("day", today); // logs before today

      if (oldCompletedLogs && oldCompletedLogs.length > 0) {
        const taskIdsToDelete = oldCompletedLogs.map((log) => log.task_id);
        await supabase
          .from("tasks")
          .delete()
          .in("id", taskIdsToDelete)
          .eq("user_id", userId);
      }

      // 2. Fetch remaining tasks
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // 3. Fetch today's logs
      const { data: logsData } = await supabase
        .from("task_logs")
        .select("task_id, completed")
        .eq("user_id", userId)
        .eq("day", today);

      // 4. Merge completion info into tasks
      const enhanced = tasksData?.map((task: any) => {
        const log = logsData?.find((l: any) => l.task_id === task.id);
        return {
          ...task,
          completedToday: log?.completed ?? false,
        };
      });

      setTasks(enhanced ?? []);
    } catch (error) {
      console.error("Error loading tasks:", error);
      Alert.alert("Error", "Failed to load tasks. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Open modal for adding new task
  const openAddModal = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setModalVisible(true);
  };

  // Open modal for editing existing task
  const openEditModal = (task: Task) => {
    setEditingId(task.id);
    setFormTitle(task.title);
    setFormDescription(task.description || "");
    setModalVisible(true);
  };

  // Save task (add or edit)
  const saveTask = async () => {
    if (!formTitle.trim()) {
      Alert.alert("Error", "Task title cannot be empty.");
      return;
    }

    try {
      setIsSaving(true);

      if (editingId) {
        // Update existing task
        await supabase
          .from("tasks")
          .update({
            title: formTitle.trim(),
            description: formDescription.trim(),
          })
          .eq("id", editingId);
      } else {
        // Add new task
        await supabase.from("tasks").insert({
          title: formTitle.trim(),
          description: formDescription.trim(),
          user_id: userId,
        });
      }

      setModalVisible(false);
      setFormTitle("");
      setFormDescription("");
      setEditingId(null);
      await load();
    } catch (error) {
      console.error("Error saving task:", error);
      Alert.alert("Error", "Failed to save task. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleCompleteToday = async (taskId: string) => {
    try {
      setUpdatingTaskId(taskId);
      const today = new Date().toISOString().slice(0, 10);

      const { data } = await supabase
        .from("task_logs")
        .select("id, completed")
        .eq("task_id", taskId)
        .eq("user_id", userId)
        .eq("day", today)
        .maybeSingle();

      if (!data) {
        await supabase.from("task_logs").insert({
          task_id: taskId,
          user_id: userId,
          day: today,
          completed: true,
        });
      }

      await load();
    } catch (error) {
      console.error("Error updating task:", error);
      Alert.alert("Error", "Failed to update task. Please try again.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      setUpdatingTaskId(taskId);
      await supabase.from("tasks").delete().eq("id", taskId);
      await load();
    } catch (error) {
      console.error("Error deleting task:", error);
      Alert.alert("Error", "Failed to delete task. Please try again.");
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const filteredTasks = showCompleted
    ? tasks
    : tasks.filter((t) => !t.completedToday);

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
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  load().finally(() => setRefreshing(false));
                }}
              />
            }
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
              ✨ Today&apos;s Tasks
            </Text>

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
                    {tasks.length > 0
                      ? `${tasks.filter((t) => t.completedToday).length} / ${
                          tasks.length
                        }`
                      : "No tasks yet"}
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

            {/* Task List */}
            {isLoading ? (
              <>
                <TaskCardSkeleton />
                <TaskCardSkeleton />
                <TaskCardSkeleton />
              </>
            ) : filteredTasks.length === 0 ? (
              <View
                style={{
                  backgroundColor: "rgba(255,255,255,0.7)",
                  padding: 32,
                  borderRadius: 12,
                  alignItems: "center",
                  marginTop: 20,
                }}
              >
                <Text style={{ fontSize: 48, marginBottom: 12 }}>📝</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "600",
                    color: "#4c1d95",
                    marginBottom: 8,
                  }}
                >
                  No tasks yet
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#6b7280",
                    textAlign: "center",
                  }}
                >
                  Tap the + button to add your first task
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredTasks}
                keyExtractor={(t) => t.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <TaskCard
                    task={item}
                    deleteTask={deleteTask}
                    toggleCompleteToday={toggleCompleteToday}
                    onEdit={openEditModal}
                    isUpdating={updatingTaskId === item.id}
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
                    {editingId ? "Edit Task" : "Add New Task"}
                  </Text>
                  <Pressable onPress={() => setModalVisible(false)}>
                    <Text style={{ fontSize: 28, color: "#6b7280" }}>×</Text>
                  </Pressable>
                </View>

                <TextInput
                  value={formTitle}
                  onChangeText={setFormTitle}
                  placeholder="Task title"
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
                  placeholder="Description (optional)"
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
                  onPress={saveTask}
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
                      : "Add Task"}
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

function TaskCard({
  task,
  deleteTask,
  toggleCompleteToday,
  onEdit,
  isUpdating,
}: {
  task: Task;
  deleteTask: (id: string) => void;
  toggleCompleteToday: (id: string) => void;
  onEdit: (task: Task) => void;
  isUpdating: boolean;
}) {
  // Check if task is from a previous day
  const taskDate = new Date(task.created_at).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const isFromPreviousDay = taskDate < today && !task.completedToday;

  return (
    <Pressable
      onLongPress={() => onEdit(task)}
      disabled={isUpdating}
      style={{
        backgroundColor: task.completedToday
          ? "#E8F5E9"
          : isFromPreviousDay
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
          {task.title}
        </Text>

        {/* Overdue Warning */}
        {isFromPreviousDay && (
          <Text
            style={{
              fontSize: 12,
              fontWeight: "500",
              color: "#ea580c",
              marginBottom: 4,
            }}
          >
            ⚠️ Pending from previous day
          </Text>
        )}

        {task.description && (
          <Text
            style={{
              fontSize: 13,
              color: "#6B7280",
              marginTop: 2,
            }}
            numberOfLines={1}
          >
            {task.description}
          </Text>
        )}
      </View>

      {/* Actions Section */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {!task.completedToday && (
          <>
            <Pressable onPress={() => onEdit(task)} disabled={isUpdating}>
              <Text style={{ fontSize: 20, opacity: isUpdating ? 0.5 : 1 }}>
                ✏️
              </Text>
            </Pressable>
            <Pressable
              onPress={() => deleteTask(task.id)}
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
          onPress={() => toggleCompleteToday(task.id)}
          disabled={isUpdating || task.completedToday}
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: task.completedToday ? "#10B981" : "#E5E7EB",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: task.completedToday ? "#10B981" : "#D1D5DB",
            opacity: task.completedToday ? 1 : isUpdating ? 0.5 : 1,
          }}
        >
          {isUpdating ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            task.completedToday && (
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
