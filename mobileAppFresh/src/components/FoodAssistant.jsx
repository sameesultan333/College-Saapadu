// FoodAssistant.jsx — Fixed: voice Android 12-13, empty space removed, personalised recs
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Animated, ActivityIndicator, StyleSheet, Dimensions,
  ScrollView, Pressable, Keyboard, Platform, Modal,
  KeyboardAvoidingView, PermissionsAndroid, Vibration,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  ChefHat, Send, X, Mic, ShoppingCart, Sparkles,
  UtensilsCrossed, Leaf, Drumstick, TrendingUp,
  Star, ChevronRight, BarChart2, History, Zap, Volume2,
} from "lucide-react-native";
import Voice from "@dev-amirzubair/react-native-voice";
import { API_URL } from "../services/config";
import { authFetch } from "../services/auth";

const { width: W, height: H } = Dimensions.get("window");
const API = API_URL;
const AUTO_CLOSE_MS = 90_000;
const PANEL_H = Math.min(H * 0.74, 760);
const BUBBLE_BOTTOM = 80;
const VOICE_LOCALES = ["en-IN", "en-US"];

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: "#FEFAF5", surface: "#FFFFFF", surfaceWarm: "#FDF7EE",
  border: "#EAD9C2", borderLight: "#F3EAD8",
  ink: "#1A0F05", textSub: "#5C3A1E", textMuted: "#8B6240", textHint: "#B89060",
  spice: "#E8440A", spiceLight: "#FFF0EA", spiceDark: "#C2340A",
  turmeric: "#F4A800", turmericLight: "#FFF8E0",
  mint: "#1DB954", mintLight: "#E8F9EE",
  red: "#E53E3E", redLight: "#FFF5F5",
  purple: "#6D28D9", purpleLight: "#F0EAFF",
  shadowSpice: "rgba(232,68,10,0.28)", shadowDark: "rgba(26,15,5,0.10)",
};
const T = { xs: 10, sm: 11, base: 13, md: 14, lg: 16 };

// ─── Time Slot ─────────────────────────────────────────────────────────────────
const SLOT_KWS = {
  breakfast: ["idli","dosa","upma","pongal","vada","coffee","tea","paratha","omelette","poha","uttapam","puttu","appam","bread"],
  lunch: ["rice","biryani","curry","dal","sambar","rasam","chicken","mutton","fish","paneer","roti","naan","chapati","thali","meals","pulao"],
  snack: ["coffee","tea","samosa","vada","bajji","bonda","sandwich","juice","shake","cake","fries","murukku"],
  dinner: ["rice","biryani","roti","naan","chapati","curry","dal","chicken","paneer","soup","paratha","pulao"],
};
const getSlot = () => {
  const h = new Date().getHours();
  if (h >= 4 && h < 11) return "breakfast";
  if (h >= 11 && h < 16) return "lunch";
  if (h >= 16 && h < 19) return "snack";
  return "dinner";
};
const SLOT_LABEL = { breakfast: "Breakfast", lunch: "Lunch", snack: "Evening Snack", dinner: "Dinner" };
const getGreeting = () => ({
  breakfast: "Good morning! Ready for breakfast? Tell me what you want.",
  lunch: "Lunch time! What are you in the mood for today?",
  snack: "Evening snack time! Coffee, vada, samosa — just ask.",
  dinner: "Good evening! What would you like for dinner?",
}[getSlot()]);

// ─── NLP ───────────────────────────────────────────────────────────────────────
const tokenize = (s) => s.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter(w => w.length > 1);
const fuzzyScore = (query, target) => {
  const qt = tokenize(query), tt = tokenize(target);
  let score = 0;
  for (const qw of qt)
    for (const tw of tt) {
      if (tw === qw) { score += 3; continue; }
      if (tw.includes(qw) || qw.includes(tw)) { score += 2; continue; }
      if (qw.length >= 3 && tw.startsWith(qw)) { score += 1.5; continue; }
    }
  return score;
};
const findItem = (query, items) => {
  const scored = items
    .map(m => ({ m, s: fuzzyScore(query, m.name) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s);
  return scored[0]?.s >= 1.5 ? scored[0].m : null;
};
const findCanteenInText = (text, allItems) => {
  const t = text.toLowerCase();
  const map = {};
  for (const m of allItems) {
    const key = (m.canteen_name || "").toLowerCase();
    if (key) { if (!map[key]) map[key] = []; map[key].push(m); }
  }
  const names = Object.keys(map).sort((a, b) => b.length - a.length);
  for (const cn of names) {
    if (t.includes(cn))
      return { canteenName: map[cn][0]?.canteen_name || cn, canteenItems: map[cn] };
  }
  return null;
};
const stripCanteen = (text, name) => {
  if (!name) return text;
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`\\s*(?:from|at|in)\\s+${esc}\\s*`, "i"), " ").replace(/\s+/g, " ").trim();
};

// ─── Recommendation Engine ─────────────────────────────────────────────────────
const buildRecs = (history = [], menu = [], topN = 6) => {
  const slot = getSlot();
  const kws = SLOT_KWS[slot] || [];

  // Build frequency map from order history
  const freq = {};
  const lastOrderedAt = {}; // track recency
  history.forEach((o, orderIdx) => {
    for (const it of o.items || []) {
      const k = it.name.toLowerCase();
      freq[k] = (freq[k] || 0) + (it.quantity || 1);
      // more recent orders get higher recency weight
      if (!lastOrderedAt[k] || orderIdx > lastOrderedAt[k]) lastOrderedAt[k] = orderIdx;
    }
  });

  const scored = menu.map(m => {
    const key = m.name.toLowerCase();
    let uScore = 0;
    for (const [hk, cnt] of Object.entries(freq)) {
      const s = fuzzyScore(hk, key);
      if (s > 0) {
        const recencyWeight = 1 + (lastOrderedAt[hk] || 0) * 0.1;
        uScore += cnt * s * recencyWeight;
      }
    }
    const tScore = kws.some(kw => key.includes(kw)) ? 3 : 0;
    const stockBonus = (m.stock || 0) > 0 ? 1 : 0;
    return { ...m, _score: uScore * 2 + tScore + (m.is_veg ? 0.3 : 0) + stockBonus, _uScore: uScore, _tScore: tScore };
  }).sort((a, b) => b._score - a._score);

  return {
    personalised: scored.filter(m => m._uScore > 0).slice(0, topN),
    timeBased: scored.filter(m => m._tScore > 0 && m._uScore === 0).slice(0, topN),
    popular: scored.slice(0, topN),
    slot,
    hasHistory: history.length > 0,
  };
};

