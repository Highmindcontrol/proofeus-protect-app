import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "@/theme/colors";
import { useAuth } from "@/auth/context";
import { PingListenerGlobal } from "@/components/PingListenerGlobal";

/**
 * Layout des écrans authentifiés. Si l'utilisateur n'est pas connecté,
 * on le renvoie à l'écran de bienvenue.
 */
export default function AppLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.cyan} size="large" />
      </View>
    );
  }

  if (!session) return <Redirect href="/welcome" />;

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
          animation: "fade",
        }}
      />
      <PingListenerGlobal />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bgPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
