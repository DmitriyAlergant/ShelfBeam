import { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, fonts, radius, spacing, shadows } from "../lib/theme";

const REACTION_EMOJIS = [
  "👍", "👎", "❤️", "🔥", "😂", "😢", "😱", "🤔", "🤯", "💤", "😡",
];

export { REACTION_EMOJIS };

type Props = {
  reactions: string[];
  onToggle: (emoji: string) => void;
  compact?: boolean;
};

export default function EmojiReactions({ reactions, onToggle, compact }: Props) {
  const [pickerVisible, setPickerVisible] = useState(false);
  const available = REACTION_EMOJIS.filter((e) => !reactions.includes(e));

  return (
    <>
      <View style={[styles.row, compact && styles.rowCompact]}>
        {reactions.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={[styles.chip, compact && styles.chipCompact]}
            onPress={() => onToggle(emoji)}
          >
            <Text style={[styles.chipEmoji, compact && styles.chipEmojiCompact]}>{emoji}</Text>
            <Text style={[styles.chipX, compact && styles.chipXCompact]}>✕</Text>
          </TouchableOpacity>
        ))}
        {available.length > 0 && (
          <TouchableOpacity
            style={[styles.addButton, compact && styles.addButtonCompact]}
            onPress={() => setPickerVisible(true)}
          >
            <Text style={[styles.addPlus, compact && styles.addPlusCompact]}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Add a reaction</Text>
            <View style={styles.grid}>
              {available.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.gridItem}
                  onPress={() => {
                    onToggle(emoji);
                    setPickerVisible(false);
                  }}
                >
                  <Text style={styles.gridEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    alignItems: "center",
  },
  rowCompact: {
    gap: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgWarm,
    borderWidth: 1.5,
    borderColor: colors.inkLight,
    borderRadius: radius.xl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipCompact: {
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  chipEmoji: {
    fontSize: 20,
  },
  chipEmojiCompact: {
    fontSize: 16,
  },
  chipX: {
    fontSize: 12,
    color: colors.inkMedium,
    marginLeft: 2,
  },
  chipXCompact: {
    fontSize: 10,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.inkLight,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  addPlus: {
    fontSize: 20,
    color: colors.inkMedium,
    lineHeight: 22,
  },
  addPlusCompact: {
    fontSize: 16,
    lineHeight: 18,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.bgCream,
    borderRadius: radius.lg,
    padding: spacing.lg,
    width: 280,
    ...shadows.card,
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.headingMedium,
    color: colors.inkDark,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
  gridItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
  },
  gridEmoji: {
    fontSize: 24,
  },
});
