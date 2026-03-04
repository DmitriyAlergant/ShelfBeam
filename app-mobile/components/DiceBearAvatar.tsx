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
  /** "M" | "F" | "" — filters hairstyles and facial hair when known */
  gender?: string;
}

const TOP_FEMININE = [
  "bigHair", "bob", "bun", "curly", "curvy",
  "dreads", "dreads01", "dreads02", "frida", "frizzle",
  "fro", "froBand",
  "longButNotTooLong", "miaWallace",
  "straight01", "straight02", "straightAndStrand",
  "winterHat1", "winterHat02", "winterHat03", "winterHat04",
] as const;

const TOP_MASCULINE = [
  "dreads", "dreads01", "dreads02", "frizzle",
  "fro", "froBand", "hat",
  "shaggy", "shaggyMullet",
  "shavedSides", "shortCurly", "shortFlat", "shortRound", "shortWaved",
  "sides", "theCaesar", "theCaesarAndSidePart",
  "winterHat1", "winterHat02", "winterHat03", "winterHat04",
] as const;

const TOP_ALL = [
  "bigHair", "bob", "bun", "curly", "curvy",
  "dreads", "dreads01", "dreads02", "frida", "frizzle",
  "fro", "froBand", "hat",
  "longButNotTooLong", "miaWallace", "shaggy", "shaggyMullet",
  "shavedSides", "shortCurly", "shortFlat", "shortRound", "shortWaved",
  "sides", "straight01", "straight02", "straightAndStrand",
  "theCaesar", "theCaesarAndSidePart",
  "winterHat1", "winterHat02", "winterHat03", "winterHat04",
] as const;

export function DiceBearAvatar({
  seed,
  size = 64,
  active = false,
  gender,
}: DiceBearAvatarProps) {
  const svgString = useMemo(() => {
    const top = gender === "F" ? [...TOP_FEMININE] : gender === "M" ? [...TOP_MASCULINE] : [...TOP_ALL];
    const avatar = createAvatar(avataaars, {
      seed,
      skinColor: ["edb98a", "f8d25c", "ffdbb4", "fd9841", "d08b5b"],
      top,
      mouth: [
        "concerned", "default", "disbelief", "eating", "grimace",
        "sad", "screamOpen", "serious", "smile", "tongue", "twinkle",
      ],
      ...(gender === "F" && { facialHairProbability: 0 }),
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
