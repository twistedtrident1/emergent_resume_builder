import { useEffect, useRef } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing } from "@/src/theme";

const CONFETTI_COUNT = 14;
const CONFETTI_COLORS = [colors.primary, colors.accent, "#E9C46A", "#A8C7BB"];

type Props = {
  visible: boolean;
  streak: number;
  totalDoneToday: number;
  onClose: () => void;
};

function Confetti({ delay }: { delay: number }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  const dx = (Math.random() - 0.5) * 240;
  const dy = -(160 + Math.random() * 160);
  const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
  const size = 8 + Math.random() * 6;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 120,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: dx,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: dy,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(rotate, {
          toValue: 1,
          duration: 1100,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delay, dx, dy, opacity, rotate, translateX, translateY]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", `${Math.random() > 0.5 ? 540 : -540}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateX }, { translateY }, { rotate: spin }],
      }}
    />
  );
}

export function Celebration({ visible, streak, totalDoneToday, onClose }: Props) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      scale.setValue(0.4);
      opacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, scale, opacity]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="celebration-overlay">
        <View style={styles.confettiHost} pointerEvents="none">
          {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
            <Confetti key={i} delay={i * 30} />
          ))}
        </View>
        <Animated.View
          style={[styles.card, { opacity, transform: [{ scale }] }]}
          testID="celebration-card"
        >
          <View style={styles.flameWrap}>
            <Ionicons name="flame" size={42} color={colors.accent} />
          </View>
          <Text style={styles.title}>You did it.</Text>
          <Text style={styles.body}>
            All {totalDoneToday} task{totalDoneToday === 1 ? "" : "s"} complete today.
          </Text>
          <View style={styles.streakPill} testID="celebration-streak">
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text style={styles.streakText}>
              {streak} day{streak === 1 ? "" : "s"} in a row
            </Text>
          </View>
          <Pressable
            style={styles.cta}
            onPress={onClose}
            testID="celebration-close"
          >
            <Text style={styles.ctaText}>Thanks</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(44,62,56,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  confettiHost: {
    position: "absolute",
    top: "45%",
    left: "50%",
    width: 0,
    height: 0,
  },
  card: {
    width: "84%",
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
  },
  flameWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(224, 122, 95, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(224, 122, 95, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(224, 122, 95, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(224, 122, 95, 0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginTop: spacing.xs,
  },
  streakText: {
    color: colors.accent,
    fontWeight: "700",
    fontSize: 14,
  },
  cta: {
    marginTop: spacing.md,
    backgroundColor: colors.textPrimary,
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: radius.lg,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaText: {
    color: colors.surface,
    fontWeight: "700",
    fontSize: 15,
  },
});
