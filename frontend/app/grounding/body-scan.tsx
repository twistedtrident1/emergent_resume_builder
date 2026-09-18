import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

type Step = {
  part: string;
  prompt: string;
};

const STEPS: Step[] = [
  { part: "Crown", prompt: "Notice the top of your head. Let it soften." },
  { part: "Forehead & eyes", prompt: "Unfurrow your brow. Let your eyes rest." },
  { part: "Jaw & tongue", prompt: "Unclench your jaw. Drop your tongue from the roof of your mouth." },
  { part: "Neck & shoulders", prompt: "Let your shoulders drop away from your ears." },
  { part: "Chest & breath", prompt: "Feel your chest rise and fall. No need to change it." },
  { part: "Arms & hands", prompt: "Loosen your fingers. Let your arms feel heavy." },
  { part: "Belly", prompt: "Allow your belly to soften with each out-breath." },
  { part: "Hips & lower back", prompt: "Let your hips sink. Release the lower back." },
  { part: "Legs", prompt: "Heavy thighs, soft knees, calm calves." },
  { part: "Feet", prompt: "Notice your feet. Feel the ground holding you up." },
];

export default function BodyScanScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  const step = STEPS[idx];

  const next = () => {
    if (idx < STEPS.length - 1) setIdx(idx + 1);
    else setDone(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="body-scan-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="body-scan-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.progress}>
          {done ? "Complete" : `${idx + 1} of ${STEPS.length}`}
        </Text>
      </View>

      {done ? (
        <View style={styles.center}>
          <View style={[styles.circle, { backgroundColor: colors.primary }]}>
            <Ionicons name="checkmark" size={42} color={colors.surface} />
          </View>
          <Text style={styles.title}>You arrived.</Text>
          <Text style={styles.body}>
            Your body has been here the whole time. Notice the difference now.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={() => router.back()} testID="body-scan-done">
            <Text style={styles.ctaText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.circle}>
            <Ionicons name="body-outline" size={42} color={colors.surface} />
          </View>
          {/* Progress dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i <= idx && styles.dotActive]}
              />
            ))}
          </View>
          <Text style={styles.title} testID="body-scan-part">{step.part}</Text>
          <Text style={styles.body}>{step.prompt}</Text>
          <TouchableOpacity style={styles.cta} onPress={next} testID="body-scan-next">
            <Text style={styles.ctaText}>
              {idx === STEPS.length - 1 ? "Finish" : "Next"}
            </Text>
          </TouchableOpacity>
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
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  dots: { flexDirection: "row", gap: 6, marginBottom: spacing.sm },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary },
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 340,
  },
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
});
