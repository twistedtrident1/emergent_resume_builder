import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { storage } from "@/src/utils/storage";
import { colors, radius, spacing } from "@/src/theme";

type Prompt = {
  q: string;
  helper: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const PROMPTS: Prompt[] = [
  {
    q: "Evening meds taken?",
    helper: "If you take any. If you already did, just say yes.",
    icon: "medkit-outline",
  },
  {
    q: "Phone charging where you'll see it?",
    helper: "So tomorrow's alarm and brain dump are with you.",
    icon: "battery-charging-outline",
  },
  {
    q: "Clothes ready for tomorrow?",
    helper: "Even just picking the shirt is enough.",
    icon: "shirt-outline",
  },
  {
    q: "Alarm set?",
    helper: "Or do you not need one tomorrow? Either is fine.",
    icon: "alarm-outline",
  },
  {
    q: "Anything still weighing on you?",
    helper: "If yes — the brain dump can hold it until morning.",
    icon: "cloud-outline",
  },
];

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CheckinScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<string[]>([]);

  const finish = async (final: string[]) => {
    await storage.setItem("last_checkin_date", todayStr());
    setAnswers(final);
    setDone(true);
  };

  const respond = (a: "yes" | "skip" | "brain-dump") => {
    const final = [...answers, a];
    if (a === "brain-dump") {
      // jump to brain dump immediately, keep state so coming back continues
      router.replace("/brain-dump");
      return;
    }
    if (idx < PROMPTS.length - 1) {
      setAnswers(final);
      setIdx(idx + 1);
    } else {
      finish(final);
    }
  };

  const step = PROMPTS[idx];
  const yesCount = answers.filter((a) => a === "yes").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="checkin-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="checkin-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.progress}>
          {done ? "Complete" : `${idx + 1} of ${PROMPTS.length}`}
        </Text>
      </View>

      {done ? (
        <View style={styles.center}>
          <View style={[styles.circle, { backgroundColor: "#5B7CA8" }]}>
            <Ionicons name="moon" size={42} color={colors.surface} />
          </View>
          <Text style={styles.title}>Sleep well.</Text>
          <Text style={styles.body}>
            {yesCount >= 3
              ? "You set future-you up gently. Nothing else to do."
              : "You showed up. That counts. Future-you will figure out the rest."}
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.back()} testID="checkin-done">
            <Text style={styles.ctaText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.circle}>
            <Ionicons name={step.icon} size={36} color={colors.surface} />
          </View>
          <View style={styles.dots}>
            {PROMPTS.map((_, i) => (
              <View key={i} style={[styles.dot, i <= idx && styles.dotActive]} />
            ))}
          </View>
          <Text style={styles.title} testID="checkin-prompt">{step.q}</Text>
          <Text style={styles.body}>{step.helper}</Text>

          <View style={styles.buttons}>
            <TouchableOpacity
              style={styles.primary}
              onPress={() => respond("yes")}
              testID="checkin-yes"
            >
              <Ionicons name="checkmark" size={20} color={colors.surface} />
              <Text style={styles.primaryText}>Yes / Done</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondary}
              onPress={() => respond("skip")}
              testID="checkin-skip"
            >
              <Text style={styles.secondaryText}>Skip — not tonight</Text>
            </TouchableOpacity>
            {idx === PROMPTS.length - 1 ? (
              <TouchableOpacity
                onPress={() => respond("brain-dump")}
                testID="checkin-braindump"
                style={styles.linkBtn}
              >
                <Ionicons name="cloud-outline" size={14} color={colors.primary} />
                <Text style={styles.linkText}>Open brain dump</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  progress: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  circle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.primary },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 30,
    paddingHorizontal: spacing.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
  },
  buttons: { width: "100%", gap: spacing.sm, marginTop: spacing.lg, alignItems: "center" },
  primary: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 36,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 220,
  },
  primaryText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  secondary: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  secondaryText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
  cta: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 48,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  ctaText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  linkBtn: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 6 },
  linkText: { color: colors.primary, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
});
