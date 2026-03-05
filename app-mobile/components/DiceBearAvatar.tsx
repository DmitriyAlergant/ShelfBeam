import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import { funEmoji } from "@dicebear/collection";

interface DiceBearAvatarProps {
  seed: string;
  size?: number;
  /** Show beam-yellow ring around avatar when active */
  active?: boolean;
  /** "M" | "F" | "" — filters hairstyles and facial hair when known */
  gender?: string;
}

export function DiceBearAvatar({
  seed,
  size = 64,
  active = false,
  gender,
}: DiceBearAvatarProps) {
  const svgString = useMemo(() => {
    const avatar = createAvatar(funEmoji, {
      seed,
      eyes: [
        "cute", "wink", "wink2", "plain", "glasses",
        "closed", "shades", "closed2", "sleepClose",
      ],
      mouth: [
        "plain", "lilSmile", "shy", "cute", "wideSmile",
        "shout", "smileTeeth", "smileLol", "tongueOut", "kissHeart",
      ],
    });
    return avatar.toString();
  }, [seed, gender]);

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
