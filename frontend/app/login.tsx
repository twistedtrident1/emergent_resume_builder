import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useAuth } from "@/src/contexts/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

export default function LoginScreen() {
  const { signIn, authError } = useAuth();
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    setBusy(true);
    try {
      await signIn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.container} testID="login-screen">
        <View style={styles.hero}>
          <View style={styles.logoCircle} testID="login-logo">
            <Ionicons name="leaf-outline" size={42} color={colors.primary} />
          </View>
          <Text style={styles.tag} testID="login-tag">GROUNDED · DAILY</Text>
          <Text style={styles.title} testID="login-title">Calm your day,{"\n"}one step at a time.</Text>
          <Text style={styles.subtitle} testID="login-subtitle">
            A gentle planner built for ADHD minds — with grounding tools,
            recurring routines, and a daily dose of joy.
          </Text>
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            style={[styles.signInBtn, busy && { opacity: 0.6 }]}
            onPress={onPress}
            disabled={busy}
            testID="login-google-button"
          >
            {busy ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <>
                <Ionicons name="logo-google" size={20} color={colors.surface} />
                <Text style={styles.signInText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.footnote}>
            We only use your name and email to personalize your planner.
          </Text>
          {authError ? <Text style={styles.error}>{authError}</Text> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: "space-between",
  },
  hero: { marginTop: spacing.xl * 2, alignItems: "flex-start" },
  logoCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primarySoftBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  tag: {
    fontSize: 12,
    letterSpacing: 3,
    color: colors.textSecondary,
    fontWeight: "500",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  bottom: { paddingBottom: spacing.lg },
  signInBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    paddingVertical: 18,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    minHeight: 56,
  },
  signInText: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  footnote: {
    textAlign: "center",
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.md,
  },
  error: {
    color: colors.accent,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: spacing.md,
  },
});
