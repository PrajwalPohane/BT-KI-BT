import { z } from "zod";

const WalletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address");

export const RegisterInstitutionSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  country: z.string().min(2),
});

export const CreateRecordSchema = z.object({
  patientId: z.string().min(1),
  createdByInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  plaintext: z.string().min(1),
});

export const CreateConsentSchema = z.object({
  patientId: z.string().min(1),
  patientWalletAddress: WalletAddressSchema,
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  purpose: z.string().min(1),
  expiryUnixSeconds: z.number().int().positive(),
});

export const RevokeConsentSchema = z.object({
  patientId: z.string().min(1),
  patientWalletAddress: WalletAddressSchema,
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
});

export const AccessRequestSchema = z.object({
  patientId: z.string().min(1),
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  purpose: z.string().min(1),
});

export const AuthSignUpSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["patient", "hospital"]),
});

export const AuthSignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  role: z.enum(["patient", "hospital"]),
});
