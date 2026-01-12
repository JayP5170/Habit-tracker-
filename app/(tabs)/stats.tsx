import { LinearGradient } from "expo-linear-gradient";
import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";

type Habit = {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
  streak?: number;
  color?: string;
};

type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  day: string;
  completed: boolean;
};

type MarkedDates = {
  [date: string]: {
    dots?: { color: string; key: string }[];
  };
};

// Function to generate distinct colors dynamically
const generateColor = (index: number): string => {
  const hue = (index * 137.508) % 360; // Golden angle for good distribution
  return `hsl(${hue}, 70%, 50%)`;
};

export default function StatsScreen(): JSX.Element {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const insets = useSafeAreaInsets();

  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Load all habits and assign colors
  const loadHabits = useCallback(async () => {
    if (!userId) {
      setHabits([]);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("habits")
        .select("id, title, description, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const rows = data || [];

      // fetch streak for each habit
      const withStreaks = await Promise.all(
        rows.map(async (h: any, index: number) => {
          try {
            const { data: streakData, error: rpcErr } = await supabase.rpc(
              "current_streak",
              { h: h.id, u: userId }
            );
            if (rpcErr) {
              console.error("RPC error for streak:", rpcErr);
            }
            return {
              ...h,
              streak: (streakData as any) ?? 0,
              color: generateColor(index),
            } as Habit;
          } catch (rpcCatchErr) {
            console.error("RPC catch error:", rpcCatchErr);
            return {
              ...h,
              streak: 0,
              color: generateColor(index),
            } as Habit;
          }
        })
      );

      withStreaks.sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0));
      setHabits(withStreaks);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load habits.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Load logs for ALL habits
  const loadAllLogs = useCallback(async () => {
    if (!userId) {
      setLogs([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("habit_logs")
        .select("id, habit_id, user_id, day, completed")
        .eq("user_id", userId)
        .eq("completed", true)
        .order("day", { ascending: true });

      if (error) throw error;

      setLogs(data || []);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load logs.");
    }
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadHabits();
    loadAllLogs();
  }, [loadHabits, loadAllLogs]);

  // Build marked dates with colored dots
  const markedDates = useMemo<MarkedDates>(() => {
    const out: MarkedDates = {};
    logs.forEach((log) => {
      const habit = habits.find((h) => h.id === log.habit_id);
      if (habit && log.day) {
        if (!out[log.day]) {
          out[log.day] = { dots: [] };
        }
        out[log.day].dots?.push({
          color: habit.color || "#16a34a",
          key: habit.id,
        });
      }
    });
    return out;
  }, [logs, habits]);

  // Get habits for a specific date
  const getHabitsForDate = (date: string): Habit[] => {
    const habitIds = logs
      .filter((log) => log.day === date)
      .map((log) => log.habit_id);
    return habits.filter((h) => habitIds.includes(h.id));
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#FDEFF9", "#E0C3FC", "#C2E9FB"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <Text style={styles.heading}>📅 Habit Progress</Text>

        {habits.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No habits yet. Add one to track progress.
            </Text>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Calendar */}
            <View style={{ paddingHorizontal: 16 }}>
              <Calendar
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={(day) => {
                  const habitsForDate = getHabitsForDate(day.dateString);
                  if (habitsForDate.length > 0) {
                    setSelectedDate(day.dateString);
                  }
                }}
                theme={{
                  todayTextColor: "#7C3AED",
                  arrowColor: "#7C3AED",
                  monthTextColor: "#4c1d95",
                  textMonthFontWeight: "700",
                }}
                style={styles.calendar}
              />

              {/* Tooltip for selected date */}
              {selectedDate && getHabitsForDate(selectedDate).length > 0 && (
                <View style={styles.tooltip}>
                  <View style={styles.tooltipHeader}>
                    <Text style={styles.tooltipDate}>
                      {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }
                      )}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedDate(null)}>
                      <Text style={styles.tooltipClose}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tooltipContent}>
                    {getHabitsForDate(selectedDate).map((habit) => (
                      <View key={habit.id} style={styles.tooltipItem}>
                        <View
                          style={[
                            styles.tooltipDot,
                            { backgroundColor: habit.color },
                          ]}
                        />
                        <Text style={styles.tooltipText}>{habit.title}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4c1d95",
    textAlign: "center",
    marginBottom: 16,
  },
  calendar: {
    borderRadius: 6,
    elevation: 2,
    backgroundColor: "white",
  },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { color: "#6b7280" },
  tooltip: {
    marginTop: 12,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  tooltipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tooltipDate: {
    fontSize: 16,
    fontWeight: "700",
    color: "#4c1d95",
  },
  tooltipClose: {
    fontSize: 20,
    fontWeight: "600",
    color: "#6b7280",
  },
  tooltipContent: {
    gap: 8,
  },
  tooltipItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  tooltipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  tooltipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
  },
});
