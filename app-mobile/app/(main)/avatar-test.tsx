import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from "react-native";
import { DiceBearAvatar } from "../../components/DiceBearAvatar";
import { AvatarPicker } from "../../components/AvatarPicker";

/**
 * Test screen for validating DiceBear avatar rendering.
 * Navigate to /(main)/avatar-test to see this screen.
 * Remove before shipping.
 */
export default function AvatarTestScreen() {
  const [selectedSeed, setSelectedSeed] = useState("emma-reader");

  const testSeeds = ["emma-reader", "jake-reader", "luna-test", "max-test"];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.heading}>Avatar Size Tests</Text>
        <Text style={styles.subtext}>
          Same seed at different sizes — should look identical, just scaled.
        </Text>
        <View style={styles.sizeRow}>
          {[32, 64, 128].map((size) => (
            <View key={size} style={styles.sizeItem}>
              <DiceBearAvatar seed="size-test" size={size} />
              <Text style={styles.label}>{size}px</Text>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Different Seeds</Text>
        <Text style={styles.subtext}>
          Each seed should produce a unique avatar.
        </Text>
        <View style={styles.sizeRow}>
          {testSeeds.map((seed) => (
            <View key={seed} style={styles.sizeItem}>
              <DiceBearAvatar seed={seed} size={64} />
              <Text style={styles.label}>{seed}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.heading}>Active Ring</Text>
        <View style={styles.sizeRow}>
          <View style={styles.sizeItem}>
            <DiceBearAvatar seed="ring-test" size={64} active={false} />
            <Text style={styles.label}>Inactive</Text>
          </View>
          <View style={styles.sizeItem}>
            <DiceBearAvatar seed="ring-test" size={64} active={true} />
            <Text style={styles.label}>Active</Text>
          </View>
        </View>

        <Text style={styles.heading}>Avatar Picker</Text>
        <Text style={styles.subtext}>Selected: {selectedSeed}</Text>
        <AvatarPicker value={selectedSeed} onSelect={setSelectedSeed} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFF8F0",
  },
  container: {
    padding: 24,
    gap: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2D2319",
    marginTop: 16,
  },
  subtext: {
    fontSize: 14,
    color: "#7A6B5D",
    marginBottom: 8,
  },
  sizeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    alignItems: "flex-end",
  },
  sizeItem: {
    alignItems: "center",
    gap: 4,
  },
  label: {
    fontSize: 12,
    color: "#7A6B5D",
  },
});
