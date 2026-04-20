import { z } from "zod";

export const RegisterInstitutionSchema = z.object({
  id: z.string().min(2),
  name: z.string().min(2),
  country: z.string().min(2)
});

export const CreateRecordSchema = z.object({
  patientId: z.string().min(1),
  createdByInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  plaintext: z.string().min(1)
});

export const CreateConsentSchema = z.object({
  patientId: z.string().min(1),
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  purpose: z.string().min(1),
  expiryUnixSeconds: z.number().int().positive()
});

export const RevokeConsentSchema = z.object({
  patientId: z.string().min(1),
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1)
});

export const AccessRequestSchema = z.object({
  patientId: z.string().min(1),
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  purpose: z.string().min(1)
});
