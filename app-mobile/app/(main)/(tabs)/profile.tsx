import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "@clerk/clerk-expo";
import { colors, fonts, radius, spacing, shadows } from "../../../lib/theme";
import { useAppContext } from "../../../lib/AppContext";
import { updateProfile } from "../../../lib/api";
import { DiceBearAvatar } from "../../../components/DiceBearAvatar";
import { AvatarPicker } from "../../../components/AvatarPicker";

const GENDER_OPTIONS = [
  { key: "M", label: "Boy" },
  { key: "F", label: "Girl" },
  { key: "", label: "Skip" },
];

const LANGUAGE_OPTIONS = [
  "English",
  "Spanish",
  "French",
  "Mandarin",
  "Russian",
  "Arabic",
  "Hindi",
  "Portuguese",
  "Japanese",
  "Korean",
];

const INTEREST_SUGGESTIONS = [
  "Dinosaurs",
  "Space",
  "Magic",
  "Animals",
  "Sports",
  "Science",
  "Art",
  "Music",
  "Adventure",
  "Mystery",
  "Funny",
  "Robots",
  "Pirates",
  "Princesses",
  "Superheroes",
  "History",
];

export default function ProfileScreen() {
  const { getToken } = useAuth();
  const { activeProfile, setActiveProfile } = useAppContext();

  const [name, setName] = useState("");
  const [avatarKey, setAvatarKey] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [gender, setGender] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [newInterest, setNewInterest] = useState("");

  // Initialize from active profile
  useEffect(() => {
    if (!activeProfile) return;
    setName(activeProfile.name || "");
    setAvatarKey(activeProfile.avatarKey || activeProfile.name);
    setBirthYear(activeProfile.birthYear ? String(activeProfile.birthYear) : "");
    setGender(activeProfile.gender || "");
    setLanguages(activeProfile.languages || []);
    setInterests(activeProfile.interests || []);
    setNotes(activeProfile.notes || "");
  }, [activeProfile]);

  const save = useCallback(
    async (
      updates: Record<string, unknown>
    ) => {
      if (!activeProfile) return;
      const token = await getToken();
      if (!token) return;
      setSaving(true);
      const updated = await updateProfile(token, activeProfile.id, updates as Parameters<typeof updateProfile>[2]);
      setActiveProfile(updated);
      setSaving(false);
    },
    [activeProfile, getToken, setActiveProfile]
  );

  const handleNameBlur = useCallback(() => {
    if (name.trim() && name.trim() !== activeProfile?.name) {
      save({ name: name.trim() });
    }
  }, [name, activeProfile, save]);

  const handleAvatarSelect = useCallback(
    (seed: string) => {
      setAvatarKey(seed);
      setShowAvatarPicker(false);
      save({ avatar_key: seed });
    },
    [save]
  );

  const handleBirthYearBlur = useCallback(() => {
    const yr = parseInt(birthYear, 10);
    if (yr && yr >= 2000 && yr <= 2025) {
      save({ birth_year: yr });
    }
  }, [birthYear, save]);

  const handleGenderSelect = useCallback(
    (g: string) => {
      setGender(g);
      save({ gender: g || null });
    },
    [save]
  );

  const toggleLanguage = useCallback(
    (lang: string) => {
      const newLangs = languages.includes(lang)
        ? languages.filter((l) => l !== lang)
        : [...languages, lang];
      setLanguages(newLangs);
      save({ languages: newLangs });
    },
    [languages, save]
  );

  const toggleInterest = useCallback(
    (interest: string) => {
      const newInterests = interests.includes(interest)
        ? interests.filter((i) => i !== interest)
        : [...interests, interest];
      setInterests(newInterests);
      save({ interests: newInterests });
    },
    [interests, save]
  );

  const addCustomInterest = useCallback(() => {
    const trimmed = newInterest.trim();
    if (!trimmed || interests.includes(trimmed)) {
      setNewInterest("");
      return;
    }
    const newInterests = [...interests, trimmed];
    setInterests(newInterests);
    setNewInterest("");
    save({ interests: newInterests });
  }, [newInterest, interests, save]);

  const handleNotesBlur = useCallback(() => {
    save({ notes: notes.trim() });
  }, [notes, save]);

  if (!activeProfile) return null;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Text style={styles.header}>Reader Profile</Text>
          {saving && (
            <ActivityIndicator size="small" color={colors.beamYellow} />
          )}
        </View>

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={() => setShowAvatarPicker(!showAvatarPicker)}
          >
            <DiceBearAvatar seed={avatarKey} size={96} active />
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditText}>✏️</Text>
            </View>
          </TouchableOpacity>
        </View>

        {showAvatarPicker && (
          <View style={styles.pickerContainer}>
            <AvatarPicker
              value={avatarKey}
              onSelect={handleAvatarSelect}
              avatarSize={56}
            />
          </View>
        )}

        {/* Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.textInput}
            value={name}
            onChangeText={setName}
            onBlur={handleNameBlur}
            placeholder="Reader's name"
            placeholderTextColor={colors.inkLight}
            returnKeyType="done"
          />
        </View>

        {/* Birth Year */}
        <View style={styles.field}>
          <Text style={styles.label}>Birth Year</Text>
          <TextInput
            style={styles.textInput}
            value={birthYear}
            onChangeText={setBirthYear}
            onBlur={handleBirthYearBlur}
            placeholder="e.g. 2016"
            placeholderTextColor={colors.inkLight}
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="done"
          />
        </View>

        {/* Gender */}
        <View style={styles.field}>
          <Text style={styles.label}>Gender</Text>
          <View style={styles.chipRow}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.selectChip,
                  gender === opt.key && styles.selectChipActive,
                ]}
                onPress={() => handleGenderSelect(opt.key)}
              >
                <Text
                  style={[
                    styles.selectChipText,
                    gender === opt.key && styles.selectChipTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.field}>
          <Text style={styles.label}>Languages</Text>
          <View style={styles.chipRow}>
            {LANGUAGE_OPTIONS.map((lang) => {
              const isSelected = languages.includes(lang);
              return (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.multiChip,
                    isSelected && styles.multiChipActive,
                  ]}
                  onPress={() => toggleLanguage(lang)}
                >
                  <Text
                    style={[
                      styles.multiChipText,
                      isSelected && styles.multiChipTextActive,
                    ]}
                  >
                    {lang}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Interests */}
        <View style={styles.field}>
          <Text style={styles.label}>Interests</Text>
          <View style={styles.chipRow}>
            {INTEREST_SUGGESTIONS.map((interest) => {
              const isSelected = interests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    isSelected && styles.interestChipActive,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      isSelected && styles.interestChipTextActive,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {interests
              .filter((i) => !INTEREST_SUGGESTIONS.includes(i))
              .map((custom) => (
                <TouchableOpacity
                  key={custom}
                  style={[styles.interestChip, styles.interestChipActive]}
                  onPress={() => toggleInterest(custom)}
                >
                  <Text
                    style={[
                      styles.interestChipText,
                      styles.interestChipTextActive,
                    ]}
                  >
                    {custom} ✕
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
          <View style={styles.addInterestRow}>
            <TextInput
              style={styles.addInterestInput}
              value={newInterest}
              onChangeText={setNewInterest}
              placeholder="Add your own..."
              placeholderTextColor={colors.inkLight}
              onSubmitEditing={addCustomInterest}
              returnKeyType="done"
            />
            {newInterest.trim() !== "" && (
              <TouchableOpacity
                style={styles.addInterestButton}
                onPress={addCustomInterest}
              >
                <Text style={styles.addInterestButtonText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Notes */}
        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={notes}
            onChangeText={setNotes}
            onBlur={handleNotesBlur}
            placeholder="Anything else we should know about this reader..."
            placeholderTextColor={colors.inkLight}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bgCream,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl * 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  header: {
    fontSize: 28,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  avatarEditBadge: {
    position: "absolute",
    bottom: 0,
    right: -4,
    backgroundColor: colors.bgWarm,
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    ...shadows.card,
  },
  avatarEditText: {
    fontSize: 14,
  },
  pickerContainer: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.card,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 12,
    fontFamily: fonts.badge,
    color: colors.inkMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },
  notesInput: {
    minHeight: 100,
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  selectChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.bgWarm,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectChipActive: {
    borderColor: colors.beamYellow,
    backgroundColor: colors.beamYellowLight,
  },
  selectChipText: {
    fontSize: 14,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  selectChipTextActive: {
    color: colors.inkDark,
  },
  multiChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
  },
  multiChipActive: {
    backgroundColor: colors.pageTeal,
  },
  multiChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  multiChipTextActive: {
    color: "#fff",
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
  },
  interestChipActive: {
    backgroundColor: colors.beamYellowLight,
    borderWidth: 1,
    borderColor: colors.beamYellow,
  },
  interestChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  interestChipTextActive: {
    color: colors.shelfBrown,
  },
  addInterestRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addInterestInput: {
    flex: 1,
    backgroundColor: colors.bgWarm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.inkDark,
  },
  addInterestButton: {
    backgroundColor: colors.beamYellow,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    justifyContent: "center",
  },
  addInterestButtonText: {
    fontSize: 14,
    fontFamily: fonts.heading,
    color: colors.inkDark,
  },
});
