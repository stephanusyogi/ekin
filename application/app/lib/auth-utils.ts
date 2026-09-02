import crypto from "crypto";

const getSecret = () =>
  process.env.AUTH_SECRET ||
  "9f8e7d6c5b4a392817065f4e3d2c1b0a9f8e7d6c5b4a392817065f4e3d2c1b0a";

export function signToken(payload: { email: string; name: string }): string {
  const data = JSON.stringify(payload);
  const base64Data = Buffer.from(data).toString("base64url");
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(base64Data)
    .digest("base64url");
  return `${base64Data}.${signature}`;
}

export function verifyToken(token: string): { email: string; name: string } | null {
  try {
    const [base64Data, signature] = token.split(".");
    if (!base64Data || !signature) return null;
    const expectedSignature = crypto
      .createHmac("sha256", getSecret())
      .update(base64Data)
      .digest("base64url");
    if (
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
    ) {
      const data = Buffer.from(base64Data, "base64url").toString("utf-8");
      return JSON.parse(data);
    }
    return null;
  } catch {
    return null;
  }
}
