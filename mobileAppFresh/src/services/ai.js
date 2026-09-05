import { API_URL } from "./config";

export const askAI = async (message) => {
  const res = await fetch(`${API_URL}/ai/intent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: message
    })
  });

  if (!res.ok) {
    throw new Error("AI server not responding");
  }

  return res.json();
};
