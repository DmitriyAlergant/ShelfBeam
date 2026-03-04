import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";

interface DiceBearAvatarProps {
  seed: string;
  size?: number;
  /** Show beam-yellow ring around avatar when active */
  active?: boolean;
}

export function DiceBearAvatar({
  seed,
  size = 64,
  active = false,
}: DiceBearAvatarProps) {
  const svgString = useMemo(() => {
    const avatar = createAvatar(avataaars, { seed });
    return avatar.toString();
  }, [seed]);

  const ringWidth = Math.max(2, Math.round(size * 0.05));
  const outerSize = active ? size + ringWidth * 2 : size;

  return (
    <View
      style={[
        styles.container,
        {
          width: outerSize,
          height: outerSize,
          borderRadius: outerSize / 2,
        },
        active && {
          borderWidth: ringWidth,
          borderColor: "#FFD234",
        },
      ]}
    >
      <SvgXml xml={svgString} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5EDE3",
  },
});
