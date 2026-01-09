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
  RefreshControl,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";

type Task = {
  id: string;
  title: string;
  description?: string;
  completedToday?: boolean;
  created_at: string;
};

export default function TodayScreen() {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [newTitle, setNewTitle] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [showCompleted, setShowCompleted] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!userId) return;
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
  }, [userId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title) return alert("Task title cannot be empty.");
    await supabase.from("tasks").insert({
      title,
      description: newDescription.trim(),
      user_id: userId,
    });
    setNewTitle("");
    setNewDescription("");
    load();
  };

  const toggleCompleteToday = async (taskId: string) => {
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
    load();
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const title = editTitle.trim();
    if (!title) return alert("Task title cannot be empty.");
    await supabase
      .from("tasks")
      .update({
        title,
        description: editDescription.trim(),
      })
      .eq("id", editingId);
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
    load();
  };

  const deleteTask = async (taskId: string) => {
    await supabase.from("tasks").delete().eq("id", taskId);
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
              ✨ Today’s Tasks
            </Text>

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
                placeholder="Add a new task..."
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
                placeholder="Description (optional)"
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
                onPress={addTask}
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
                  + Add Task
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
                {tasks.length > 0
                  ? `${tasks.filter((t) => t.completedToday).length} / ${
                      tasks.length
                    }`
                  : "No tasks yet"}
              </Text>

              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text
                  style={{ fontSize: 15, color: "#3b0764", marginRight: 10 }}
                >
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

            {/* Task List */}
            <FlatList
              data={
                showCompleted ? tasks : tasks.filter((t) => !t.completedToday)
              }
              keyExtractor={(t) => t.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TaskCard
                  task={item}
                  editingId={editingId}
                  setEditingId={setEditingId}
                  editTitle={editTitle}
                  setEditTitle={setEditTitle}
                  editDescription={editDescription}
                  setEditDescription={setEditDescription}
                  saveEdit={saveEdit}
                  deleteTask={deleteTask}
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

function TaskCard({
  task,
  editingId,
  setEditingId,
  editTitle,
  setEditTitle,
  editDescription,
  setEditDescription,
  saveEdit,
  deleteTask,
  toggleCompleteToday,
}: any) {
  const isEditing = editingId === task.id;

  // Check if task is from a previous day
  const taskDate = new Date(task.created_at).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const isFromPreviousDay = taskDate < today && !task.completedToday;

  return (
    <LinearGradient
      colors={
        task.completedToday
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
      {/* Overdue Warning Badge */}
      {isFromPreviousDay && (
        <View
          style={{
            backgroundColor: "#FEE2E2",
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: 8,
            marginBottom: 8,
            borderLeftWidth: 3,
            borderLeftColor: "#EF4444",
          }}
        >
          <Text style={{ color: "#DC2626", fontSize: 13, fontWeight: "600" }}>
            ⚠️ Pending from previous day
          </Text>
        </View>
      )}

      {/* Title */}
      {!isEditing ? (
        <Text
          style={{
            fontSize: 17,
            fontWeight: "700",
            color: task.completedToday ? "#16a34a" : "#312e81",
            textDecorationLine: task.completedToday ? "line-through" : "none",
          }}
        >
          {task.title}
        </Text>
      ) : (
        <TextInput
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="Edit task title"
          style={{
            backgroundColor: "#f9fafb",
            borderRadius: 8,
            padding: 8,
          }}
        />
      )}

      {/* Description */}
      {!isEditing ? (
        task.description ? (
          <Text style={{ marginTop: 6, color: "#6b7280" }}>
            {task.description}
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
        {new Date(task.created_at).toLocaleString()}
      </Text>

      {!isEditing && (
        <Pressable
          onPress={() => toggleCompleteToday(task.id)}
          style={{
            marginTop: 10,
            backgroundColor: task.completedToday ? "#4ade80" : "#7C3AED",
            paddingVertical: 8,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "600" }}>
            {task.completedToday ? "🎉 Done" : "Mark as Done"}
          </Text>
        </Pressable>
      )}

      {!task.completedToday && (
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
                  setEditingId(task.id);
                  setEditTitle(task.title);
                  setEditDescription(task.description ?? "");
                }}
              >
                <Text style={{ color: "#6366F1", fontWeight: "600" }}>
                  Edit
                </Text>
              </Pressable>
              <Pressable onPress={() => deleteTask(task.id)}>
                <Text style={{ color: "#EF4444", fontWeight: "600" }}>
                  Delete
                </Text>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={saveEdit}>
              <Text style={{ color: "#16a34a", fontWeight: "700" }}>Save</Text>
            </Pressable>
          )}
        </View>
      )}
    </LinearGradient>
  );
}
