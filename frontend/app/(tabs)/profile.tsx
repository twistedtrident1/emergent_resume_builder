import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";

import { api } from "@/src/api/client";
import { useAuth } from "@/src/contexts/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

type Streak = { streak: number; best_streak: number; today_completed: boolean };

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [busy, setBusy] = useState(false);
  const [streak, setStreak] = useState<Streak | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await api<Streak>(`/streak?date=${todayStr()}`);
        setStreak(s);
      } catch {
        /* noop */
      }
    })();
  }, []);

  const onLogout = async () => {
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="profile-screen">
      <View style={styles.container}>
        <Text style={styles.tag}>YOUR ACCOUNT</Text>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            {user?.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Ionicons name="person" size={28} color={colors.primary} />
              </View>
            )}
          </View>
          <Text style={styles.name} testID="profile-name">{user?.name ?? "Friend"}</Text>
          <Text style={styles.email} testID="profile-email">{user?.email ?? ""}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard} testID="profile-stat-current">
            <View style={styles.statIcon}>
              <Ionicons name="flame" size={18} color={colors.accent} />
            </View>
            <Text style={styles.statValue}>{streak?.streak ?? 0}</Text>
            <Text style={styles.statLabel}>Current streak</Text>
          </View>
          <View style={styles.statCard} testID="profile-stat-best">
            <View style={[styles.statIcon, { backgroundColor: colors.primarySoft, borderColor: colors.primarySoftBorder }]}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
            </View>
            <Text style={styles.statValue} testID="profile-best-value">{streak?.best_streak ?? 0}</Text>
            <Text style={styles.statLabel}>Lifetime best</Text>
          </View>
        </View>

        <View style={styles.about}>
          <Text style={styles.aboutTitle}>About Grounded · Daily</Text>
          <Text style={styles.aboutBody}>
            A gentle planner designed with ADHD in mind. Tasks repeat when you
            need a steady routine, completion is always a tap-with-intent, and
            grounding tools are one breath away.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.logoutBtn, busy && { opacity: 0.6 }]}
          onPress={onLogout}
          disabled={busy}
          testID="logout-btn"
        >
          {busy ? (
            <ActivityIndicator color={colors.error} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={colors.error} />
              <Text style={styles.logoutText}>Sign out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, gap: spacing.md },
  tag: { fontSize: 11, letterSpacing: 2, color: colors.textSecondary, fontWeight: "500" },
  title: { fontSize: 30, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs, marginBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrap: { marginBottom: spacing.md },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  avatarFallback: {
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  name: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  about: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
  },
  aboutTitle: { fontSize: 14, fontWeight: "700", color: colors.primary, marginBottom: 6, letterSpacing: 0.5 },
  aboutBody: { fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "flex-start",
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(224, 122, 95, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(224, 122, 95, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  logoutBtn: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 16,
    minHeight: 56,
  },
  logoutText: { color: colors.error, fontWeight: "600", fontSize: 15 },
});
