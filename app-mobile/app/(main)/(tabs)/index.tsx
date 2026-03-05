import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppAuth } from "../../../lib/auth";
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
  const { getToken } = useAppAuth();
  const { activeProfile, setActiveProfile, setPendingSave } = useAppContext();

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
  const [newLanguage, setNewLanguage] = useState("");
  const [showCustomInterest, setShowCustomInterest] = useState(false);
  const [showCustomLanguage, setShowCustomLanguage] = useState(false);

  // Initialize from active profile (only on first load / profile switch)
  const [initializedProfileId, setInitializedProfileId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeProfile || activeProfile.id === initializedProfileId) return;
    setInitializedProfileId(activeProfile.id);
    setName(activeProfile.name || "");
    setAvatarKey(activeProfile.avatarKey || activeProfile.name);
    setBirthYear(activeProfile.birthYear ? String(activeProfile.birthYear) : "");
    setGender(activeProfile.gender || "");
    setLanguages(activeProfile.languages || []);
    setInterests(activeProfile.interests || []);
    setNotes(activeProfile.notes || "");
  }, [activeProfile, initializedProfileId]);

  // Dirty tracking — compare local state to activeProfile
  const isDirty = useMemo(() => {
    if (!activeProfile) return false;
    const p = activeProfile;
    if ((name || "") !== (p.name || "")) return true;
    if ((avatarKey || "") !== (p.avatarKey || p.name || "")) return true;
    const yr = parseInt(birthYear, 10);
    if ((yr || null) !== (p.birthYear || null)) return true;
    if ((gender || "") !== (p.gender || "")) return true;
    if (JSON.stringify(languages) !== JSON.stringify(p.languages || [])) return true;
    if (JSON.stringify(interests) !== JSON.stringify(p.interests || [])) return true;
    if ((notes || "") !== (p.notes || "")) return true;
    return false;
  }, [activeProfile, name, avatarKey, birthYear, gender, languages, interests, notes]);

  const saveAll = useCallback(async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const yr = parseInt(birthYear, 10);
      const updated = await updateProfile(token, activeProfile.id, {
        name: name.trim(),
        avatar_key: avatarKey,
        birth_year: (yr && yr >= 2000 && yr <= new Date().getFullYear()) ? yr : activeProfile.birthYear,
        gender: gender || null,
        languages,
        interests,
        notes: notes.trim(),
      } as Parameters<typeof updateProfile>[2]);
      setActiveProfile(updated);
      // Re-sync local state with normalized values so isDirty resets
      setName(updated.name || "");
      setAvatarKey(updated.avatarKey || updated.name || "");
      setBirthYear(updated.birthYear ? String(updated.birthYear) : "");
      setGender(updated.gender || "");
      setLanguages(updated.languages || []);
      setInterests(updated.interests || []);
      setNotes(updated.notes || "");
    } finally {
      setSaving(false);
    }
  }, [activeProfile, getToken, setActiveProfile, name, avatarKey, birthYear, gender, languages, interests, notes]);

  // Register save action in top bar via context
  const saveAllRef = useRef(saveAll);
  saveAllRef.current = saveAll;
  useEffect(() => {
    if (isDirty) {
      setPendingSave(() => saveAllRef.current());
    } else {
      setPendingSave(null);
    }
    return () => setPendingSave(null);
  }, [isDirty, setPendingSave]);


  const handleAvatarSelect = useCallback(
    (seed: string) => {
      setAvatarKey(seed);
      setShowAvatarPicker(false);
    },
    []
  );

  const handleGenderSelect = useCallback(
    (g: string) => {
      setGender(g);
    },
    []
  );

  const toggleLanguage = useCallback(
    (lang: string) => {
      setLanguages((prev) =>
        prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
      );
    },
    []
  );

  const toggleInterest = useCallback(
    (interest: string) => {
      setInterests((prev) =>
        prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
      );
    },
    []
  );

  const addCustomInterest = useCallback(() => {
    const trimmed = newInterest.trim();
    if (!trimmed || interests.includes(trimmed)) {
      setNewInterest("");
      setShowCustomInterest(false);
      return;
    }
    setInterests([...interests, trimmed]);
    setNewInterest("");
    setShowCustomInterest(false);
  }, [newInterest, interests]);

  const addCustomLanguage = useCallback(() => {
    const trimmed = newLanguage.trim();
    if (!trimmed || languages.includes(trimmed)) {
      setNewLanguage("");
      setShowCustomLanguage(false);
      return;
    }
    setLanguages([...languages, trimmed]);
    setNewLanguage("");
    setShowCustomLanguage(false);
  }, [newLanguage, languages]);

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
              gender={gender}
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
            {languages
              .filter((l) => !LANGUAGE_OPTIONS.includes(l))
              .map((custom) => (
                <TouchableOpacity
                  key={custom}
                  style={[styles.multiChip, styles.multiChipActive]}
                  onPress={() => toggleLanguage(custom)}
                >
                  <Text style={[styles.multiChipText, styles.multiChipTextActive]}>
                    {custom} ✕
                  </Text>
                </TouchableOpacity>
              ))}
            {showCustomLanguage ? (
              <View style={styles.inlineInputWrap}>
                <TextInput
                  style={styles.inlineInput}
                  value={newLanguage}
                  onChangeText={setNewLanguage}
                  placeholder="Type..."
                  placeholderTextColor={colors.inkLight}
                  onSubmitEditing={addCustomLanguage}
                  onBlur={() => { if (!newLanguage.trim()) setShowCustomLanguage(false); }}
                  autoFocus
                  returnKeyType="done"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowCustomLanguage(true)}
              >
                <Text style={styles.addChipText}>+ Add</Text>
              </TouchableOpacity>
            )}
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
            {showCustomInterest ? (
              <View style={styles.inlineInputWrap}>
                <TextInput
                  style={styles.inlineInput}
                  value={newInterest}
                  onChangeText={setNewInterest}
                  placeholder="Type..."
                  placeholderTextColor={colors.inkLight}
                  onSubmitEditing={addCustomInterest}
                  onBlur={() => { if (!newInterest.trim()) setShowCustomInterest(false); }}
                  autoFocus
                  returnKeyType="done"
                />
              </View>
            ) : (
              <TouchableOpacity
                style={styles.addChip}
                onPress={() => setShowCustomInterest(true)}
              >
                <Text style={styles.addChipText}>+ Add</Text>
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
            placeholder="Anything else about me as a reader..."
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  multiChipActive: {
    backgroundColor: colors.beamYellowLight,
    borderColor: colors.beamYellow,
  },
  multiChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  multiChipTextActive: {
    color: colors.shelfBrown,
  },
  interestChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
    borderWidth: 1,
    borderColor: "transparent",
  },
  interestChipActive: {
    backgroundColor: colors.beamYellowLight,
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
  addChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.bgWarm,
  },
  addChipText: {
    fontSize: 13,
    fontFamily: fonts.bodyMedium,
    color: colors.inkMedium,
  },
  inlineInputWrap: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.beamYellow,
    backgroundColor: colors.beamYellowLight,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minWidth: 80,
    justifyContent: "center",
  },
  inlineInput: {
    fontSize: 13,
    fontFamily: fonts.body,
    color: colors.inkDark,
    padding: 0,
    margin: 0,
    lineHeight: 18,
  },
});
