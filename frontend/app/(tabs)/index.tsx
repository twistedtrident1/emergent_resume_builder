import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/contexts/AuthContext";
import { getForgottenSuggestions } from "@/src/utils/forgetting";
import { colors, radius, spacing } from "@/src/theme";

type TaskItem = {
  id: string;
  title: string;
  notes?: string | null;
  recurring: boolean;
  date?: string | null;
  completed: boolean;
};

type DailyContent = { date: string; joke: string; fact: string };
type Streak = { date: string; streak: number; today_completed: boolean };

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prettyDate(): string {
  const d = new Date();
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function TodayScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const date = useMemo(() => todayStr(), []);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [content, setContent] = useState<DailyContent | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, s] = await Promise.all([
        api<TaskItem[]>(`/tasks?date=${date}`),
        api<Streak>(`/streak?date=${date}`),
      ]);
      setTasks(t);
      setStreak(s);
    } catch (e) {
      console.warn("load tasks failed", e);
    }
  }, [date]);

  const loadContent = useCallback(async (force = false) => {
    setContentLoading(true);
    try {
      const c = await api<DailyContent>(`/daily-content?date=${date}${force ? "&force=true" : ""}`);
      setContent(c);
    } catch (e) {
      console.warn("load content failed", e);
    } finally {
      setContentLoading(false);
    }
  }, [date]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([load(), loadContent()]);
      setLoading(false);
    })();
  }, [load, loadContent]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), loadContent(true)]);
    setRefreshing(false);
  }, [load, loadContent]);

  const done = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const forgetting = useMemo(() => {
    const recurringTitles = tasks.filter((t) => t.recurring).map((t) => t.title);
    return getForgottenSuggestions(recurringTitles);
  }, [tasks]);

  const quickAddForgotten = async (title: string) => {
    try {
      const created = await api<TaskItem>("/tasks", {
        method: "POST",
        body: { title, recurring: true },
      });
      setTasks((prev) => [...prev, created]);
    } catch (e) {
      console.warn("quick add failed", e);
    }
  };

  const openRandomGrounding = () => {
    const routes = [
      "/grounding/breathing",
      "/grounding/sensory",
      "/grounding/body-scan",
      "/grounding/color-hunt",
      "/grounding/categories",
    ];
    const r = routes[Math.floor(Math.random() * routes.length)];
    router.push(r as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="today-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <Text style={styles.tag} testID="today-tag">{prettyDate().toUpperCase()}</Text>
        <Text style={styles.greeting} testID="today-greeting">
          Hello, {user?.name?.split(" ")[0] ?? "there"}.
        </Text>
        <Text style={styles.sub} testID="today-sub">
          Let&apos;s take it one gentle step at a time.
        </Text>

        {/* Streak insight */}
        {streak && streak.streak > 0 ? (
          <View style={styles.streakCard} testID="streak-card">
            <View style={styles.streakIcon}>
              <Ionicons name="flame" size={22} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakNum} testID="streak-value">
                {streak.streak} day{streak.streak === 1 ? "" : "s"}
              </Text>
              <Text style={styles.streakLabel}>
                {streak.today_completed
                  ? "Nice — you kept the streak alive."
                  : "Finish one task today to keep it going."}
              </Text>
            </View>
          </View>
        ) : streak && !streak.today_completed ? (
          <View style={styles.streakCard} testID="streak-card-empty">
            <View style={styles.streakIcon}>
              <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.streakNum}>Fresh start</Text>
              <Text style={styles.streakLabel}>
                Complete one task today to begin a streak.
              </Text>
            </View>
          </View>
        ) : null}

        {/* Progress card */}
        <View style={styles.progressCard} testID="today-progress-card">
          <View style={styles.progressTop}>
            <View>
              <Text style={styles.progressLabel}>TODAY&apos;S PROGRESS</Text>
              <Text style={styles.progressValue}>
                {done} / {total} <Text style={styles.progressUnit}>done</Text>
              </Text>
            </View>
            <View style={styles.pctPill}>
              <Text style={styles.pctText}>{pct}%</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${pct}%` }]} />
          </View>
        </View>

        {/* You-might-be-forgetting smart card */}
        {forgetting.items.length > 0 ? (
          <View style={styles.forgetCard} testID="forgetting-card">
            <View style={styles.forgetHeader}>
              <Ionicons name="bulb" size={18} color={colors.accent} />
              <Text style={styles.forgetLabel}>
                YOU MIGHT BE FORGETTING — {forgetting.label.toUpperCase()}
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {forgetting.items.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.forgetItem}
                  onPress={() => quickAddForgotten(s)}
                  testID={`forget-add-${s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                >
                  <Ionicons name="add-circle" size={20} color={colors.primary} />
                  <Text style={styles.forgetItemText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : null}

        {/* Tools row — Brain dump, Brain reset, Wind-down */}
        <View style={styles.toolsRow}>
          <TouchableOpacity
            style={styles.toolCard}
            onPress={() => router.push("/brain-dump")}
            testID="today-brain-dump"
          >
            <Ionicons name="cloud-outline" size={20} color={colors.primary} />
            <Text style={styles.toolCardTitle}>Brain dump</Text>
            <Text style={styles.toolCardSub}>Capture stray thoughts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolCard}
            onPress={openRandomGrounding}
            testID="today-brain-reset"
          >
            <Ionicons name="refresh-circle-outline" size={20} color={colors.accent} />
            <Text style={styles.toolCardTitle}>Brain reset</Text>
            <Text style={styles.toolCardSub}>Random grounding</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolCard}
            onPress={() => router.push("/checkin")}
            testID="today-checkin"
          >
            <Ionicons name="moon-outline" size={20} color="#5B7CA8" />
            <Text style={styles.toolCardTitle}>Wind-down</Text>
            <Text style={styles.toolCardSub}>Evening check-in</Text>
          </TouchableOpacity>
        </View>

        {/* Joke & Fact */}
        <View style={styles.contentCard} testID="daily-joke-card">
          <View style={styles.contentHeader}>
            <Ionicons name="happy-outline" size={18} color={colors.primary} />
            <Text style={styles.contentLabel}>DAILY JOKE</Text>
          </View>
          {contentLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          ) : (
            <Text style={styles.contentText} testID="daily-joke-text">
              {content?.joke ?? "—"}
            </Text>
          )}
        </View>

        <View style={[styles.contentCard, { backgroundColor: "rgba(224, 122, 95, 0.08)", borderColor: "rgba(224, 122, 95, 0.25)" }]} testID="daily-fact-card">
          <View style={styles.contentHeader}>
            <Ionicons name="sparkles-outline" size={18} color={colors.accent} />
            <Text style={[styles.contentLabel, { color: colors.accent }]}>DID YOU KNOW?</Text>
          </View>
          {contentLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} />
          ) : (
            <Text style={styles.contentText} testID="daily-fact-text">
              {content?.fact ?? "—"}
            </Text>
          )}
        </View>

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionPrimary}
            onPress={() => router.push("/(tabs)/tasks")}
            testID="today-plan-cta"
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.surface} />
            <Text style={styles.actionPrimaryText}>Plan tasks</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionSecondary}
            onPress={() => router.push("/(tabs)/grounding")}
            testID="today-ground-cta"
          >
            <Ionicons name="leaf-outline" size={20} color={colors.primary} />
            <Text style={styles.actionSecondaryText}>Ground</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  tag: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  greeting: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  sub: {
    fontSize: 15,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  progressLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.textSecondary,
    fontWeight: "600",
    marginBottom: 4,
  },
  progressValue: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  progressUnit: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.textSecondary,
  },
  pctPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  pctText: {
    color: colors.primary,
    fontWeight: "700",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 999,
  },
  contentCard: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoftBorder,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  contentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: spacing.sm,
  },
  contentLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: colors.primary,
    fontWeight: "700",
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  actionPrimary: {
    flex: 1,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
  },
  actionPrimaryText: {
    color: colors.surface,
    fontWeight: "600",
    fontSize: 15,
  },
  actionSecondary: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionSecondaryText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: 15,
  },
  streakCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(224, 122, 95, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(224, 122, 95, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  streakNum: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  streakLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  forgetCard: {
    backgroundColor: "rgba(224, 122, 95, 0.08)",
    borderColor: "rgba(224, 122, 95, 0.25)",
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  forgetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  forgetLabel: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.accent,
    fontWeight: "700",
    flex: 1,
  },
  forgetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
  },
  forgetItemText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  toolsRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  toolCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    gap: 4,
    minHeight: 88,
  },
  toolCardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textPrimary,
    marginTop: 2,
  },
  toolCardSub: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
});