// ─── Intent Parser ─────────────────────────────────────────────────────────────
const parseIntent = (raw, menuItems = []) => {
  const t = raw.toLowerCase().trim();
  if (/\b(cart|my.?order|what.*added|show.*cart|view.*cart)\b/.test(t)) return { type: "VIEW_CART" };
  if (/\b(order.?history|past.?order|previous.?order|reorder)\b/.test(t)) return { type: "ORDER_HISTORY" };
  if (/\b(analytic|stat|insight|spending|my.?stats)\b/.test(t)) return { type: "ANALYTICS" };
  if (/^(hi|hello|hey|hai|yo|sup|hiya|namaste)\b/.test(t)) return { type: "GREETING" };
  if (/\b(help|what.?can.?you|commands)\b/.test(t)) return { type: "HELP" };
  if (/\b(recommend|suggest|what.*good|what.*should|surprise|what.*order|any.*good)\b/.test(t)) return { type: "RECOMMEND" };
  if (/\b(menu|available|what.*have|show.*food|all.*food|browse|list|today)\b/.test(t)) return { type: "SHOW_MENU" };
  if (/\b(checkout|place.?order|confirm.?order|pay now|order.?now)\b/.test(t)) return { type: "CHECKOUT" };
  const pm = t.match(/(?:under|below|less.?than|max|within)\s*[₹rs]?\s*(\d+)/);
  if (pm) return { type: "PRICE_FILTER", max: parseInt(pm[1]) };
  if (/\b(cheap|budget|affordable)\b/.test(t)) return { type: "PRICE_FILTER", max: 60 };
  if (/non.?veg|nonveg/.test(t)) return { type: "NONVEG_FILTER" };
  if (/(?<!non.)(^|\s)(veg\b|vegetarian|only.?veg|pure.?veg)/.test(t)) return { type: "VEG_FILTER" };
  if (/\b(popular|trending|best|top|most.?ordered)\b/.test(t)) return { type: "POPULAR_ITEMS" };
  if (/\b(south.?indian|dosa|idli|vada|sambar|pongal)\b/.test(t)) return { type: "CUISINE_SOUTH" };
  if (/\b(north.?indian|naan|roti|chapati|paneer)\b/.test(t)) return { type: "CUISINE_NORTH" };
  if (/\bbreakfast\b/.test(t)) return { type: "TIME_SLOT", slot: "breakfast" };
  if (/\blunch\b/.test(t)) return { type: "TIME_SLOT", slot: "lunch" };
  if (/\b(snack|evening)\b/.test(t)) return { type: "TIME_SLOT", slot: "snack" };
  if (/\bdinner\b/.test(t)) return { type: "TIME_SLOT", slot: "dinner" };
  const rm = t.match(/^(?:remove|delete|cancel)\s+(.+)/);
  if (rm) return { type: "REMOVE_ITEM", query: rm[1].trim() };

  const canteenMatch = findCanteenInText(t, menuItems);
  const pool = canteenMatch?.canteenItems || menuItems;
  const canteenName = canteenMatch?.canteenName || null;
  let cleaned = canteenName ? stripCanteen(t, canteenName) : t;
  cleaned = cleaned.replace(/^(?:order|add|get\s+me|give\s+me|i\s+want|i'd\s+like)\s+/i, "").trim();

  let qty = 1;
  const qtyPats = [/(?:quantity|qty|q)\s*(\d+)/i, /(\d+)\s+(?:pieces?|pcs?|nos?\.?|plates?)/i, /^(\d+)\s+/, /\s+(\d+)$/];
  for (const pat of qtyPats) {
    const m = cleaned.match(pat);
    if (m) { qty = Math.min(parseInt(m[1]), 10); cleaned = cleaned.replace(m[0], "").trim(); break; }
  }
  cleaned = cleaned.replace(/^\d+\s*/, "").replace(/\s*\d+$/, "").trim();

  if (cleaned.length > 1) {
    const item = findItem(cleaned, pool);
    if (item) return { type: "ADD_ITEM", item, qty, canteenName };
  }
  const direct = findItem(t, pool);
  if (direct) return { type: "ADD_ITEM", item: direct, qty: 1, canteenName };
  if (canteenMatch && !cleaned.length)
    return { type: "CANTEEN_MENU", canteenName: canteenMatch.canteenName, items: canteenMatch.canteenItems };
  if (t.length > 2) return { type: "SEARCH_QUERY", query: cleaned || t, raw: t };
  return { type: "UNKNOWN", raw: t };
};

// ─── Response Generator ────────────────────────────────────────────────────────
const toCard = (i) => ({ id: i.id, name: i.name, price: i.price, is_veg: i.is_veg, stock: i.stock, canteen_name: i.canteen_name });

const genReply = (intent, menuItems, cart, recs, history, canteens) => {
  switch (intent.type) {
    case "GREETING":
      return { text: `Welcome to CRES-Saapaadu!\n\n**${menuItems.length} items** across **${canteens?.length || 0} canteens**.\n\nTry: "biryani from staff canteen", "veg only", "under ₹50", or say "recommend".` };
    case "HELP":
      return { text: `Here is what I can do:\n\n**Order** — "2 dosas from lemon tree"\n**Filter** — "veg only" or "non-veg"\n**Budget** — "under ₹60"\n**Browse** — "show menu" or "south indian"\n**Recommend** — personalised picks\n**Cart** — "my cart" or "checkout"\n**Stats** — "my stats"` };
    case "RECOMMEND": {
      if (!recs) return { text: "Still loading menus — try in a moment." };
      const { personalised, timeBased, popular, slot, hasHistory } = recs;
      const show = personalised.length ? personalised : timeBased.length ? timeBased : popular;
      const label = personalised.length
        ? `Based on your past orders — ${SLOT_LABEL[slot]} picks for you`
        : `Best for ${SLOT_LABEL[slot]}`;
      return { text: label, items: show.slice(0, 6).map(toCard) };
    }
    case "SHOW_MENU": {
      if (!menuItems.length) return { text: "Menu is loading — please wait a moment." };
      const byC = {};
      for (const it of menuItems) {
        const cn = it.canteen_name || "Canteen";
        if (!byC[cn]) byC[cn] = [];
        if (byC[cn].length < 4) byC[cn].push(it);
      }
      const text = Object.entries(byC).map(([n, its]) => `**${n}**\n${its.map(i => `${i.name} — ₹${i.price}`).join("\n")}`).join("\n\n");
      return { text: `${Object.keys(byC).length} canteens:\n\n${text}\n\nSay "[item] from [canteen]" to order.` };
    }
    case "CANTEEN_MENU": {
      const { canteenName, items } = intent;
      if (!items?.length) return { text: `No items found for ${canteenName}.` };
      return { text: canteenName, items: items.slice(0, 8).map(toCard) };
    }
    case "SEARCH_QUERY": {
      const results = menuItems
        .filter(m => fuzzyScore(intent.query, m.name) >= 1)
        .sort((a, b) => fuzzyScore(intent.query, b.name) - fuzzyScore(intent.query, a.name))
        .slice(0, 6);
      if (!results.length) {
        return { text: `Nothing matched "${intent.query}". Try these:`, items: menuItems.slice(0, 4).map(toCard) };
      }
      return { text: `Results for "${intent.query}"`, items: results.map(toCard) };
    }
    case "PRICE_FILTER": {
      const f = menuItems.filter(i => i.price <= intent.max).sort((a, b) => a.price - b.price);
      if (!f.length) return { text: `Nothing under ₹${intent.max}. Try "under ₹80".` };
      return { text: `Under ₹${intent.max} — ${f.length} items`, items: f.slice(0, 8).map(toCard) };
    }
    case "VEG_FILTER": {
      const v = menuItems.filter(i => i.is_veg);
      if (!v.length) return { text: "No vegetarian items found in the menu." };
      return { text: `Vegetarian — ${v.length} items`, items: v.slice(0, 8).map(toCard) };
    }
    case "NONVEG_FILTER": {
      const nv = menuItems.filter(i => !i.is_veg);
      if (!nv.length) return { text: "No non-vegetarian items found in the menu." };
      return { text: `Non-Vegetarian — ${nv.length} items`, items: nv.slice(0, 8).map(toCard) };
    }
    case "POPULAR_ITEMS": {
      const p = recs?.popular?.length ? recs.popular : menuItems.slice(0, 6);
      return { text: "Most Popular", items: p.slice(0, 6).map(toCard) };
    }
    case "CUISINE_SOUTH": {
      const re = /dosa|idli|vada|sambar|pongal|upma|uttapam|rasam|rice|curry|medu|coffee|appam|puttu/;
      const s = menuItems.filter(i => re.test(i.name.toLowerCase()));
      if (!s.length) return { text: "No South Indian items in the current menu." };
      return { text: `South Indian — ${s.length} items`, items: s.slice(0, 8).map(toCard) };
    }
    case "CUISINE_NORTH": {
      const re = /naan|roti|chapati|paratha|paneer|dal|butter|sabzi|rajma|tandoor/;
      const n = menuItems.filter(i => re.test(i.name.toLowerCase()));
      if (!n.length) return { text: "No North Indian items in the current menu." };
      return { text: `North Indian — ${n.length} items`, items: n.slice(0, 8).map(toCard) };
    }
    case "TIME_SLOT": {
      const kws = SLOT_KWS[intent.slot] || [];
      const its = menuItems.filter(i => kws.some(kw => i.name.toLowerCase().includes(kw))).slice(0, 8);
      if (!its.length) return { text: `No specific ${SLOT_LABEL[intent.slot]} items found. Try "show menu".` };
      return { text: `${SLOT_LABEL[intent.slot]} items`, items: its.map(toCard) };
    }
    case "ADD_ITEM": {
      const { item, qty } = intent;
      if ((item.stock || 0) <= 0)
        return { text: `**${item.name}** is out of stock.\n\nSay "recommend" to find available options.` };
      return {
        text: `Added **${qty > 1 ? `${qty}x ` : ""}${item.name}** to cart.\n\n₹${item.price}${qty > 1 ? ` x ${qty} = **₹${item.price * qty}**` : ""} · ${item.canteen_name || "Canteen"}\n\nSay "checkout" to place your order.`,
      };
    }
    case "REMOVE_ITEM":
      return { text: "Item removed from cart. Say 'my cart' to review." };
    case "VIEW_CART": {
      if (!cart.length) return { text: "Your cart is empty.\n\nSay any food name to add, or try 'recommend'." };
      const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
      const lines = cart.map(c => `${c.item.name}${c.qty > 1 ? ` x${c.qty}` : ""} — ₹${c.item.price * c.qty}`).join("\n");
      return { text: `Cart — ${cart.reduce((s, c) => s + c.qty, 0)} items:\n\n${lines}\n\n**Total: ₹${total}**\n\nSay "checkout" to order.` };
    }
    case "CHECKOUT":
      return cart.length
        ? { text: `Placing order for ${cart.reduce((s, c) => s + c.qty, 0)} item(s)…` }
        : { text: "Your cart is empty.\n\nSay 'show menu' or 'recommend' to get started." };
    case "ORDER_HISTORY":
      return { text: "Opening your order history…" };
    case "ANALYTICS": {
      if (!history.length) return { text: "No order history yet. Place your first order to start tracking." };
      const total = history.reduce((s, o) => s + (o.total_amount || 0), 0);
      const count = history.length;
      const freq = {};
      for (const o of history) for (const it of o.items || []) freq[it.name] = (freq[it.name] || 0) + (it.quantity || 1);
      const fave = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
      return {
        text: `Food Analytics\n\nOrders: **${count}**\nTotal Spent: **₹${total}**\nAvg per Order: **₹${Math.round(total / count)}**${fave ? `\nFavourite: **${fave[0]}** (x${fave[1]})` : ""}`,
      };
    }
    default:
      if (intent.raw && intent.raw.length < 15) {
         return { text: `I heard **"${intent.raw}"** but couldn't find a match. Try tapping the mic again.` };
      }
      return { text: `Not sure what you mean. Try:\n\n**"biryani from staff canteen"** — canteen order\n**"veg only"** — filter items\n**"recommend"** — AI picks\n**"show menu"** — browse all` };
  }
};

// ─── Rich Text ─────────────────────────────────────────────────────────────────
function RichText({ text, isUser }) {
  const lines = (text || "").split("\n");
  return (
    <Text>
      {lines.map((line, li) => {
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
          <Text key={li} style={isUser ? bs.userText : bs.botText}>
            {parts.map((p, pi) =>
              p.startsWith("**") && p.endsWith("**")
                ? <Text key={pi} style={isUser ? bs.userBold : bs.botBold}>{p.slice(2, -2)}</Text>
                : <Text key={pi}>{p}</Text>
            )}
            {li < lines.length - 1 ? "\n" : ""}
          </Text>
        );
      })}
    </Text>
  );
}

// ─── Voice Waveform ────────────────────────────────────────────────────────────
function VoiceWaveform({ isListening, pitchAnim }) {
  const bars = useRef([...Array(12)].map(() => new Animated.Value(0.3))).current;

  // We'll combine a gentle random baseline with the actual pitch data
  useEffect(() => {
    if (!isListening) return;
    const animations = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bar, { toValue: 0.6 + Math.random() * 0.4, duration: 200 + Math.random() * 150, useNativeDriver: true }),
          Animated.timing(bar, { toValue: 0.3, duration: 200 + Math.random() * 150, useNativeDriver: true }),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [isListening, bars]);

  return (
    <View style={vw.row}>
      {bars.map((bar, i) => {
        // The pitch is typically 0-10. We interpolate it to a scale multiplier.
        // Even indices get slightly more boost for a nice waveform look.
        const pitchScale = pitchAnim.interpolate({
          inputRange: [0, 5, 10],
          outputRange: [1, i % 2 === 0 ? 1.8 : 1.4, i % 2 === 0 ? 2.8 : 2.0],
          extrapolate: "clamp"
        });
        
        return (
          <Animated.View 
            key={i} 
            style={[
              vw.bar, 
              { 
                transform: [
                  { scaleY: bar },
                  { scaleY: pitchScale }
                ] 
              }
            ]} 
          />
        );
      })}
    </View>
  );
}

function MicRipple({ pitchAnim }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1500, useNativeDriver: true })
    ).start();
  }, []);
  
  // Outer passive ring
  const outerScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const outerOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });
  
  // Inner active ring expands with actual voice pitch
  const innerScale = pitchAnim.interpolate({ inputRange: [0, 10], outputRange: [1, 1.8], extrapolate: "clamp" });
  const innerOpacity = pitchAnim.interpolate({ inputRange: [0, 10], outputRange: [0.2, 0.6], extrapolate: "clamp" });

  return (
    <>
      <Animated.View style={[fl.micRipple, { opacity: outerOpacity, transform: [{ scale: outerScale }] }]} />
      <Animated.View style={[fl.micRipple, { backgroundColor: C.coral, opacity: innerOpacity, transform: [{ scale: innerScale }] }]} />
    </>
  );
}
const vw = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3, height: 32 },
  bar: { width: 3, height: 8, backgroundColor: C.red, borderRadius: 2 },
});

