import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useAppAuth } from "../../lib/auth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fonts, radius, spacing, shadows } from "../../lib/theme";
import { useAppContext } from "../../lib/AppContext";
import { uploadScanImage, createScan } from "../../lib/api";
import { useScanStore } from "../../lib/stores/useScanStore";

type CameraViewRef = {
  takePictureAsync: (opts?: { quality?: number }) => Promise<{ uri: string }>;
};

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getToken } = useAppAuth();
  const { activeProfile } = useAppContext();
  const cameraRef = useRef<CameraViewRef>(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const takePhoto = useCallback(async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    setCapturedUri(photo.uri);
  }, []);

  const pickFromGallery = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri);
    }
  }, []);

  const usePhoto = useCallback(async () => {
    if (!capturedUri || !activeProfile) return;
    setUploading(true);
    const token = await getToken();
    if (!token) { setUploading(false); return; }

    const { image_url } = await uploadScanImage(token, capturedUri);
    const scan = await createScan(token, {
      reader_profile_id: activeProfile.id,
      image_url,
    });
    useScanStore.getState().addScan(scan);
    setUploading(false);
    router.replace(`/(main)/(tabs)/scan-detail?id=${scan.id}`);
  }, [capturedUri, activeProfile, getToken, router]);

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.beamYellow} />
      </View>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permSubtitle}>
          We need camera access to photograph bookshelves
        </Text>
        <TouchableOpacity style={styles.permButton} onPress={requestPermission}>
          <Text style={styles.permButtonText}>Grant Access</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.galleryLink} onPress={pickFromGallery}>
          <Text style={styles.galleryLinkText}>Or pick from gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Preview captured photo
  if (capturedUri) {
    return (
      <View style={styles.previewContainer}>
        <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="contain" />

        {uploading ? (
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + spacing.lg }]}>
            <ActivityIndicator size="large" color={colors.beamYellow} />
            <Text style={styles.uploadingText}>Uploading...</Text>
          </View>
        ) : (
          <View style={[styles.previewActions, { paddingBottom: insets.bottom + spacing.lg }]}>
            <TouchableOpacity
              style={styles.retakeButton}
              onPress={() => setCapturedUri(null)}
            >
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.useButton} onPress={usePhoto}>
              <Text style={styles.useText}>Use Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  // Camera viewfinder
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef as React.RefObject<CameraView>}
        style={styles.camera}
        facing="back"
      >
        <View style={[styles.cameraOverlay, { paddingTop: insets.top + spacing.md }]}>
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.cameraHint}>
          <Text style={styles.hintText}>Point at a bookshelf</Text>
        </View>

        <View style={[styles.cameraControls, { paddingBottom: insets.bottom + spacing.xl }]}>
          <TouchableOpacity style={styles.galleryButton} onPress={pickFromGallery}>
            <Text style={styles.galleryEmoji}>🖼️</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.captureButton} onPress={takePhoto}>
            <View style={styles.captureInner} />
          </TouchableOpacity>

          <View style={styles.spacer} />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.bgCream,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
  },
  permTitle: {
    fontSize: 22,
    fontFamily: fonts.heading,
    color: colors.inkDark,
    marginBottom: spacing.sm,
  },
  permSubtitle: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
    textAlign: "center",
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  permButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    ...shadows.button,
  },
  permButtonText: {
    fontSize: 16,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  galleryLink: {
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  galleryLinkText: {
    fontSize: 15,
    fontFamily: fonts.bodyMedium,
    color: colors.pageTeal,
  },
  backLink: {
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  backLinkText: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMedium,
  },

  // Camera
  cameraContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontSize: 20,
    fontFamily: fonts.heading,
  },
  cameraHint: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  hintText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 18,
    fontFamily: fonts.headingMedium,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  galleryButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  galleryEmoji: {
    fontSize: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#fff",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.beamYellow,
  },
  spacer: {
    width: 48,
  },

  // Preview
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
  },
  retakeButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  retakeText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.headingMedium,
  },
  useButton: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.beamYellow,
    ...shadows.button,
  },
  useText: {
    color: colors.inkDark,
    fontSize: 16,
    fontFamily: fonts.heading,
  },
  uploadingText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: fonts.body,
    marginLeft: spacing.sm,
  },
});
