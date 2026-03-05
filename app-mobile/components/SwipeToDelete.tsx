import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { RectButton, Swipeable } from "react-native-gesture-handler";
import { colors, fonts, radius, spacing } from "../lib/theme";

const DELETE_ACTION_WIDTH = 80;

type Props = {
  children: React.ReactNode;
  onDelete: () => void;
  marginBottom?: number;
};

const SwipeToDelete = forwardRef<Swipeable, Props>(
  ({ children, onDelete, marginBottom = spacing.md }, ref) => {
    const renderRightActions = () => (
      <View style={[styles.deleteActionWrap, { marginBottom }]}>
        <RectButton style={styles.deleteAction} onPress={onDelete}>
          <Text style={styles.deleteActionText}>Delete</Text>
        </RectButton>
      </View>
    );

    return (
      <Swipeable
        ref={ref}
        renderRightActions={renderRightActions}
        overshootRight={false}
      >
        {children}
      </Swipeable>
    );
  }
);

SwipeToDelete.displayName = "SwipeToDelete";

export default SwipeToDelete;

const styles = StyleSheet.create({
  deleteActionWrap: {
    width: DELETE_ACTION_WIDTH,
  },
  deleteAction: {
    flex: 1,
    backgroundColor: colors.spineCoral,
    justifyContent: "center",
    alignItems: "center",
    borderTopRightRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  deleteActionText: {
    color: "#fff",
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
});