// ─── Item Card ─────────────────────────────────────────────────────────────────
function ItemCard({ item, onAdd }) {
  const isOOS = (item.stock || 0) <= 0;
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    if (isOOS) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.94, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    onAdd(item);
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={[ic.card, isOOS && ic.oos]} onPress={press} activeOpacity={0.85}>
        <View style={ic.left}>
          <View style={[ic.dot, { backgroundColor: item.is_veg ? C.mint : C.spice }]} />
          <View style={ic.info}>
            <Text style={ic.name} numberOfLines={1}>{item.name}</Text>
            {item.canteen_name ? <Text style={ic.canteen} numberOfLines={1}>{item.canteen_name}</Text> : null}
          </View>
        </View>
        <View style={ic.right}>
          <Text style={ic.price}>Rs.{item.price}</Text>
          {isOOS
            ? <View style={ic.oosBadge}><Text style={ic.oosText}>Out of stock</Text></View>
            : <View style={ic.addBtn}><Text style={ic.addText}>Add</Text></View>
          }
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
const ic = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 6 },
  oos: { opacity: 0.52 },
  left: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  info: { flex: 1 },
  name: { fontSize: T.base, fontWeight: "700", color: C.ink },
  canteen: { fontSize: T.xs, color: C.textMuted, marginTop: 1 },
  right: { alignItems: "flex-end", gap: 4, marginLeft: 8 },
  price: { fontSize: T.base, fontWeight: "800", color: C.textSub },
  addBtn: { backgroundColor: C.spice, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  addText: { fontSize: T.xs, fontWeight: "800", color: "#FFF" },
  oosBadge: { backgroundColor: C.redLight, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  oosText: { fontSize: T.xs, fontWeight: "700", color: C.red },
});

