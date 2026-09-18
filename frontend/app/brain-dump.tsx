import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { api } from "@/src/api/client";
import { colors, radius, spacing } from "@/src/theme";

type Thought = {
  id: string;
  text: string;
  created_at: string;
};

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function BrainDumpScreen() {
  const router = useRouter();
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const t = await api<Thought[]>("/thoughts");
      setThoughts(t);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      const created = await api<Thought>("/thoughts", { method: "POST", body: { text: t } });
      setThoughts((prev) => [created, ...prev]);
      setText("");
    } catch (e) {
      console.warn(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setThoughts((prev) => prev.filter((x) => x.id !== id));
    try {
      await api(`/thoughts/${id}`, { method: "DELETE" });
    } catch (e) {
      console.warn(e);
      load();
    }
  };

  const convert = async (t: Thought) => {
    setThoughts((prev) => prev.filter((x) => x.id !== t.id));
    try {
      await api(`/thoughts/${t.id}/convert?date=${todayStr()}`, { method: "POST" });
    } catch (e) {
      console.warn(e);
      load();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="brain-dump-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="brain-dump-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Brain dump</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.tag}>JUST GET IT OUT</Text>
          <Text style={styles.heading}>What&apos;s bouncing around?</Text>
          <Text style={styles.sub}>
            Type anything you don&apos;t want to forget. No judgement, no order. Turn
            any line into a real task with one tap.
          </Text>

          <View style={styles.inputRow}>
            <TextInput
              placeholder="A stray thought…"
              placeholderTextColor={colors.textSecondary}
              value={text}
              onChangeText={setText}
              style={styles.input}
              onSubmitEditing={add}
              returnKeyType="done"
              testID="brain-dump-input"
            />
            <TouchableOpacity
              style={[styles.addBtn, (!text.trim() || saving) && { opacity: 0.5 }]}
              onPress={add}
              disabled={!text.trim() || saving}
              testID="brain-dump-add"
            >
              {saving ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Ionicons name="arrow-up" size={22} color={colors.surface} />
              )}
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : thoughts.length === 0 ? (
            <View style={styles.empty} testID="brain-dump-empty">
              <View style={styles.emptyCircle}>
                <Ionicons name="cloud-outline" size={26} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>A clear sky.</Text>
              <Text style={styles.emptySub}>
                Anything you capture here lives until you turn it into a task or
                delete it.
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {thoughts.map((t) => (
                <View key={t.id} style={styles.row} testID={`thought-row-${t.id}`}>
                  <Ionicons name="ellipse" size={6} color={colors.primary} style={{ marginTop: 8 }} />
                  <Text style={styles.rowText}>{t.text}</Text>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => convert(t)}
                    hitSlop={6}
                    testID={`thought-convert-${t.id}`}
                  >
                    <Ionicons name="checkbox-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => remove(t.id)}
                    hitSlop={6}
                    testID={`thought-delete-${t.id}`}
                  >
                    <Ionicons name="close" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {thoughts.length > 0 ? (
            <Text style={styles.legend}>
              <Ionicons name="checkbox-outline" size={12} color={colors.primary} /> turn into a task ·{" "}
              <Ionicons name="close" size={12} color={colors.textSecondary} /> dismiss
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  topTitle: { fontSize: 16, fontWeight: "700", color: colors.textPrimary },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  tag: { fontSize: 11, letterSpacing: 2, color: colors.textSecondary, fontWeight: "500" },
  heading: { fontSize: 28, fontWeight: "700", color: colors.textPrimary },
  sub: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, marginBottom: spacing.sm },
  inputRow: { flexDirection: "row", gap: spacing.sm, alignItems: "stretch" },
  input: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
  },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowText: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.textPrimary },
  actionBtn: { padding: 6 },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  emptyCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: colors.textPrimary, marginBottom: 6 },
  emptySub: { color: colors.textSecondary, textAlign: "center", fontSize: 14, lineHeight: 20 },
  legend: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
