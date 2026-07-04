import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { colors } from "@/theme/colors";
import { typography } from "@/theme/typography";

/* -------------------------------------------------------------------------- */
/* Button                                                                     */
/* -------------------------------------------------------------------------- */

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && styles.btnPrimary,
        variant === "secondary" && styles.btnSecondary,
        variant === "danger" && styles.btnDanger,
        isDisabled && styles.btnDisabled,
        pressed && !isDisabled && styles.btnPressed,
      ]}
    >
      <Text
        style={[
          styles.btnLabel,
          variant === "primary" && styles.btnLabelPrimary,
          variant === "secondary" && styles.btnLabelSecondary,
          variant === "danger" && styles.btnLabelDanger,
        ]}
      >
        {loading ? "…" : label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Input                                                                      */
/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  error,
  containerStyle,
  ...inputProps
}: {
  label: string;
  hint?: string;
  error?: string | null;
  containerStyle?: ViewStyle;
} & TextInputProps) {
  return (
    <View style={[styles.field, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.fgMuted}
        {...inputProps}
        style={[styles.fieldInput, error && styles.fieldInputError, inputProps.style]}
      />
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Card                                                                       */
/* -------------------------------------------------------------------------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/* -------------------------------------------------------------------------- */
/* Alert box                                                                  */
/* -------------------------------------------------------------------------- */

export function AlertBox({
  variant = "error",
  message,
}: {
  variant?: "error" | "success" | "info";
  message: string;
}) {
  return (
    <View
      style={[
        styles.alert,
        variant === "error" && styles.alertError,
        variant === "success" && styles.alertSuccess,
        variant === "info" && styles.alertInfo,
      ]}
    >
      <Text
        style={[
          styles.alertText,
          variant === "error" && { color: colors.redAlertBright },
          variant === "success" && { color: colors.emerald },
          variant === "info" && { color: colors.cyan },
        ]}
      >
        {message}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: colors.cyan },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  btnDanger: { backgroundColor: colors.redAlert },
  btnDisabled: { opacity: 0.4 },
  btnPressed: { opacity: 0.75 },
  btnLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  btnLabelPrimary: { color: colors.bgPrimary },
  btnLabelSecondary: { color: colors.fgPrimary },
  btnLabelDanger: { color: colors.fgPrimary },

  field: { gap: 8 },
  fieldLabel: {
    ...typography.caption,
    color: colors.fgSecondary,
    fontWeight: "600",
  },
  fieldInput: {
    backgroundColor: colors.bgSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.fgPrimary,
  },
  fieldInputError: { borderColor: colors.redAlert },
  fieldHint: {
    ...typography.caption,
    color: colors.fgTertiary,
  },
  fieldError: {
    ...typography.caption,
    color: colors.redAlertBright,
  },

  card: {
    backgroundColor: colors.bgSecondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },

  alert: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  alertError: {
    backgroundColor: "rgba(166, 50, 50, 0.1)",
    borderColor: colors.redAlert,
  },
  alertSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderColor: colors.emerald,
  },
  alertInfo: {
    backgroundColor: colors.cyanSoft,
    borderColor: colors.borderCyan,
  },
  alertText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