// ─── Chat Bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ msg, onAddItem }) {
  const isUser = msg.role === "user";
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(isUser ? 16 : -16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(slide, { toValue: 0, friction: 10, tension: 90, useNativeDriver: true }),
    ]).start();
  }, []);
  return (
    <Animated.View style={[bs.row, isUser ? bs.rowUser : bs.rowBot, { opacity: fade, transform: [{ translateX: slide }] }]}>
      {!isUser && (
        <View style={bs.botAv}><ChefHat size={14} color="#FFF" strokeWidth={2.5} /></View>
      )}
      <View style={[bs.bubble, isUser ? bs.bubbleUser : bs.bubbleBot]}>
        <RichText text={msg.text} isUser={isUser} />
        {msg.items?.length > 0 && (
          <View style={bs.itemsWrap}>
            {msg.items.map(item => (
              <ItemCard key={`${item.id}-${item.canteen_name}`} item={item} onAdd={onAddItem} />
            ))}
          </View>
        )}
        <Text style={[bs.time, isUser && bs.timeUser]}>{msg.time}</Text>
      </View>
      {isUser && (
        <View style={bs.userAv}><Text style={bs.userAvText}>U</Text></View>
      )}
    </Animated.View>
  );
}
const bs = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 6, paddingHorizontal: 10 },
  rowUser: { justifyContent: "flex-end" },
  rowBot: { justifyContent: "flex-start" },
  botAv: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.spice, alignItems: "center", justifyContent: "center", marginRight: 7, flexShrink: 0 },
  userAv: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.spiceLight, alignItems: "center", justifyContent: "center", marginLeft: 7, flexShrink: 0, borderWidth: 1.5, borderColor: C.border },
  userAvText: { fontSize: T.xs, fontWeight: "900", color: C.spice },
  bubble: { maxWidth: W * 0.82, borderRadius: 16, paddingHorizontal: 11, paddingTop: 7, paddingBottom: 4 },
  bubbleUser: { backgroundColor: C.spice, borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: C.surface, borderBottomLeftRadius: 4, borderWidth: 1.5, borderColor: C.border },
  userText: { fontSize: T.base, color: "#FFF", lineHeight: 21 },
  botText: { fontSize: T.base, color: C.ink, lineHeight: 21 },
  userBold: { fontWeight: "800", color: "#FFF" },
  botBold: { fontWeight: "800", color: C.ink },
  itemsWrap: { marginTop: 8 },
  time: { fontSize: 9, color: C.textHint, marginTop: 4, textAlign: "right" },
  timeUser: { color: "rgba(255,255,255,0.55)" },
});

// ─── Typing Dots ───────────────────────────────────────────────────────────────
function TypingDots() {
  const dots = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.3)).current];
  useEffect(() => {
    dots.forEach((d, i) => {
      Animated.loop(Animated.sequence([
        Animated.delay(i * 180),
        Animated.timing(d, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0.3, duration: 350, useNativeDriver: true }),
      ])).start();
    });
  }, []);
  return (
    <View style={ty.row}>
      <View style={ty.av}><ChefHat size={12} color="#FFF" /></View>
      <View style={ty.bubble}>
        {dots.map((d, i) => <Animated.View key={i} style={[ty.dot, { opacity: d }]} />)}
      </View>
    </View>
  );
}
const ty = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, marginBottom: 6 },
  av: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.spice, alignItems: "center", justifyContent: "center", marginRight: 7 },
  bubble: { flexDirection: "row", gap: 4, backgroundColor: C.surface, borderRadius: 16, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.textMuted },
});

// ─── Cart Bar ──────────────────────────────────────────────────────────────────
function CartBar({ cart, onCheckout, onClear }) {
  const count = cart.reduce((s, c) => s + c.qty, 0);
  const total = cart.reduce((s, c) => s + c.item.price * c.qty, 0);
  const slideY = useRef(new Animated.Value(48)).current;
  useEffect(() => {
    Animated.spring(slideY, { toValue: cart.length ? 0 : 48, friction: 8, useNativeDriver: true }).start();
  }, [cart.length]);
  if (!cart.length) return null;
  return (
    <Animated.View style={[ca.wrap, { transform: [{ translateY: slideY }] }]}>
      <TouchableOpacity style={ca.clear} onPress={onClear} activeOpacity={0.7}>
        <X size={14} color={C.textMuted} />
      </TouchableOpacity>
      <View style={ca.info}>
        <ShoppingCart size={16} color={C.turmeric} />
        <Text style={ca.count}>{count} item{count !== 1 ? "s" : ""}</Text>
        <Text style={ca.total}>Rs.{total}</Text>
      </View>
      <TouchableOpacity style={ca.btn} onPress={onCheckout} activeOpacity={0.85}>
        <Text style={ca.btnText}>Checkout</Text>
        <ChevronRight size={14} color="#FFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}
const ca = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 2, borderTopColor: C.turmeric },
  clear: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: C.surfaceWarm, borderWidth: 1.5, borderColor: C.border },
  info: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: { fontSize: T.sm, fontWeight: "700", color: C.textSub },
  total: { fontSize: T.md, fontWeight: "900", color: C.ink },
  btn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.spice, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 9 },
  btnText: { fontSize: T.sm, fontWeight: "900", color: "#FFF" },
});

// ─── Quick Chips ───────────────────────────────────────────────────────────────
const CHIPS = [
  { label: "Recommend", Icon: Sparkles, msg: "recommend" },
  { label: "Menu", Icon: UtensilsCrossed, msg: "show menu" },
  { label: "Veg", Icon: Leaf, msg: "veg only" },
  { label: "Non-Veg", Icon: Drumstick, msg: "non-veg" },
  { label: "Under Rs.50", Icon: TrendingUp, msg: "under 50" },
  { label: "Popular", Icon: Star, msg: "popular" },
  { label: "My Cart", Icon: ShoppingCart, msg: "my cart" },
  { label: "Stats", Icon: BarChart2, msg: "my stats" },
  { label: "History", Icon: History, msg: "order history" },
];

