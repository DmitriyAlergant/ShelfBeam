import { useCallback, useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts, radius, spacing } from "../lib/theme";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const openedAt = useRef(0);

  useEffect(() => {
    if (visible) openedAt.current = Date.now();
  }, [visible]);

  const handleOverlayPress = useCallback(() => {
    if (Date.now() - openedAt.current < 300) return;
    onCancel();
  }, [onCancel]);

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <Pressable style={styles.overlay} onPress={handleOverlayPress}>
        <View style={styles.sheet} onStartShouldSetResponder={() => true}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              activeOpacity={0.8}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                destructive && styles.confirmDestructive,
                loading && styles.buttonDisabled,
              ]}
              activeOpacity={0.8}
              onPress={onConfirm}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(45,35,25,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: colors.bgCream,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.xl,
    maxWidth: 340,
    width: "100%",
  },
  title: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.bgWarm,
  },
  cancelText: {
    fontSize: 16,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: "center",
    backgroundColor: colors.pageTeal,
  },
  confirmDestructive: {
    backgroundColor: colors.spineCoral,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  confirmText: {
    fontSize: 16,
    fontFamily: fonts.headingSemiBold,
    color: "#fff",
  },
});
