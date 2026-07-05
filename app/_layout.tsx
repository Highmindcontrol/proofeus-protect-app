import "expo-dev-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "@/theme/colors";
import { AuthProvider } from "@/auth/context";
import { useDeepLinks } from "@/hooks/useDeepLinks";

/**
 * Layout racine — enveloppe l'app dans AuthProvider, active l'écoute
 * des deep links (proofeus://), et configure la navigation Stack.
 * Les redirections d'auth sont gérées dans les layouts (auth) et (app).
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <DeepLinkListener />
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.bgPrimary },
            animation: "fade",
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="biometric-test" />
        </Stack>
      </View>
    </AuthProvider>
  );
}

/**
 * Composant invisible qui active le hook useDeepLinks. Il vit à
 * l'intérieur de AuthProvider et de la Stack pour avoir accès à
 * useRouter (nécessite d'être sous un Navigator).
 */
function DeepLinkListener() {
  useDeepLinks();
  return null;
}