// ─── Panel Header ──────────────────────────────────────────────────────────────
function PanelHeader({ menuCount, canteenCount, loading, bubbleColor, onClose }) {
  return (
    <View style={ph.wrap}>
      <View style={ph.left}>
        <View style={[ph.av, { backgroundColor: bubbleColor }]}>
          <ChefHat size={18} color="#FFF" strokeWidth={2.5} />
        </View>
        <View>
          <Text style={ph.title}>Food Assistant</Text>
          <Text style={ph.sub}>{loading ? "Loading menus…" : `${menuCount} items · ${canteenCount} canteens`}</Text>
        </View>
      </View>
      <View style={ph.right}>
        <View style={[ph.dot, { backgroundColor: loading ? C.turmeric : C.mint }]} />
        <Text style={[ph.dotLbl, { color: loading ? C.turmeric : C.mint }]}>{loading ? "loading" : "live"}</Text>
        <TouchableOpacity style={ph.xBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={14} color={C.textSub} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
const ph = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1.5, borderBottomColor: C.border, backgroundColor: C.surface },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  av: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: T.md, fontWeight: "900", color: C.ink },
  sub: { fontSize: T.xs, color: C.textMuted, marginTop: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  dotLbl: { fontSize: 9, fontWeight: "700" },
  xBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.surfaceWarm, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: C.border, marginLeft: 4 },
});

