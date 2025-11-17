import React, { JSX, useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../_layout";

type Habit = {
  id: string;
  title: string;
  description?: string | null;
  created_at?: string | null;
  streak?: number; // added optional streak
};

type HabitLog = {
  id: string;
  habit_id: string;
  user_id: string;
  day: string; // YYYY-MM-DD
  completed: boolean;
};

type MarkedDates = {
  [date: string]: {
    selected?: boolean;
    selectedColor?: string;
    marked?: boolean;
    dotColor?: string;
  };
};

export default function StatsScreen(): JSX.Element {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState<string | null>(null);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [calendarLoading, setCalendarLoading] = useState<boolean>(false);

  // Load habits (now fetches streak for each habit and sorts by highest streak)
  const loadHabits = useCallback(async () => {
    if (!userId) {
      setHabits([]);
      setSelectedHabitId(null);
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

      // fetch streak for each habit using your existing RPC
      const withStreaks = await Promise.all(
        rows.map(async (h: any) => {
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
            } as Habit;
          } catch (rpcCatchErr) {
            console.error("RPC catch error:", rpcCatchErr);
            return {
              ...h,
              streak: 0,
            } as Habit;
          }
        })
      );

      // sort by streak desc (highest first). keep stable sort if equal (by created_at)
      withStreaks.sort((a, b) => (b.streak ?? 0) - (a.streak ?? 0));

      setHabits(withStreaks);

      // if nothing selected, pick first (highest streak)
      if (withStreaks.length > 0 && !selectedHabitId) {
        setSelectedHabitId(withStreaks[0].id);
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load habits.");
    } finally {
      setLoading(false);
    }
  }, [userId, selectedHabitId]);

  // Load logs for the selected habit (only completed entries)
  const loadLogs = useCallback(
    async (habitId: string | null) => {
      if (!habitId || !userId) {
        setLogs([]);
        return;
      }

      setCalendarLoading(true);
      try {
        const { data, error } = await supabase
          .from("habit_logs")
          .select("id, habit_id, user_id, day, completed")
          .eq("user_id", userId)
          .eq("habit_id", habitId)
          .eq("completed", true)
          .order("day", { ascending: true });

        if (error) throw error;

        setLogs(data || []);
      } catch (err) {
        console.error(err);
        Alert.alert("Error", "Failed to load logs.");
      } finally {
        setCalendarLoading(false);
      }
    },
    [userId]
  );

  // Initial load
  useEffect(() => {
    loadHabits();
  }, [loadHabits]);

  // Reload logs when selected habit changes
  useEffect(() => {
    if (selectedHabitId) loadLogs(selectedHabitId);
    else setLogs([]);
  }, [selectedHabitId, loadLogs]);

  // Build marked dates for calendar (read-only)
  const markedDates = useMemo<MarkedDates>(() => {
    const out: MarkedDates = {};
    logs.forEach((log) => {
      if (log.day)
        out[log.day] = {
          selected: true,
          selectedColor: "#16a34a",
          marked: true,
          dotColor: "#16a34a",
        };
    });
    return out;
  }, [logs]);

  // === Current streak (counts only when latest completed day is today OR yesterday grace)
  const computeCurrentStreakEndingToday = (logsList: HabitLog[]): number => {
    if (!logsList || logsList.length === 0) return 0;

    const uniqueDays = Array.from(new Set(logsList.map((l) => l.day))).sort();

    const today = new Date().toISOString().slice(0, 10);

    // helper to walk backwards consecutive days
    const countStreak = (days: string[], startIndex: number) => {
      let streak = 1;
      for (let i = startIndex; i > 0; i--) {
        const cur = new Date(days[i]);
        const prev = new Date(days[i - 1]);
        const diff = Math.round(
          (cur.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff === 1) streak++;
        else break;
      }
      return streak;
    };

    // check if today completed
    if (uniqueDays.includes(today)) {
      const lastIndex = uniqueDays.length - 1;
      return countStreak(uniqueDays, lastIndex);
    }

    // 1-day grace: if yesterday completed, count streak ending yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (!uniqueDays.includes(yesterday)) return 0;
    const yIndex = uniqueDays.indexOf(yesterday);
    return countStreak(uniqueDays, yIndex);
  };

  const streakCount = useMemo(() => computeCurrentStreakEndingToday(logs), [logs]);

  const renderHabitItem = ({ item }: { item: Habit }) => {
    const selected = item.id === selectedHabitId;
    return (
      <TouchableOpacity
        onPress={() => setSelectedHabitId(item.id)}
        style={[styles.habitChip, selected && styles.habitChipSelected]}
      >
        <Text style={[styles.habitChipText, selected && styles.habitChipTextSel]}>
          {item.title}
        </Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7C3AED" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>📅 Habit Progress</Text>

      {habits.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No habits yet. Add one to track progress.</Text>
        </View>
      ) : (
        <>
          {/* Habits List */}
          <View style={{ height: 64 }}>
            <FlatList
              data={habits}
              keyExtractor={(h) => h.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              renderItem={renderHabitItem}
              contentContainerStyle={{ paddingHorizontal: 8, alignItems: "center" }}
            />
          </View>

          {/* Streak Count (only counts if today completed or yesterday grace) */}
          <Text style={styles.streakText}>🔥 Streak: {streakCount} days</Text>

          <View style={{ marginTop: 12 }}>
            {calendarLoading ? (
              <ActivityIndicator size="large" color="#7C3AED" />
            ) : (
              <Calendar
                markingType="multi-dot"
                markedDates={markedDates}
                onDayPress={() => {}} // read-only
                theme={{
                  selectedDayBackgroundColor: "#16a34a",
                  todayTextColor: "#7C3AED",
                  arrowColor: "#7C3AED",
                  monthTextColor: "#4c1d95",
                }}
                style={styles.calendar}
              />
            )}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "transparent" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heading: {
    fontSize: 22,
    fontWeight: "700",
    color: "#4c1d95",
    textAlign: "center",
  },
  streakText: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: "600",
    color: "#16a34a",
    textAlign: "center",
  },
  habitChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    marginRight: 10,
  },
  habitChipSelected: { backgroundColor: "#7C3AED" },
  habitChipText: { color: "#111827", fontWeight: "600" },
  habitChipTextSel: { color: "white" },
  calendar: {
    borderRadius: 14,
    elevation: 2,
    backgroundColor: "white",
  },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { color: "#6b7280" },
});
