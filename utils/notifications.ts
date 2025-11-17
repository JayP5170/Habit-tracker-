import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function registerForPushNotifications() {
  let token;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("habits", {
      name: "Habit Reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#7C3AED",
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      alert("Failed to get push token for push notification!");
      return null;
    }
  } else {
    alert("Must use physical device for Push Notifications");
    return null;
  }

  return true;
}

// Schedule daily reminder notification
export async function scheduleDailyReminder(hour, minute) {
  console.log("📆 [scheduleDailyReminder] Called with:", { hour, minute });

  // 1️⃣ Cancel existing notifications
  console.log("🧹 Clearing existing notifications...");
  await Notifications.cancelAllScheduledNotificationsAsync();
  console.log("✅ Existing notifications cleared");

  const now = new Date();
  console.log("🕒 Current time:", now.toLocaleString());
  const triggerTime = new Date(now);
  triggerTime.setHours(hour, minute, 0, 0);
  console.log("📅 Selected trigger time:", triggerTime.toLocaleString());

  if (triggerTime <= now) {
    triggerTime.setDate(triggerTime.getDate() + 1);
    console.log(
      "⏭️ Time already passed today — scheduling for tomorrow:",
      triggerTime.toLocaleString()
    );
  }

  const secondsUntil = Math.max(
    1,
    Math.ceil((triggerTime.getTime() - now.getTime()) / 1000)
  );
  console.log("⏳ Seconds until trigger:", secondsUntil);

  // 2️⃣ Platform-specific scheduling
  let trigger;
  if (Platform.OS === "android") {
    trigger = { seconds: secondsUntil, repeats: false, type: "timeInterval" };
    console.log("📱 Using timeInterval trigger for Android");
  } else {
    trigger = { hour, minute, repeats: true, type: "calendar" };
    console.log("🍏 Using calendar trigger for iOS");
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "🌈 Time for Your Habits!",
        body: "Don't forget to complete your daily habits today 💪",
        data: { type: "daily_reminder" },
      },
      trigger: trigger,
    });

    console.log("🆔 Notification scheduled successfully:", notificationId);

    // Debug: List all scheduled notifications
    const all = await Notifications.getAllScheduledNotificationsAsync();
    console.log("📋 All scheduled notifications:", all);
  } catch (error) {
    console.error("❌ Failed to schedule notification:", error);
  }
}

// Cancel all scheduled notifications
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Get all scheduled notifications
export async function getScheduledNotifications() {
  return await Notifications.getAllScheduledNotificationsAsync();
}

// Send immediate notification (for testing)
export async function sendTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Test Notification 🔔",
      body: "Your daily reminders are working!",
      data: { type: "test" },
    },
    trigger: { seconds: 1, type: "timeInterval" } as any,
  });
}
