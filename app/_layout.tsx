import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { colors } from "@/theme/colors";

/**
 * Layout racine — navigation Stack Expo Router, dark mode par défaut.
 */
export default function RootLayout() {
  return (
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
        <Stack.Screen name="biometric-test" />
      </Stack>
    </View>
  );
}
