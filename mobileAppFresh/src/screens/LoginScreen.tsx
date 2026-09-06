/**
 * LoginScreen — Phone + Password only.
 *
 * College selection was removed from here: phone numbers are now globally
 * unique across the whole platform (see backend models.py User.phone), so
 * phone + password alone identifies the account -- the backend derives
 * college_id from the account, it never trusts a client-supplied one.
 * College is only ever chosen once, at registration (RegisterScreen).
 *
 * Fixed layout, no ScrollView -- fits without scrolling on typical phones;
 * KeyboardAvoidingView handles the keyboard rather than a scroll container.
 * All entrance/press animations use the native driver (opacity/transform
 * only) for smooth 60fps on both platforms.
 */
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check, Eye, EyeOff, Lock, Phone } from "lucide-react-native";
import { loginUser } from "../services/auth";
import { getFoodColors } from "../theme/foodTheme";
import type { RootStackParamList } from "../types/navigation";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

const C = getFoodColors(false);

export default function LoginScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    AsyncStorage.multiGet(["savedPhone", "rememberMe"]).then(([[, savedPhone], [, savedRemember]]) => {
      if (savedPhone && savedRemember === "true") {
        setPhone(savedPhone);
        setRememberMe(true);
      }
    });

    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 9, tension: 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (loading) return;
    setError("");

    if (!phone.trim() || !password) { setError("Enter phone number and password"); return; }

    setLoading(true);
    try {
      await loginUser(phone.trim(), password);

      if (rememberMe) {
        await AsyncStorage.multiSet([["savedPhone", phone.trim()], ["rememberMe", "true"]]);
      } else {
        await AsyncStorage.multiRemove(["savedPhone", "rememberMe"]);
      }

      navigation.replace("MainTabs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={S.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}
      >
        <View style={S.root}>
          <Animated.View style={[S.card, { opacity: fade, transform: [{ translateY: slide }] }]}>
            <View style={S.brandRow}>
              <Image source={require("../assets/logo.png")} style={S.brandTile} resizeMode="contain" />
              <Text style={S.brandName}>College Saapaadu</Text>
            </View>

            <Text style={S.title}>Welcome back</Text>
            <Text style={S.subtitle}>Log in to order from your campus canteens</Text>

            <View style={S.form}>
              <View style={S.field}>
                <Text style={S.label}>Phone Number</Text>
                <View style={S.input}>
                  <Phone size={16} color={C.ink4} strokeWidth={2} />
                  <TextInput
                    style={S.textInput}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={C.ink4}
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={phone}
                    onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                    autoCorrect={false}
                    autoFocus
                  />
                </View>
              </View>

              <View style={S.field}>
                <Text style={S.label}>Password</Text>
                <View style={S.input}>
                  <Lock size={16} color={C.ink4} strokeWidth={2} />
                  <TextInput
                    style={S.textInput}
                    placeholder="Enter your password"
                    placeholderTextColor={C.ink4}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowPassword((v) => !v)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    {showPassword ? <EyeOff size={16} color={C.ink4} /> : <Eye size={16} color={C.ink4} />}
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity style={S.rememberRow} onPress={() => setRememberMe((v) => !v)} activeOpacity={0.7}>
                <View style={[S.checkbox, rememberMe && S.checkboxOn]}>
                  {rememberMe && <Check size={12} color="#FFF" strokeWidth={3} />}
                </View>
                <Text style={S.rememberTxt}>Remember my phone number</Text>
              </TouchableOpacity>

              {error ? <Text style={S.error}>{error}</Text> : null}

              <TouchableOpacity style={[S.loginBtn, loading && S.loginBtnDisabled]} onPress={handleLogin} disabled={loading} activeOpacity={0.88}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={S.loginBtnTxt}>Log In</Text>}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigation.navigate("RegisterScreen")} style={S.registerRow}>
                <Text style={S.registerTxt}>New here? <Text style={S.registerLink}>Create an account</Text></Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const S = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  root: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },

  card: { gap: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 28 },
  brandTile: {
    width: 44, height: 44, borderRadius: 13, backgroundColor: C.forest,
    alignItems: "center", justifyContent: "center",
    shadowColor: C.forest, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.28, shadowRadius: 8, elevation: 4,
  },
  brandName: { fontSize: 21, fontWeight: "800", color: C.ink, letterSpacing: -0.3 },

  title: { fontSize: 26, fontWeight: "800", color: C.ink, letterSpacing: -0.4 },
  subtitle: { fontSize: 13.5, color: C.ink3, marginTop: 4, marginBottom: 24 },

  form: { gap: 16 },
  field: { gap: 7 },
  label: { fontSize: 12.5, fontWeight: "600", color: C.ink2 },

  input: {
    flexDirection: "row", alignItems: "center", gap: 10, height: 50,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, paddingHorizontal: 14,
  },
  textInput: { flex: 1, fontSize: 15, color: C.ink, padding: 0, height: "100%" },

  rememberRow: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: -4 },
  checkbox: {
    width: 19, height: 19, borderRadius: 5, borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.action, borderColor: C.action },
  rememberTxt: { fontSize: 13, color: C.ink2 },

  error: { color: C.red, fontSize: 12.5, fontWeight: "600" },

  loginBtn: { height: 50, borderRadius: 10, backgroundColor: C.action, alignItems: "center", justifyContent: "center", marginTop: 4 },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnTxt: { color: "#FFF", fontSize: 15.5, fontWeight: "700" },

  registerRow: { alignItems: "center", marginTop: 8 },
  registerTxt: { fontSize: 13.5, color: C.ink3 },
  registerLink: { color: C.action, fontWeight: "700" },
});
