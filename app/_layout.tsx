import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "@/theme/colors";
import { AuthProvider } from "@/auth/context";

/**
 * Layout racine — enveloppe l'app dans AuthProvider et configure la
 * navigation Stack Expo Router. Les redirections d'auth sont gérées
 * dans les layouts de groupes (auth) et (app).
 */
export default function RootLayout() {
  return (
    <AuthProvider>
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
