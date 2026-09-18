import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

const PHASES = ["Breathe in", "Hold", "Breathe out", "Hold"] as const;
const DURATION_MS = 4000;

export default function BreathingScreen() {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [cycles, setCycles] = useState(0);
  const scale = useRef(new Animated.Value(0.55)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!running) return;
    const phase = phaseIdx % 4;
    const toValue = phase === 0 ? 1 : phase === 2 ? 0.55 : null;

    if (toValue !== null) {
      Animated.timing(scale, {
        toValue,
        duration: DURATION_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }).start();
    }

    timerRef.current = setTimeout(() => {
      setPhaseIdx((p) => {
        const next = p + 1;
        if (next % 4 === 0) setCycles((c) => c + 1);
        return next;
      });
    }, DURATION_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [running, phaseIdx, scale]);

  const start = () => {
    setRunning(true);
    setPhaseIdx(0);
    setCycles(0);
    scale.setValue(0.55);
  };

  const stop = () => {
    setRunning(false);
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.timing(scale, { toValue: 0.55, duration: 300, useNativeDriver: true }).start();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID="breathing-screen">
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} testID="breathing-close">
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.cycleText}>{cycles} cycle{cycles === 1 ? "" : "s"}</Text>
      </View>

      <View style={styles.center}>
        <Animated.View style={[styles.circleOuter, { transform: [{ scale }] }]}>
          <View style={styles.circleInner} />
        </Animated.View>
        <Text style={styles.phase} testID="breathing-phase">
          {running ? PHASES[phaseIdx % 4] : "Ready when you are"}
        </Text>
        <Text style={styles.hint}>
          {running ? "Follow the circle. 4 seconds each." : "Inhale · hold · exhale · hold"}
        </Text>
      </View>

      <View style={styles.bottom}>
        {running ? (
          <TouchableOpacity style={styles.stopBtn} onPress={stop} testID="breathing-stop">
            <Text style={styles.stopText}>Pause</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.startBtn} onPress={start} testID="breathing-start">
            <Text style={styles.startText}>Begin</Text>
          </TouchableOpacity>
        )}
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
  cycleText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg },
  circleOuter: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  circleInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  phase: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  hint: { color: colors.textSecondary, fontSize: 14 },
  bottom: { padding: spacing.lg },
  startBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    minHeight: 56,
  },
  startText: { color: colors.surface, fontWeight: "700", fontSize: 16 },
  stopBtn: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: 18,
    alignItems: "center",
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stopText: { color: colors.textPrimary, fontWeight: "700", fontSize: 16 },
});
