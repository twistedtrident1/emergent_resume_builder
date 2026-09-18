import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

type Step = {
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  sense: string;
  prompt: string;
};

const STEPS: Step[] = [
  { icon: "eye-outline", count: 5, sense: "see", prompt: "Notice 5 things you can see around you. Take your time." },
  { icon: "hand-left-outline", count: 4, sense: "touch", prompt: "Find 4 things you can feel — your feet, fabric, the floor." },
  { icon: "ear-outline", count: 3, sense: "hear", prompt: "Listen for 3 sounds. They can be close or far away." },
  { icon: "flower-outline", count: 2, sense: "smell", prompt: "Notice 2 scents — even faint ones count." },
  { icon: "happy-outline", count: 1, sense: "taste", prompt: "Notice 1 taste, even just the inside of your mouth." },
];

export default function SensoryScreen() {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);

  const step = STEPS[idx];

  const next = () => {
    if (idx < STEPS.length - 1) setIdx(idx + 1);
    else setDone(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="sensory-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="sensory-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.progress}>
          {done ? "Complete" : `${idx + 1} of ${STEPS.length}`}
        </Text>
      </View>

      {done ? (
        <View style={styles.center}>
          <View style={[styles.bigCircle, { backgroundColor: colors.accent }]}>
            <Ionicons name="heart" size={42} color={colors.surface} />
          </View>
          <Text style={styles.title}>You&apos;re here.</Text>
          <Text style={styles.body}>
            That&apos;s the whole exercise. Notice how your body feels now compared
            to when you started.
          </Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={() => router.back()}
            testID="sensory-done"
          >
            <Text style={styles.ctaText}>Done</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={styles.bigCircle}>
            <Ionicons name={step.icon} size={42} color={colors.surface} />
          </View>
          <Text style={styles.count} testID="sensory-count">{step.count}</Text>
          <Text style={styles.title} testID="sensory-sense">
            things you can <Text style={styles.titleAccent}>{step.sense}</Text>
          </Text>
          <Text style={styles.body}>{step.prompt}</Text>
          <TouchableOpacity
            style={styles.cta}
            onPress={next}
            testID="sensory-next"
          >
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
  bigCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  count: {
    fontSize: 72,
    fontWeight: "800",
    color: colors.textPrimary,
    lineHeight: 78,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.textPrimary,
    textAlign: "center",
  },
  titleAccent: { color: colors.accent, fontWeight: "700" },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 320,
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
