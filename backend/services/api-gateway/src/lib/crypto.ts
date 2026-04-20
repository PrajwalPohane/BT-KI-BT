import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from "crypto";

const MASTER_SECRET = process.env.ENCRYPTION_MASTER_SECRET ?? "blockmedshare-dev-secret";

function deriveKey(patientId: string, dataType: string): Buffer {
  return Buffer.from(
    hkdfSync("sha256", Buffer.from(MASTER_SECRET), Buffer.from(patientId), Buffer.from(dataType), 32)
  );
}

export function encryptPayload(patientId: string, dataType: string, plaintext: string) {
  const iv = randomBytes(12);
  const key = deriveKey(patientId, dataType);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const hash = createHash("sha256").update(ciphertext).digest("hex");

  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    hash
  };
}

export function decryptPayload(patientId: string, dataType: string, ciphertextBase64: string, ivBase64: string, authTagBase64: string) {
  const key = deriveKey(patientId, dataType);
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivBase64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextBase64, "base64")),
    decipher.final()
  ]);

  return plaintext.toString("utf8");
}

export function ciphertextHash(ciphertextBase64: string): string {
  return createHash("sha256").update(Buffer.from(ciphertextBase64, "base64")).digest("hex");
}

export function makeTokenHash(parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}
