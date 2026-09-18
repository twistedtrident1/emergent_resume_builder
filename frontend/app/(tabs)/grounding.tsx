import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors, radius, spacing } from "@/src/theme";

type Tool = {
  key: string;
  title: string;
  body: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  bg: string;
  fg: string;
  testID: string;
};

const TOOLS: Tool[] = [
  {
    key: "breathing",
    title: "Box breathing",
    body: "Inhale 4 · hold 4 · exhale 4 · hold 4. Visual breath to settle your nervous system.",
    icon: "ellipse-outline",
    route: "/grounding/breathing",
    bg: colors.primary,
    fg: colors.surface,
    testID: "grounding-breathing-card",
  },
  {
    key: "sensory",
    title: "5-4-3-2-1 senses",
    body: "Notice 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste.",
    icon: "eye-outline",
    route: "/grounding/sensory",
    bg: colors.accent,
    fg: colors.surface,
    testID: "grounding-sensory-card",
  },
  {
    key: "body-scan",
    title: "Body scan",
    body: "Gentle head-to-toe check-in. Let each part of you soften.",
    icon: "body-outline",
    route: "/grounding/body-scan",
    bg: "#5B7CA8",
    fg: colors.surface,
    testID: "grounding-body-scan-card",
  },
  {
    key: "color-hunt",
    title: "Color hunt",
    body: "Pick a color, find 5 things around you. Easy and visual.",
    icon: "color-palette-outline",
    route: "/grounding/color-hunt",
    bg: "#E9C46A",
    fg: "#2C3E38",
    testID: "grounding-color-hunt-card",
  },
  {
    key: "categories",
    title: "Name 5 things",
    body: "Cognitive prompts like \"5 fruits\" or \"5 cities\" to slow a racing mind.",
    icon: "bulb-outline",
    route: "/grounding/categories",
    bg: "#8C7BA8",
    fg: colors.surface,
    testID: "grounding-categories-card",
  },
];

export default function GroundingMenu() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top"]} testID="grounding-menu">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.tag}>WHEN THINGS FEEL LOUD</Text>
        <Text style={styles.title}>Grounding</Text>
        <Text style={styles.sub}>
          Five gentle ways to come back to your body. Pick whichever feels
          right today — you can switch any time.
        </Text>

        {TOOLS.map((tool) => (
          <TouchableOpacity
            key={tool.key}
            style={[styles.card, { backgroundColor: tool.bg }]}
            onPress={() => router.push(tool.route as never)}
            testID={tool.testID}
          >
            <View style={styles.cardRow}>
              <View style={[styles.iconCircle, tool.fg === colors.surface ? styles.iconCircleLight : styles.iconCircleDark]}>
                <Ionicons name={tool.icon} size={24} color={tool.fg} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.cardTitle, { color: tool.fg }]}>{tool.title}</Text>
                <Text
                  style={[styles.cardBody, { color: tool.fg === colors.surface ? "rgba(255,255,255,0.85)" : "rgba(44,62,56,0.7)" }]}
                  numberOfLines={2}
                >
                  {tool.body}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={tool.fg} />
            </View>
          </TouchableOpacity>
        ))}

        <View style={styles.tip}>
          <Ionicons name="heart-outline" size={18} color={colors.primary} />
          <Text style={styles.tipText}>
            There&apos;s no goal — just notice. Be kind to whatever you find.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  tag: { fontSize: 11, letterSpacing: 2, color: colors.textSecondary, fontWeight: "500" },
  title: { fontSize: 30, fontWeight: "700", color: colors.textPrimary, marginTop: spacing.xs },
  sub: { color: colors.textSecondary, fontSize: 15, lineHeight: 22, marginBottom: spacing.sm },
  card: {
    borderRadius: 22,
    padding: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleLight: { backgroundColor: "rgba(255,255,255,0.2)" },
  iconCircleDark: { backgroundColor: "rgba(44,62,56,0.10)" },
  cardTitle: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  cardBody: { fontSize: 13, lineHeight: 18 },
  tip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    marginTop: spacing.sm,
  },
  tipText: { color: colors.textPrimary, fontSize: 13, flex: 1, lineHeight: 18 },
});