// ─── Stats Strip ───────────────────────────────────────────────────────────────
function StatsStrip({ history }) {
  if (!history?.length) return null;
  const total = history.reduce((s, o) => s + (o.total_amount || 0), 0);
  const count = history.length;
  const freq = {};
  for (const o of history) for (const it of o.items || []) freq[it.name] = (freq[it.name] || 0) + (it.quantity || 1);
  const fave = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
  return (
    <View style={st.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.row} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, alignItems: "center" }}>
        <View style={st.chip}><Text style={st.val}>{count}</Text><Text style={st.lbl}>Orders</Text></View>
        <View style={st.chip}><Text style={st.val}>Rs.{total}</Text><Text style={st.lbl}>Spent</Text></View>
        <View style={st.chip}><Text style={st.val}>Rs.{Math.round(total / count)}</Text><Text style={st.lbl}>Avg</Text></View>
        {fave && (
          <View style={[st.chip, { backgroundColor: C.turmericLight, borderColor: C.turmeric }]}>
            <Text style={[st.val, { color: C.turmeric, fontSize: T.xs }]} numberOfLines={1}>{fave[0].split(" ").slice(0, 2).join(" ")}</Text>
            <Text style={st.lbl}>Fave x{fave[1]}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
const st = StyleSheet.create({
  wrap: { height: 52, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.surfaceWarm, justifyContent: "center" },
  row: { flexGrow: 0 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: C.surface, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: "center", minWidth: 52 },
  val: { fontSize: T.sm, fontWeight: "900", color: C.ink },
  lbl: { fontSize: 9, color: C.textMuted, marginTop: 1 },
});

const nowTime = () => {
  const d = new Date();
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

// ─── Personalised Banner ───────────────────────────────────────────────────────
// Shows favourite items from history as a quick re-order strip
function PersonalisedBanner({ recs, onAddItem }) {
  if (!recs?.hasHistory || !recs?.personalised?.length) return null;
  return (
    <View style={pb.wrap}>
      <Text style={pb.label}>⭐ Your usuals</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={pb.row}>
        {recs.personalised.slice(0, 5).map(item => (
          <TouchableOpacity
            key={item.id}
            style={[pb.pill, (item.stock || 0) <= 0 && pb.pillOOS]}
            onPress={() => (item.stock || 0) > 0 && onAddItem(item)}
            activeOpacity={0.75}
          >
            <View style={[pb.dot, { backgroundColor: item.is_veg ? C.mint : C.spice }]} />
            <Text style={pb.name} numberOfLines={1}>{item.name}</Text>
            <Text style={pb.price}>₹{item.price}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
const pb = StyleSheet.create({
  wrap: { backgroundColor: C.turmericLight, borderBottomWidth: 1, borderBottomColor: C.border, paddingTop: 6, paddingBottom: 4 },
  label: { fontSize: T.xs, fontWeight: "800", color: C.turmeric, paddingHorizontal: 12, marginBottom: 4 },
  row: { paddingHorizontal: 10, gap: 6 },
  pill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.surface, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1.5, borderColor: C.turmeric },
  pillOOS: { opacity: 0.45 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  name: { fontSize: T.xs, fontWeight: "700", color: C.ink, maxWidth: 90 },
  price: { fontSize: T.xs, fontWeight: "800", color: C.spice },
});

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
// canteens/userId: accepted so callers (e.g. CanteenSelectScreen, which
// already has this data from its own tenant-scoped load) can pass it
// through, but this component still resolves its own menu/canteen data via
// initChat() below -- not wired up further here, out of scope for this fix.
export default function FoodAssistant({ isPeak = false, onClose = () => {}, navigation, canteens: _canteens, userId: _userId }) {
  const insets = useSafeAreaInsets();

  let ctxAdd = null, ctxClear = null;
  try {
    const { useCart } = require("../context/CartContext");
    const ctx = useCart();
    ctxAdd = ctx?.addToCart;
    ctxClear = ctx?.clearCart;
  } catch (_) {}

  // ── State ────────────────────────────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [menuItems, setMenuItems] = useState([]);
  const [canteens, setCanteens] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [recs, setRecs] = useState(null);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [hasNotif, setHasNotif] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const cartRef = useRef([]);
  const menuRef = useRef([]);
  const recsRef = useRef(null);
  const histRef = useRef([]);
  const canteensRef = useRef([]);
  const voiceTranscriptRef = useRef("");
  const voiceEndTimerRef = useRef(null);
  const handleSendRef = useRef(null);
  const listRef = useRef(null);
  const timerRef = useRef(null);
  // FIX: track voice session state to prevent double-start
  const voiceActiveRef = useRef(false);

  // ── Animations ───────────────────────────────────────────────────────────────
  const slideAnim = useRef(new Animated.Value(PANEL_H)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const bubbleScale = useRef(new Animated.Value(1)).current;
  const bubblePulse = useRef(new Animated.Value(1)).current;
  const badgeBounce = useRef(new Animated.Value(1)).current;
  const pitchAnim = useRef(new Animated.Value(0)).current;

  // ── Cart helpers ─────────────────────────────────────────────────────────────
  const setCartSynced = useCallback((updater) => {
    setCart(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cartRef.current = next;
      return next;
    });
  }, []);

  const syncToCtx = useCallback((cur) => {
    try {
      ctxClear?.();
      cur.forEach(c => {
        for (let i = 0; i < c.qty; i++)
          ctxAdd?.({ id: c.item.id, name: c.item.name, price: c.item.price, canteenId: c.item.canteen_id, canteenName: c.item.canteen_name || "Canteen" });
      });
    } catch (_) {}
  }, [ctxAdd, ctxClear]);

  // ── Bubble animations ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(bubblePulse, { toValue: 1.07, duration: 2400, useNativeDriver: true }),
      Animated.timing(bubblePulse, { toValue: 1, duration: 2400, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(badgeBounce, { toValue: 1.45, duration: 400, useNativeDriver: true }),
      Animated.timing(badgeBounce, { toValue: 1, duration: 400, useNativeDriver: true }),
    ])).start();
  }, []);

  // ── Panel open / close ───────────────────────────────────────────────────────
  const closePanel = useCallback(() => {
    clearTimeout(timerRef.current);
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: PANEL_H, duration: 260, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setExpanded(false));
  }, []);

  const resetTimer = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(closePanel, AUTO_CLOSE_MS);
  }, [closePanel]);

  const openPanel = useCallback(() => {
    setExpanded(true);
    setHasNotif(false);
    slideAnim.setValue(PANEL_H);
    backdropAnim.setValue(0);
    Animated.parallel([
      Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: true }),
      Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    if (!initialized) { setInitialized(true); initChat(); }
    resetTimer();
  }, [initialized, resetTimer]);

  // Fetch with timeout — prevents hanging forever on unreachable server
  const fetchWithTimeout = async (url, ms = 8000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(id);
      return res;
    } catch (e) {
      clearTimeout(id);
      throw e;
    }
  };

  const initChat = async () => {
    setLoading(true);
    try {
      const raw = await AsyncStorage.getItem("user").catch(() => null);
      const user = raw ? JSON.parse(raw) : null;
      const uid = user?.id || null;

      let allCanteens = [];
      let networkErrMsg = null;
      try {
        const cr = await fetchWithTimeout(`${API}/canteens`);
        if (!cr.ok) throw new Error(`Server returned ${cr.status}`);
        const data = await cr.json();
        allCanteens = Array.isArray(data) ? data : [];
      } catch (e) {
        networkErrMsg = e.name === "AbortError"
          ? `Timed out connecting to server.\n\n• Is backend running on your PC?\n• Phone & PC on same WiFi?\n• Correct IP in config.js?`
          : e.message === "Network request failed"
          ? `Can't reach server at:\n${API}\n\nFix checklist:\n1. Backend server running?\n2. Phone & PC same WiFi?\n3. Windows Firewall open on that port?\n4. Correct IP in config.js?`
          : `Server error: ${e.message}`;
        console.warn("Canteen fetch failed:", e.message, "→", `${API}/canteens`);
      }
      setCanteens(allCanteens);
      canteensRef.current = allCanteens;

      // Surface network error immediately — no point continuing with empty data
      if (networkErrMsg) {
        pushMsg("bot", getGreeting(), []);
        setTimeout(() => pushMsg("bot", networkErrMsg, []), 300);
        setLoading(false);
        return;
      }

      let allItems = [];
      if (allCanteens.length > 0) {
        const results = await Promise.allSettled(
          allCanteens.map(c =>
            fetchWithTimeout(`${API}/menu/${c.id}`)
              .then(r => r.json())
              .catch(() => [])
          )
        );
        for (let i = 0; i < results.length; i++) {
          if (results[i].status === "fulfilled") {
            const data = Array.isArray(results[i].value) ? results[i].value : (results[i].value?.items || []);
            allItems = [
              ...allItems,
              ...data.map(m => ({
                ...m,
                canteen_name: allCanteens[i]?.name || `Canteen ${i + 1}`,
                canteen_id: allCanteens[i]?.id,
              })),
            ];
          }
        }
      }
      setMenuItems(allItems);
      menuRef.current = allItems;

      let history = [];
      if (uid) {
        try {
          const hr = await authFetch(`${API}/orders/user/history/${uid}`);
          if (hr.ok) history = await hr.json().catch(() => []);
        } catch (_) {}
      }
      setOrderHistory(history);
      histRef.current = history;

      const newRecs = buildRecs(history, allItems);
      setRecs(newRecs);
      recsRef.current = newRecs;

      pushMsg("bot", getGreeting(), []);
      setTimeout(() => {
        // Personalised welcome if history exists
        const show = newRecs.personalised.length ? newRecs.personalised
          : newRecs.timeBased.length ? newRecs.timeBased
          : newRecs.popular;
        const welcomeText = history.length > 0
          ? `Welcome back! Found **${history.length} past orders** — here are your picks for ${SLOT_LABEL[newRecs.slot]}:`
          : `Loaded **${allItems.length} items** across **${allCanteens.length} canteens**. Here's what's good right now:`;
        pushMsg("bot", welcomeText, show.slice(0, 4).map(toCard));
      }, 600);

    } catch (err) {
      console.error("initChat error:", err);
      pushMsg("bot", "Could not load menus. Check your connection and try again.", []);
    } finally {
      setLoading(false);
    }
  };

  const pushMsg = useCallback((role, text, items = []) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text, items, time: nowTime() }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  }, []);

  const openCheckoutForCart = useCallback((nextCart) => {
    if (!nextCart?.length) return;
    syncToCtx(nextCart);
    closePanel();
    setTimeout(() => navigation?.navigate("CheckoutScreen"), 260);
  }, [closePanel, navigation, syncToCtx]);

  const buildNextCart = useCallback((prev, item, qty) => {
    const idx = prev.findIndex(c => c.item.id === item.id);
    if (idx >= 0) {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty };
      return updated;
    }
    return [...prev, { item, qty }];
  }, []);

  // ── FIXED VOICE — Android 12-13 compatible ───────────────────────────────────
  useEffect(() => {
    const handleSpeechStart = () => {
      clearTimeout(voiceEndTimerRef.current);
      voiceActiveRef.current = true;
      setIsListening(true);
      setVoiceTranscript("Listening…");
      voiceTranscriptRef.current = "";
      Vibration.vibrate(30);
    };

    // Android 12-13: onSpeechEnd fires before results — wait 1200ms for results
    const handleSpeechEnd = () => {
      clearTimeout(voiceEndTimerRef.current);
      setVoiceTranscript("Processing…");
      voiceEndTimerRef.current = setTimeout(() => {
        const text = (voiceTranscriptRef.current || "").trim();
        voiceActiveRef.current = false;
        setIsListening(false);
        setVoiceTranscript("");
        voiceTranscriptRef.current = "";
        if (text.length > 2) {
          setInput("");
          handleSendRef.current?.(text, { source: "voice" });
        }
      }, 1200);
    };

    const handlePartialResults = (e) => {
      const text = (e.value?.[0] || "").trim();
      if (text) {
        clearTimeout(voiceEndTimerRef.current);
        voiceTranscriptRef.current = text;
        setVoiceTranscript(text);
        setInput(text);
      }
    };

    // onSpeechResults fires when recognition is confident — use immediately
    const handleResults = (e) => {
      clearTimeout(voiceEndTimerRef.current);
      const text = (e.value?.[0] || "").trim();
      voiceActiveRef.current = false;
      setIsListening(false);
      setVoiceTranscript("");
      voiceTranscriptRef.current = "";
      if (text.length > 2) {
        setInput("");
        handleSendRef.current?.(text, { source: "voice" });
      }
    };

    const handleError = (e) => {
      clearTimeout(voiceEndTimerRef.current);
      voiceActiveRef.current = false;
      setIsListening(false);
      setVoiceTranscript("");
      voiceTranscriptRef.current = "";
      const code = String(e?.error?.code ?? e?.error ?? "");
      const errMsgs = {
        "9": "Mic permission denied. Enable it in Settings → Apps → Permissions.",
        "5": "Voice recognizer busy. Wait a moment and try again.",
        "6": "Voice service unavailable. Open Google app once to activate it."
      };
      const msg = errMsgs[code];
      // Show actionable errors only in the chat log.
      // Silence timeouts (7, 13) are common and should just silently return to normal state.
      if (msg && ["9", "5", "6"].includes(code)) {
        pushMsg("bot", msg, []);
      }
    };

    Voice.onSpeechStart = handleSpeechStart;
    Voice.onSpeechEnd = handleSpeechEnd;
    Voice.onSpeechPartialResults = handlePartialResults;
    Voice.onSpeechResults = handleResults;
    Voice.onSpeechError = handleError;
    Voice.onSpeechVolumeChanged = (e) => {
      Animated.timing(pitchAnim, { 
        toValue: e.value || 0, 
        duration: 50, 
        useNativeDriver: true 
      }).start();
    };

    return () => {
      clearTimeout(voiceEndTimerRef.current);
      voiceActiveRef.current = false;
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
  }, [pushMsg]);

  // ── toggleVoice — Android 12-13 safe ──────────────────────────────────────
  // ROOT CAUSE of instant errors: calling destroy()/cancel()/stop() before
  // Voice.start() on Android 12-13 kills the SpeechRecognizer instance AND
  // its listeners, so the next start() fires into a dead object → error 5/6.
  // FIX: Never destroy before start. Only stop() when already listening.
  // Re-register listeners once on mount (useEffect above). Never re-destroy mid-session.
  const toggleVoice = async () => {
    // ── Stop if already listening ──────────────────────────────────────────
    if (isListening || voiceActiveRef.current) {
      clearTimeout(voiceEndTimerRef.current);
      voiceActiveRef.current = false;
      setIsListening(false);
      setVoiceTranscript("");
      voiceTranscriptRef.current = "";
      setInput("");
      pitchAnim.setValue(0);
      try { await Voice.stop(); } catch (_) {}
      return;
    }

    // Give instant UI feedback to user immediately!
    voiceActiveRef.current = true;
    setIsListening(true);
    setVoiceTranscript("Starting mic...");

    // ── Request mic permission (Android) ──────────────────────────────────
    if (Platform.OS === "android") {
      const already = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (!already) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: "Microphone Permission",
            message: "Food Assistant needs mic access for voice orders.",
            buttonPositive: "Allow",
            buttonNegative: "Deny",
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          pushMsg("bot", "Mic permission denied.\n\nGo to: Settings → Apps → CRES-Saapaadu → Permissions → Microphone → Allow", []);
          return;
        }
      }
    }

    // ── Check availability ─────────────────────────────────────────────────
    let available = false;
    try { available = await Voice.isAvailable(); } catch (_) {}
    if (!available) {
      pushMsg("bot", "Voice not available on this device.\nMake sure Google app is installed and updated.", []);
      return;
    }

    // ── Start recognition ──────────────────────────────────────────────────
    let started = false;
    for (const locale of VOICE_LOCALES) {
      try {
        await Voice.start(locale);
        started = true;
        break;
      } catch (startErr) {
        console.warn(`Voice.start(${locale}) failed:`, startErr?.message);
        // If error message says "already started", it's actually running — treat as success
        if (String(startErr?.message).includes("already")) {
          started = true;
          break;
        }
      }
    }
    if (!started) {
      voiceActiveRef.current = false;
      setIsListening(false);
      setVoiceTranscript("");
      pushMsg("bot", "Could not start voice.\n\nTry: force-close the app and reopen it.", []);
    } else {
      setVoiceTranscript("Listening..."); // Show proper message once started smoothly
    }
  };

  // ── handleSend ───────────────────────────────────────────────────────────────
  const handleSend = useCallback(async (txt, options = {}) => {
    const { source = "text" } = options;
    const msg = (txt || input).trim();
    if (!msg) return;
    setInput("");
    pushMsg("user", msg, []);
    resetTimer();
    setIsTyping(true);

    const menu = menuRef.current;
    const curRecs = recsRef.current;
    const hist = histRef.current;
    const intent = parseIntent(msg, menu);
    let nextCart = cartRef.current;

    if (intent.type === "ADD_ITEM" && (intent.item.stock || 0) > 0) {
      nextCart = buildNextCart(cartRef.current, intent.item, intent.qty);
      setCartSynced(nextCart);
    }
    if (intent.type === "REMOVE_ITEM") {
      const item = findItem(intent.query, menu);
      if (item) {
        nextCart = cartRef.current.filter(c => c.item.id !== item.id);
        setCartSynced(nextCart);
      }
    }
    if (intent.type === "CHECKOUT") {
      const cur = cartRef.current;
      if (!cur.length) {
        pushMsg("bot", "Your cart is empty. Say 'show menu' or 'recommend' to get started.", []);
        setIsTyping(false);
        return;
      }
      pushMsg("bot", `Placing order for ${cur.reduce((s, c) => s + c.qty, 0)} item(s)…`, []);
      setTimeout(() => openCheckoutForCart(cur), 900);
      setIsTyping(false);
      return;
    }
    if (intent.type === "ORDER_HISTORY") {
      pushMsg("bot", "Opening your order history…", []);
      setTimeout(() => { closePanel(); navigation?.navigate("OrderHistoryScreen"); }, 700);
      setIsTyping(false);
      return;
    }

    const reply = genReply(intent, menu, cartRef.current, curRecs, hist, canteensRef.current);
    setIsTyping(false);
    pushMsg("bot", reply.text, reply.items || []);

    if (source === "voice" && intent.type === "ADD_ITEM" && nextCart.length) {
      setTimeout(() => {
        pushMsg("bot", "Opening checkout to review your voice order.", []);
        openCheckoutForCart(nextCart);
      }, 650);
    }
  }, [input, resetTimer, pushMsg, setCartSynced, buildNextCart, openCheckoutForCart, closePanel, navigation]);

  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const handleAddItem = useCallback((item) => {
    if ((item.stock || 0) <= 0) return;
    setCartSynced(prev => {
      const idx = prev.findIndex(c => c.item.id === item.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = { ...u[idx], qty: u[idx].qty + 1 }; return u; }
      return [...prev, { item, qty: 1 }];
    });
    pushMsg("bot", `Added **${item.name}** to cart. Say "checkout" to place your order.`, []);
  }, [pushMsg, setCartSynced]);

  const goCheckout = useCallback(() => {
    const cur = cartRef.current;
    if (!cur.length) return;
    syncToCtx(cur);
    closePanel();
    navigation?.navigate("CheckoutScreen");
  }, [closePanel, navigation, syncToCtx]);

  const onPressIn = () => Animated.spring(bubbleScale, { toValue: 0.88, friction: 4, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(bubbleScale, { toValue: 1, friction: 4, useNativeDriver: true }).start();

  const bubbleColor = isPeak ? "#D93B0A" : C.spice;
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <>
      {/* ── Floating Bubble ──────────────────────────────────────────────────── */}
      <View style={[fl.bubbleWrap, { bottom: insets.bottom + BUBBLE_BOTTOM }]} pointerEvents="box-none">
        <View style={fl.bubbleRow}>
          {!expanded && hasNotif && (
            <Animated.View style={[fl.hint, { opacity: bubblePulse }]}>
              <Text style={fl.hintText}>Tap to order</Text>
              <View style={fl.hintArrow} />
            </Animated.View>
          )}
          <Animated.View style={{ transform: [{ scale: bubbleScale }, { scale: expanded ? 0.88 : bubblePulse }] }}>
            <Pressable
              style={[fl.bubble, { backgroundColor: bubbleColor }]}
              onPress={expanded ? closePanel : openPanel}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
            >
              <View style={fl.bubbleRing} />
              {expanded
                ? <X size={24} color="#FFF" strokeWidth={2.5} />
                : <ChefHat size={26} color="#FFF" strokeWidth={2} />
              }
              {hasNotif && !expanded && (
                <Animated.View style={[fl.badge, { transform: [{ scale: badgeBounce }] }]}>
                  <Zap size={8} color="#FFF" />
                </Animated.View>
              )}
              {cartCount > 0 && (
                <View style={[fl.badge, fl.cartBadge]}>
                  <Text style={fl.badgeText}>{cartCount}</Text>
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>

      {/* ── Panel Modal ──────────────────────────────────────────────────────── */}
      <Modal visible={expanded} transparent animationType="none" statusBarTranslucent onRequestClose={closePanel}>
        <Animated.View style={[fl.backdrop, { opacity: backdropAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={closePanel} />
        </Animated.View>

        {/*
          Android: KeyboardAvoidingView with any behavior on a position:absolute
          panel creates dead space. We handle keyboard via FlatList's
          keyboardShouldPersistTaps + keyboardDismissMode instead.
        */}
        <KeyboardAvoidingView
          style={fl.kav}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          pointerEvents="box-none"
        >
          <Animated.View style={[fl.panelShell, { bottom: insets.bottom + BUBBLE_BOTTOM, height: PANEL_H, transform: [{ translateY: slideAnim }] }]}>
            <View style={fl.panelBody}>

              <PanelHeader
                menuCount={menuItems.length}
                canteenCount={canteens.length}
                loading={loading}
                bubbleColor={bubbleColor}
                onClose={closePanel}
              />

              <StatsStrip history={orderHistory} />

              {/* Personalised quick-reorder strip */}
              <PersonalisedBanner recs={recs} onAddItem={handleAddItem} />

              {/* Chat */}
              <View style={fl.chatContainer}>
                {loading ? (
                  <View style={fl.loadWrap}>
                    <ActivityIndicator color={C.spice} size="large" />
                    <Text style={fl.loadText}>Fetching menus from all canteens…</Text>
                  </View>
                ) : (
                  <FlatList
                    ref={listRef}
                    data={messages}
                    keyExtractor={m => String(m.id)}
                    style={fl.flatList}
                    contentContainerStyle={fl.listContent}
                    showsVerticalScrollIndicator={true}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    removeClippedSubviews={false}
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                    renderItem={({ item }) => <ChatBubble msg={item} onAddItem={handleAddItem} />}
                    ListFooterComponent={isTyping ? <TypingDots /> : null}
                    ListEmptyComponent={
                      <View style={fl.emptyState}>
                        <ChefHat size={32} color={C.textHint} strokeWidth={1.5} />
                        <Text style={fl.emptyText}>Start chatting to order food!</Text>
                      </View>
                    }
                  />
                )}
              </View>

              {/* FIX: Chips — removed fixed height, use natural height with padding */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={fl.chipRail}
                contentContainerStyle={fl.chipContainer}
                keyboardShouldPersistTaps="always"
              >
                {CHIPS.map(({ label, Icon, msg }) => (
                  <TouchableOpacity key={label} style={fl.chip} onPress={() => handleSend(msg)} activeOpacity={0.72}>
                    <Icon size={12} color={C.textSub} strokeWidth={2.5} />
                    <Text style={fl.chipText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <CartBar cart={cart} onCheckout={goCheckout} onClear={() => setCartSynced([])} />

              {/* Input row — no position:absolute, stays in flex flow */}
              <View style={fl.inputRow}>
                {/* FIX: Removed waveformContainer with position:absolute bottom:-30 that caused space */}
                <View style={fl.micWrap}>
                  {isListening && <MicRipple pitchAnim={pitchAnim} />}
                  <TouchableOpacity
                    style={[fl.micBtn, isListening && fl.micBtnActive]}
                    onPress={toggleVoice}
                    activeOpacity={0.7}
                  >
                    {isListening
                      ? <Volume2 size={18} color={C.red} strokeWidth={2.5} />
                      : <Mic size={18} color={C.purple} strokeWidth={2.5} />
                    }
                  </TouchableOpacity>
                </View>

                <TextInput
                  style={fl.input}
                  placeholder={isListening ? "Listening…" : "e.g. biryani from staff canteen qty 2"}
                  placeholderTextColor={isListening ? C.red : C.textHint}
                  value={input}
                  onChangeText={setInput}
                  onSubmitEditing={() => handleSend()}
                  returnKeyType="send"
                  multiline
                  onFocus={resetTimer}
                  blurOnSubmit
                />

                <TouchableOpacity
                  style={[fl.sendBtn, !input.trim() && fl.sendDim]}
                  onPress={() => handleSend()}
                  disabled={!input.trim()}
                  activeOpacity={0.85}
                >
                  <Send size={16} color="#FFF" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>

              {/* FIX: Voice hint now INSIDE panelBody as a proper View, not absolute */}
              {isListening && voiceTranscript ? (
                <View style={fl.voiceHint}>
                  <VoiceWaveform isListening={isListening} pitchAnim={pitchAnim} />
                  <Text style={fl.voiceHintText}>{voiceTranscript}</Text>
                </View>
              ) : null}

            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const fl = StyleSheet.create({
  bubbleWrap: { position: "absolute", right: 14, zIndex: 9999 },
  bubbleRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10 },
  hint: { backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1.5, borderColor: C.border },
  hintText: { fontSize: T.sm, fontWeight: "700", color: C.textSub },
  hintArrow: { position: "absolute", right: -8, top: "50%", marginTop: -5, width: 0, height: 0, borderTopWidth: 5, borderBottomWidth: 5, borderLeftWidth: 8, borderTopColor: "transparent", borderBottomColor: "transparent", borderLeftColor: C.border },
  bubble: { width: 62, height: 62, borderRadius: 31, alignItems: "center", justifyContent: "center", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 14 },
  bubbleRing: { position: "absolute", width: 54, height: 54, borderRadius: 27, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.25)" },
  badge: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, backgroundColor: C.red, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#FFF" },
  cartBadge: { top: "auto", bottom: 3, right: 3, backgroundColor: C.turmeric },
  badgeText: { fontSize: 9, fontWeight: "900", color: "#FFF" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  kav: { flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" },
  panelShell: { position: "absolute", left: 10, right: 10, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 20 },
  panelBody: { flex: 1, flexDirection: "column", backgroundColor: C.bg, borderRadius: 24, overflow: "hidden", borderWidth: 1.5, borderColor: C.border },
  chatContainer: { flex: 1, backgroundColor: C.surfaceWarm },
  flatList: { flex: 1 },
  listContent: { paddingTop: 6, paddingBottom: 8 },
  emptyState: { alignItems: "center", justifyContent: "center", paddingTop: 32, gap: 10 },
  emptyText: { color: C.textMuted, fontSize: T.sm, textAlign: "center" },
  loadWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadText: { fontSize: T.sm, color: C.textMuted },
  // chipRail: no height, flexGrow 0 prevents Android vertical stretch
  chipRail: { flexGrow: 0, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.surfaceWarm },
  chipContainer: { paddingHorizontal: 10, gap: 6, paddingVertical: 7, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.surface, borderRadius: 999, borderWidth: 1.5, borderColor: C.border },
  chipText: { fontSize: T.xs, fontWeight: "700", color: C.textSub },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 10, backgroundColor: C.surface, borderTopWidth: 1.5, borderTopColor: C.border },
  micWrap: { alignItems: "center", justifyContent: "center", width: 42, height: 42 },
  micRipple: { position: "absolute", width: 42, height: 42, borderRadius: 21, backgroundColor: C.red },
  micRipple1: { opacity: 0.25 },
  micRipple2: { opacity: 0.12, transform: [{ scale: 1.3 }] },
  micBtn: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.purpleLight, borderWidth: 1.5, borderColor: C.purple },
  micBtnActive: { backgroundColor: C.redLight, borderColor: C.red },
  input: { flex: 1, backgroundColor: C.surfaceWarm, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 9, fontSize: T.base, color: C.ink, maxHeight: 72, lineHeight: 18 },
  sendBtn: { width: 42, height: 42, borderRadius: 13, backgroundColor: C.spice, alignItems: "center", justifyContent: "center" },
  sendDim: { backgroundColor: C.borderLight },
  // FIX: voiceHint now in-flow (not absolute), sits between input and bottom
  voiceHint: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: C.redLight, paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.red },
  voiceHintText: { flex: 1, fontSize: T.xs, color: C.red, fontWeight: "600" },
});