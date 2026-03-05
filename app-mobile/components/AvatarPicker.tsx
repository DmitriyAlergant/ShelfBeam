import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { DiceBearAvatar } from "./DiceBearAvatar";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const GRID_COUNT = 10;

function generateSeeds(): string[] {
  return Array.from({ length: GRID_COUNT }, () =>
    Math.random().toString(36).substring(2, 10)
  );
}

interface AvatarPickerProps {
  /** Currently selected seed */
  value?: string;
  /** Called when user taps an avatar */
  onSelect: (seed: string) => void;
  /** Size of each avatar in the grid */
  avatarSize?: number;
  /** "M" | "F" | "" — passed to DiceBearAvatar for gender-appropriate styles */
  gender?: string;
}

export function AvatarPicker({
  value,
  onSelect,
  avatarSize = 72,
  gender,
}: AvatarPickerProps) {
  const [seeds, setSeeds] = useState<string[]>(() => {
    const generated = generateSeeds();
    // If a value is provided and not already in the grid, replace the first slot
    if (value && !generated.includes(value)) {
      generated[0] = value;
    }
    return generated;
  });

  const handleRandomize = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const newSeeds = generateSeeds();
    // Keep the current selection in the grid if one exists
    if (value) {
      newSeeds[0] = value;
    }
    setSeeds(newSeeds);
  }, [value]);

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {seeds.map((seed) => (
          <Pressable
            key={seed}
            onPress={() => onSelect(seed)}
            style={[
              styles.avatarCell,
              { width: avatarSize + 12, height: avatarSize + 12 },
              seed === value && styles.selectedCell,
            ]}
          >
            <DiceBearAvatar seed={seed} size={avatarSize} active={seed === value} gender={gender} />
          </Pressable>
        ))}
      </View>
      <Pressable onPress={handleRandomize} style={styles.randomizeButton}>
        <View style={styles.randomizeInner}>
          <Text style={styles.randomizeIcon}>🎲</Text>
          <Text style={styles.randomizeText}>Randomize</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 12,
  },
  avatarCell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  selectedCell: {
    backgroundColor: "rgba(255, 210, 52, 0.15)",
    borderRadius: 16,
  },
  randomizeButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#F5EDE3",
  },
  randomizeInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  randomizeText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2D2319",
  },
  randomizeIcon: {
    fontSize: 18,
  },
});
