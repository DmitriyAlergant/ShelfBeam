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
  const [age, setAge] = useState<number | null>(null);
  const [grade, setGrade] = useState<number | null>(null);
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
    setAge(activeProfile.age ?? null);
    setGrade(activeProfile.grade ?? null);
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
    if ((age ?? null) !== (p.age ?? null)) return true;
    if ((grade ?? null) !== (p.grade ?? null)) return true;
    if ((gender || "") !== (p.gender || "")) return true;
    if (JSON.stringify(languages) !== JSON.stringify(p.languages || [])) return true;
    if (JSON.stringify(interests) !== JSON.stringify(p.interests || [])) return true;
    if ((notes || "") !== (p.notes || "")) return true;
    return false;
  }, [activeProfile, name, avatarKey, age, grade, gender, languages, interests, notes]);

  const saveAll = useCallback(async () => {
    if (!activeProfile) return;
    const token = await getToken();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await updateProfile(token, activeProfile.id, {
        name: name.trim(),
        avatar_key: avatarKey,
        age: age ?? undefined,
        grade: grade ?? undefined,
        gender: gender || null,
        languages,
        interests,
        notes: notes.trim(),
      } as Parameters<typeof updateProfile>[2]);
      setActiveProfile(updated);
      // Re-sync local state with normalized values so isDirty resets
      setName(updated.name || "");
      setAvatarKey(updated.avatarKey || updated.name || "");
      setAge(updated.age ?? null);
      setGrade(updated.grade ?? null);
      setGender(updated.gender || "");
      setLanguages(updated.languages || []);
      setInterests(updated.interests || []);
      setNotes(updated.notes || "");
    } finally {
      setSaving(false);
    }
  }, [activeProfile, getToken, setActiveProfile, name, avatarKey, age, grade, gender, languages, interests, notes]);

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

        {/* Age & Grade */}
        <View style={styles.ageGradeRow}>
          <View style={styles.ageGradeCell}>
            <Text style={styles.label}>Age</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, age !== null && age <= 3 && styles.stepperBtnDisabled]}
                onPress={() => {
                  const cur = age ?? 8;
                  const next = cur === 99 ? 18 : Math.max(3, cur - 1);
                  setAge(next);
                  if (grade === null) {
                    setGrade(next >= 18 ? 99 : Math.max(0, Math.min(12, next - 5)));
                  } else if (cur === 99) {
                    setGrade(12);
                  } else if (grade === 99) {
                    // keep N/A
                  } else if (grade > 0) {
                    setGrade(grade - 1);
                  }
                }}
                disabled={age !== null && age <= 3}
              >
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{age === null ? "-" : age === 99 ? "Adult" : age}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, age !== null && age >= 99 && styles.stepperBtnDisabled]}
                onPress={() => {
                  const cur = age ?? 8;
                  const next = cur >= 18 ? 99 : cur + 1;
                  setAge(next);
                  if (grade === null) {
                    setGrade(next === 99 ? 99 : Math.max(0, Math.min(12, next - 5)));
                  } else if (next === 99) {
                    setGrade(99);
                  } else if (grade < 12) {
                    setGrade(grade + 1);
                  }
                }}
                disabled={age !== null && age >= 99}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.ageGradeCell}>
            <Text style={styles.label}>Grade</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={[styles.stepperBtn, grade !== null && grade <= 0 && styles.stepperBtnDisabled]}
                onPress={() => {
                  const cur = grade ?? 3;
                  setGrade(cur === 99 ? 12 : Math.max(0, cur - 1));
                }}
                disabled={grade !== null && grade <= 0}
              >
                <Text style={styles.stepperBtnText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{grade === null ? "-" : grade === 0 ? "K" : grade === 99 ? "N/A" : grade}</Text>
              <TouchableOpacity
                style={[styles.stepperBtn, grade !== null && grade >= 99 && styles.stepperBtnDisabled]}
                onPress={() => {
                  const cur = grade ?? 3;
                  setGrade(cur >= 12 ? 99 : cur + 1);
                }}
                disabled={grade !== null && grade >= 99}
              >
                <Text style={styles.stepperBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  ageGradeRow: {
    flexDirection: "row",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  ageGradeCell: {
    flex: 1,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.bgWarm,
    justifyContent: "center",
    alignItems: "center",
  },
  stepperBtnDisabled: {
    opacity: 0.3,
  },
  stepperBtnText: {
    fontSize: 18,
    fontFamily: fonts.body,
    color: colors.inkMedium,
  },
  stepperValue: {
    fontSize: 22,
    fontFamily: fonts.body,
    color: colors.inkDark,
    minWidth: 32,
    textAlign: "center",
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
