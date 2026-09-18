import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

type ColorChoice = {
  key: string;
  label: string;
  swatch: string;
};

const COLORS: ColorChoice[] = [
  { key: "green", label: "Green", swatch: "#6B8E82" },
  { key: "blue", label: "Blue", swatch: "#5B7CA8" },
  { key: "red", label: "Red", swatch: "#C95E5E" },
  { key: "yellow", label: "Yellow", swatch: "#E9C46A" },
  { key: "orange", label: "Orange", swatch: "#E07A5F" },
  { key: "purple", label: "Purple", swatch: "#8C7BA8" },
  { key: "brown", label: "Brown", swatch: "#8C6F5A" },
  { key: "white", label: "White", swatch: "#F4F2EE" },
  { key: "black", label: "Black", swatch: "#2C3E38" },
];

const TARGET = 5;

export default function ColorHuntScreen() {
  const router = useRouter();
  const [chosen, setChosen] = useState<ColorChoice | null>(null);
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  const reset = () => {
    setChosen(null);
    setCount(0);
    setDone(false);
  };

  const tap = () => {
    if (!chosen) return;
    const n = Math.min(count + 1, TARGET);
    setCount(n);
    if (n >= TARGET) setDone(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="color-hunt-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="color-hunt-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.progress}>
          {done ? "Complete" : chosen ? `${count} of ${TARGET}` : "Pick a color"}
        </Text>
      </View>

      {!chosen ? (
        <View style={styles.center}>
          <View style={styles.circle}>
            <Ionicons name="color-palette-outline" size={42} color={colors.surface} />
          </View>
          <Text style={styles.title}>Pick a color</Text>
          <Text style={styles.body}>
            We&apos;ll go looking for it together. Choose whichever feels good.
          </Text>
          <View style={styles.swatchGrid}>
            {COLORS.map((c) => (
              <TouchableOpacity
                key={c.key}
                onPress={() => setChosen(c)}
                style={styles.swatchWrap}
                testID={`color-${c.key}`}
              >
                <View
                  style={[
                    styles.swatch,
                    { backgroundColor: c.swatch },
                    (c.key === "white") && styles.swatchBordered,
                  ]}
                />
                <Text style={styles.swatchLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : done ? (
        <View style={styles.center}>
          <View style={[styles.circle, { backgroundColor: chosen.swatch }]}>
            <Ionicons
              name="heart"
              size={42}
              color={chosen.key === "white" ? colors.textPrimary : colors.surface}
            />
          </View>
          <Text style={styles.title}>{TARGET} found. You&apos;re here.</Text>
          <Text style={styles.body}>
            Notice how the world looks a little different when you go searching
            for one small thing.
          </Text>
          <View style={styles.row}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={reset} testID="color-hunt-again">
              <Text style={styles.secondaryBtnText}>Go again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cta} onPress={() => router.back()} testID="color-hunt-done">
              <Text style={styles.ctaText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.center}>
          <View style={[styles.circle, { backgroundColor: chosen.swatch }]} />
          <Text style={styles.title}>
            Find <Text style={{ color: chosen.swatch === "#F4F2EE" ? colors.textPrimary : chosen.swatch }}>
              {chosen.label.toLowerCase()}
            </Text>
          </Text>
          <Text style={styles.body}>
            Tap once for each {chosen.label.toLowerCase()} thing you spot.
            No rush.
          </Text>

          <View style={styles.dots}>
            {Array.from({ length: TARGET }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.bigDot,
                  i < count && { backgroundColor: chosen.swatch, borderColor: chosen.swatch },
                ]}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.cta} onPress={tap} testID="color-hunt-tap">
            <Text style={styles.ctaText}>I see one</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={reset} testID="color-hunt-change">
            <Text style={styles.changeText}>Pick a different color</Text>
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
  title: { fontSize: 26, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 340,
  },
  swatchGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: spacing.md,
    marginTop: spacing.md,
    maxWidth: 360,
  },
  swatchWrap: { alignItems: "center", gap: 6, width: 72 },
  swatch: { width: 52, height: 52, borderRadius: 26 },
  swatchBordered: { borderWidth: 1, borderColor: colors.border },
  swatchLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "500" },
  dots: { flexDirection: "row", gap: 10, marginVertical: spacing.md },
  bigDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "transparent",
  },
  cta: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 48,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  ctaText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  changeText: {
    color: colors.textSecondary,
    fontSize: 13,
    textDecorationLine: "underline",
    marginTop: spacing.sm,
  },
  row: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  secondaryBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textPrimary, fontWeight: "600", fontSize: 15 },
});
