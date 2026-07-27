import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// 계약서의 주민등록번호 앞자리처럼 민감한 필드를 저장 전 암호화하기 위한 헬퍼.
// AES-256-GCM(iv + authTag + ciphertext를 "." 로 이어 base64 저장)을 사용한다.
function getKey(): Buffer {
  const secret = process.env.CONTRACT_ENCRYPTION_KEY || "dev-only-insecure-key-change-me";
  return scryptSync(secret, "shinnaagym-contract-salt", 32);
}

export function encryptText(plain: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptText(ciphertext: string): string {
  if (!ciphertext) return "";
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !tagB64 || !dataB64) return "";
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}
