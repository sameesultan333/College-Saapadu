/**
 * RegisterScreen — College + Institutional ID + Name + Email + Phone +
 * Password + Confirm Password, matching backend UserCreate exactly.
 *
 * Cut the previous .jsx version's looping floating-emoji fruit particles
 * (pure decoration, animating on every mount whether or not the screen
 * was in focus) in favor of the same clean, restrained language as
 * LoginScreen. Password strength kept -- it's a real, useful signal --
 * but shown as a segmented meter matching the app's own CrowdMeter
 * visual language instead of a color-shifting bar.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronLeft,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Lock,
  Mail,
  Phone,
  User as UserIcon,
} from "lucide-react-native";
import { getColleges } from "../services/auth";
import { API_URL } from "../services/config";
import { getFoodColors } from "../theme/foodTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "RegisterScreen">;

interface College { id: number; name: string }

type CustomerRole = "student" | "staff";

interface FormState {
  institutionalId: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const C = getFoodColors(false);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[6-9]\d{9}$/;

function validate(form: FormState, college: College | null): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!college) errors.college = "Select your college";
  if (!form.institutionalId.trim()) errors.institutionalId = "Institutional ID is required";
  if (!form.name.trim()) errors.name = "Name is required";
  else if (form.name.trim().length < 3) errors.name = "Min 3 characters";
  if (!form.email.trim()) errors.email = "Email is required";
  else if (!EMAIL_RE.test(form.email)) errors.email = "Invalid email";
  if (!form.phone.trim()) errors.phone = "Phone is required";
  else if (!PHONE_RE.test(form.phone)) errors.phone = "Must be a valid 10-digit number";
  if (!form.password) errors.password = "Password is required";
  else if (form.password.length < 6) errors.password = "Min 6 characters";
  if (!form.confirmPassword) errors.confirmPassword = "Please confirm your password";
  else if (form.confirmPassword !== form.password) errors.confirmPassword = "Passwords do not match";
  return errors;
}

function passwordStrength(pw: string): number {
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(s, 4);
}

// ─── Reusable field ─────────────────────────────────────
function Field({
  label, icon: Icon, value, onChangeText, error, touched, secure, onToggleSecure, ...rest
}: {
  label: string;
  icon: typeof UserIcon;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  touched?: boolean;
  secure?: boolean;
  onToggleSecure?: () => void;
  placeholder?: string;
  keyboardType?: "default" | "email-address" | "phone-pad";
  maxLength?: number;
  autoCapitalize?: "none" | "characters" | "words";
}) {
  const showError = touched && error;
  return (
    <View style={S.field}>
      <Text style={S.label}>{label}</Text>
      <View style={[S.input, showError && S.inputError]}>
        <Icon size={16} color={C.ink4} strokeWidth={2} />
        <TextInput
          style={S.textInput}
          placeholderTextColor={C.ink4}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure}
          autoCorrect={false}
          {...rest}
        />
        {onToggleSecure && (
          <TouchableOpacity onPress={onToggleSecure} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {secure ? <Eye size={16} color={C.ink4} /> : <EyeOff size={16} color={C.ink4} />}
          </TouchableOpacity>
        )}
      </View>
      {showError ? <Text style={S.fieldError}>{error}</Text> : null}
    </View>
  );
}

// ─── Password strength meter ────────────────────────────
function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const level = passwordStrength(password);
  const label = ["Weak", "Weak", "Fair", "Good", "Strong"][level];
  const color = level <= 1 ? C.red : level === 2 ? C.accent : C.action;
  return (
    <View style={S.strengthRow}>
      <View style={S.strengthSegs}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[S.strengthSeg, { backgroundColor: i < level ? color : C.border }]} />
        ))}
      </View>
      <Text style={[S.strengthLbl, { color }]}>{label}</Text>
    </View>
  );
}

export default function RegisterScreen({ navigation }: Props) {
  const [colleges, setColleges] = useState<College[]>([]);
  const [collegesLoading, setCollegesLoading] = useState(true);
  const [college, setCollege] = useState<College | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [role, setRole] = useState<CustomerRole>("student");

  const [form, setForm] = useState<FormState>({
    institutionalId: "", name: "", email: "", phone: "", password: "", confirmPassword: "",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [apiError, setApiError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getColleges()
      .then((data: College[]) => setColleges(Array.isArray(data) ? data : []))
      .catch(() => setApiError("Could not load colleges. Check your connection."))
      .finally(() => setCollegesLoading(false));
  }, []);

  const update = (key: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };
  const blur = (key: string) => setTouched((t) => ({ ...t, [key]: true }));

  const handleSubmit = async () => {
    const allTouched = { college: true, institutionalId: true, name: true, email: true, phone: true, password: true, confirmPassword: true };
    setTouched(allTouched);
    const newErrors = validate(form, college);
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setApiError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/users/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          college_id: college!.id,
          institutional_id: form.institutionalId.trim(),
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          role,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail;
        throw new Error(typeof detail === "string" ? detail : detail?.message || "Registration failed");
      }
      navigation.navigate("Login");
    } catch (err) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={S.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={S.backCircle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <ChevronLeft size={20} color={C.ink} strokeWidth={2.25} />
          </TouchableOpacity>
          <Text style={S.headerTitle}>Create Account</Text>
        </View>

        <ScrollView contentContainerStyle={S.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={S.subtitle}>Join your campus food community</Text>

          <View style={S.form}>
            <View style={S.field}>
              <Text style={S.label}>College</Text>
              <Pressable
                style={[S.input, S.selectInput, touched.college && errors.college && S.inputError]}
                onPress={() => !collegesLoading && setPickerOpen(true)}
              >
                {collegesLoading ? (
                  <ActivityIndicator size="small" color={C.action} />
                ) : (
                  <Text style={[S.selectTxt, { color: college ? C.ink : C.ink4 }]} numberOfLines={1}>
                    {college ? college.name : "Select your college"}
                  </Text>
                )}
                <ChevronDown size={18} color={C.ink4} strokeWidth={2} />
              </Pressable>
              {touched.college && errors.college ? <Text style={S.fieldError}>{errors.college}</Text> : null}
            </View>

            <View style={S.field}>
              <Text style={S.label}>I am a</Text>
              <View style={S.roleRow}>
                <TouchableOpacity
                  style={[S.roleBtn, role === "student" && S.roleBtnActive]}
                  onPress={() => setRole("student")}
                  activeOpacity={0.85}
                >
                  <GraduationCap size={16} color={role === "student" ? "#FFF" : C.ink3} strokeWidth={2} />
                  <Text style={[S.roleTxt, role === "student" && S.roleTxtActive]}>Student</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[S.roleBtn, role === "staff" && S.roleBtnActive]}
                  onPress={() => setRole("staff")}
                  activeOpacity={0.85}
                >
                  <Briefcase size={16} color={role === "staff" ? "#FFF" : C.ink3} strokeWidth={2} />
                  <Text style={[S.roleTxt, role === "staff" && S.roleTxtActive]}>Staff / Teacher</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Field
              label="Institutional ID"
              icon={IdCard}
              value={form.institutionalId}
              onChangeText={(t) => update("institutionalId", t.toUpperCase())}
              onBlur={() => blur("institutionalId")}
              error={errors.institutionalId}
              touched={touched.institutionalId}
              placeholder="e.g. 23CSE1042"
              autoCapitalize="characters"
            />

            <Field
              label="Full Name"
              icon={UserIcon}
              value={form.name}
              onChangeText={(t) => update("name", t)}
              onBlur={() => blur("name")}
              error={errors.name}
              touched={touched.name}
              placeholder="Your full name"
              autoCapitalize="words"
            />

            <Field
              label="Email"
              icon={Mail}
              value={form.email}
              onChangeText={(t) => update("email", t)}
              onBlur={() => blur("email")}
              error={errors.email}
              touched={touched.email}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Field
              label="Phone Number"
              icon={Phone}
              value={form.phone}
              onChangeText={(t) => update("phone", t.replace(/[^0-9]/g, ""))}
              onBlur={() => blur("phone")}
              error={errors.phone}
              touched={touched.phone}
              placeholder="10-digit mobile number"
              keyboardType="phone-pad"
              maxLength={10}
            />

            <View>
              <Field
                label="Password"
                icon={Lock}
                value={form.password}
                onChangeText={(t) => update("password", t)}
                onBlur={() => blur("password")}
                error={errors.password}
                touched={touched.password}
                placeholder="At least 6 characters"
                secure={!showPw}
                onToggleSecure={() => setShowPw((v) => !v)}
                autoCapitalize="none"
              />
              <StrengthMeter password={form.password} />
            </View>

            <Field
              label="Confirm Password"
              icon={Lock}
              value={form.confirmPassword}
              onChangeText={(t) => update("confirmPassword", t)}
              onBlur={() => blur("confirmPassword")}
              error={errors.confirmPassword}
              touched={touched.confirmPassword}
              placeholder="Re-enter your password"
              secure={!showConfirmPw}
              onToggleSecure={() => setShowConfirmPw((v) => !v)}
              autoCapitalize="none"
            />

            {apiError ? <Text style={S.apiError}>{apiError}</Text> : null}

            <TouchableOpacity style={[S.submitBtn, loading && S.submitBtnDisabled]} onPress={handleSubmit} disabled={loading} activeOpacity={0.88}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={S.submitTxt}>Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate("Login")} style={S.loginRow}>
              <Text style={S.loginTxt}>Already have an account? <Text style={S.loginLink}>Log in</Text></Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={S.sheetBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={S.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={S.sheetGrabber} />
            <Text style={S.sheetTitle}>Select your college</Text>
            {colleges.length === 0 ? (
              <Text style={S.sheetEmpty}>No colleges available yet.</Text>
            ) : (
              <ScrollView>
                {colleges.map((c, i) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[S.sheetRow, i === 0 && S.sheetRowFirst]}
                    onPress={() => { setCollege(c); setPickerOpen(false); }}
                  >
                    <GraduationCap size={16} color={C.forest} strokeWidth={1.75} />
                    <Text style={S.sheetRowTxt} numberOfLines={1}>{c.name}</Text>
                    {college?.id === c.id && <Check size={16} color={C.action} strokeWidth={2.5} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  backCircle: { width: 34, height: 34, borderRadius: 10, backgroundColor: C.surface2, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: C.ink },

  scroll: { paddingHorizontal: 20, paddingBottom: 32 },
  subtitle: { fontSize: 13.5, color: C.ink3, marginTop: 6, marginBottom: 20 },

  form: { gap: 16 },
  field: { gap: 7 },
  label: { fontSize: 12.5, fontWeight: "600", color: C.ink2 },

  input: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 50,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14,
  },
  inputError: { borderColor: C.red },

  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    height: 46, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface,
  },
  roleBtnActive: { backgroundColor: C.forest, borderColor: C.forest },
  roleTxt: { fontSize: 13.5, fontWeight: "600", color: C.ink3 },
  roleTxtActive: { color: "#FFF" },
  selectInput: { justifyContent: "space-between" },
  selectTxt: { flex: 1, fontSize: 15 },
  textInput: { flex: 1, fontSize: 15, color: C.ink, padding: 0, height: "100%" },
  fieldError: { fontSize: 11.5, color: C.red, fontWeight: "600" },

  strengthRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  strengthSegs: { flexDirection: "row", gap: 4, flex: 1 },
  strengthSeg: { flex: 1, height: 4, borderRadius: 2 },
  strengthLbl: { fontSize: 11, fontWeight: "700" },

  apiError: { fontSize: 12.5, color: C.red, fontWeight: "600", textAlign: "center" },

  submitBtn: { height: 50, borderRadius: 10, backgroundColor: C.action, alignItems: "center", justifyContent: "center", marginTop: 4 },
  submitBtnDisabled: { opacity: 0.7 },
  submitTxt: { color: "#FFF", fontSize: 15.5, fontWeight: "700" },

  loginRow: { alignItems: "center", marginTop: 4, marginBottom: 8 },
  loginTxt: { fontSize: 13.5, color: C.ink3 },
  loginLink: { color: C.action, fontWeight: "700" },

  sheetBackdrop: { flex: 1, backgroundColor: "rgba(23,32,26,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: C.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 28, maxHeight: "70%" },
  sheetGrabber: { width: 36, height: 4, borderRadius: 999, backgroundColor: C.border, alignSelf: "center", marginTop: 10, marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: C.ink, marginBottom: 8 },
  sheetEmpty: { fontSize: 13.5, color: C.ink3, paddingVertical: 20, textAlign: "center" },
  sheetRow: {
    flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "space-between",
    paddingVertical: 15, borderTopWidth: 1, borderTopColor: C.borderLight,
  },
  sheetRowFirst: { borderTopWidth: 0 },
  sheetRowTxt: { fontSize: 15, color: C.ink, flex: 1 },
});
