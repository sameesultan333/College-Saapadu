// utils/foodAI.js

/* ---------------------------------
   SMART GREETING ENGINE
---------------------------------- */
export function getGreeting(isPeak, history = []) {
  const hour = new Date().getHours(); // local system time (India)

  // 🌙 Late Night (10 PM – 4 AM)
  if (hour >= 22 || hour < 4) {
    return "🌙 Late night cravings? I’ll keep it quick and light.";
  }

  // 🌅 Morning (4 AM – 11 AM)
  if (hour >= 4 && hour < 11) {
    return "☀️ Good morning! Breakfast options are ready.";
  }

  // 🍱 Afternoon (11 AM – 4 PM)
  if (hour >= 11 && hour < 16) {
    if (isPeak) {
      return "🔥 Lunch rush hour! Want the fastest option?";
    }
    return "🍱 Lunch time! What are you in the mood for?";
  }

  // ☕ Evening (4 PM – 7 PM)
  if (hour >= 16 && hour < 19) {
    return "☕ Evening snacks or coffee break?";
  }

  // 🌆 Night (7 PM – 10 PM)
  if (hour >= 19 && hour < 22) {
    return "🌆 Dinner time! I can suggest something popular.";
  }

  // Fallback (should rarely hit)
  return "👋 Hi! I can help you choose food faster.";
}

/* ---------------------------------
   SMART RECOMMENDATION ENGINE
---------------------------------- */
export function getRecommendation(query, canteens = [], isPeak) {
  const text = query.toLowerCase().trim();

  /* 👋 GREETINGS */
  if (/^(hi|hello|hey|hai|yo)\b/.test(text)) {
    return "Hi 👋 Tell me what you want:\n⚡ fastest\n🔥 popular\n🍛 south indian";
  }

  /* ❓ HELP */
  if (text.includes("help") || text.includes("what can you do")) {
    return "🤖 I help you skip queues.\nTry:\n⚡ fastest food\n🔥 popular now\n🍛 south indian";
  }

  /* ⚡ FAST / QUICK */
  if (text.includes("fast") || text.includes("quick")) {
    const quick = canteens.find(c => c.isQuick);
    if (!quick) {
      return "⚡ I don’t see a fast option right now.";
    }

    return `⚡ Fastest right now: **${quick.name}**\n⏱️ ${
      isPeak ? quick.peakWait : quick.normalWait
    }`;
  }

  /* 🔥 POPULAR */
  if (text.includes("popular") || text.includes("trending")) {
    const popular = canteens.find(c => c.isPopular);
    if (!popular) {
      return "🔥 Nothing trending right now.";
    }
    return `🔥 ${popular.name} is trending right now!`;
  }

  /* 🍛 SOUTH INDIAN */
  if (text.includes("south")) {
    return "🍛 South Indian Corner is a great choice. Dosa & Idli are top picks!";
  }

  /* 🥗 HEALTHY */
  if (text.includes("healthy") || text.includes("light")) {
    return "🥗 Idli, dosa, or smaller portions are good healthy picks.";
  }

  /* 🕒 TIME-BASED SUGGESTION (INTELLIGENT FALLBACK) */
  const hour = new Date().getHours();

  if (hour >= 22 || hour < 4) {
    return "🌙 It’s late — I suggest quick bites or light food.";
  }

  if (hour >= 11 && hour < 16) {
    return "🍱 Lunch time! Want something fast or popular?";
  }

  if (hour >= 19 && hour < 22) {
    return "🌆 Dinner time! I can suggest popular options.";
  }

  /* 🤷 FINAL FALLBACK */
  return "🤔 Tell me what you feel like — fast, popular, or south indian?";
}
