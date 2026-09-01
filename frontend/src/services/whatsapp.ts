const API_URL =
  import.meta.env.VITE_WHATSAPP_API_URL ?? "http://localhost:3001";

export async function sendWhatsapp(
  to: string,
  body: string
): Promise<{ success: true; sid: string }> {
  const res = await fetch(`${API_URL}/send-whatsapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, body }),
  });

  if (!res.ok) {
    const payload = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(payload.error ?? "Failed to send WhatsApp message");
  }

  return res.json();
}
