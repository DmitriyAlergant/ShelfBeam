import { useState } from "react";
import { Image, View, type ImageProps, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../lib/theme";

type LoadingImageProps = ImageProps & {
  placeholderStyle?: StyleProp<ViewStyle>;
};

export default function LoadingImage({ style, placeholderStyle, onLoad, ...props }: LoadingImageProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[!loaded && { backgroundColor: colors.bgWarm }, placeholderStyle]}>
      <Image
        {...props}
        style={[style, !loaded && { opacity: 0 }]}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
      />
    </View>
  );
}
