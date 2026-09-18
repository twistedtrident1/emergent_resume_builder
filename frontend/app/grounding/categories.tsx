import { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

const PROMPTS: string[] = [
  "5 fruits",
  "5 cities you've visited",
  "5 animals starting with the letter A",
  "5 songs that make you happy",
  "5 things in your kitchen",
  "5 colors in nature",
  "5 books or movies you've enjoyed",
  "5 hobbies (yours or other people's)",
  "5 things you can buy at a grocery store",
  "5 sports or games",
  "5 jobs you've thought about",
  "5 places you'd like to see one day",
  "5 things that smell good",
  "5 sounds that are calming",
  "5 board games or card games",
];

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function CategoriesScreen() {
  const router = useRouter();
  const deck = useMemo(() => shuffle(PROMPTS), []);
  const [idx, setIdx] = useState(0);
  const [completed, setCompleted] = useState(0);

  const next = () => {
    setCompleted((c) => c + 1);
    setIdx((i) => (i + 1) % deck.length);
  };

  const skip = () => {
    setIdx((i) => (i + 1) % deck.length);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="categories-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="categories-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.progress}>
          {completed} done
        </Text>
      </View>

      <View style={styles.center}>
        <View style={styles.circle}>
          <Ionicons name="bulb-outline" size={42} color={colors.surface} />
        </View>
        <Text style={styles.tag}>NAME</Text>
        <Text style={styles.title} testID="categories-prompt">
          {deck[idx]}
        </Text>
        <Text style={styles.body}>
          Out loud or in your head — slow is fine. The point isn&apos;t to win,
          it&apos;s to give your mind something kind to do.
        </Text>

        <TouchableOpacity style={styles.cta} onPress={next} testID="categories-done">
          <Ionicons name="checkmark" size={20} color={colors.surface} />
          <Text style={styles.ctaText}>I&apos;ve got five</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={skip} testID="categories-skip">
          <Text style={styles.skipText}>Skip — give me a different one</Text>
        </TouchableOpacity>
      </View>
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
  tag: {
    fontSize: 11,
    letterSpacing: 3,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: colors.textPrimary,
    textAlign: "center",
    lineHeight: 34,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 340,
  },
  cta: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 36,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  ctaText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  skipText: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: "underline",
    marginTop: spacing.sm,
  },
});
