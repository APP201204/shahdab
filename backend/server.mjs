import express from "express";
import cors from "cors";
import twilio from "twilio";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
app.use(cors());
app.use(express.json());

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

function withWhatsappPrefix(value) {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.startsWith("whatsapp:") ? trimmed : `whatsapp:${trimmed}`;
}

app.post("/send-whatsapp", async (req, res) => {
  const { to, body } = req.body;

  if (!to || !body) {
    return res
      .status(400)
      .json({ success: false, error: "Missing `to` or `body`." });
  }

  const from = withWhatsappPrefix(process.env.TWILIO_FROM_WHATSAPP);
  const toFormatted = withWhatsappPrefix(to);

  if (!from) {
    return res
      .status(500)
      .json({ success: false, error: "TWILIO_FROM_WHATSAPP is not set." });
  }

  try {
    const message = await client.messages.create({
      from,
      to: toFormatted,
      body,
    });
    res.json({ success: true, sid: message.sid });
  } catch (err) {
    console.error("Twilio error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`WhatsApp backend running on http://localhost:${PORT}`);
});
