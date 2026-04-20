import { z } from "zod";

export const ConsentSchema = z.object({
  patientId: z.string().min(1),
  requesterInstitutionId: z.string().min(1),
  dataType: z.string().min(1),
  purpose: z.string().min(1),
  expiryUnixSeconds: z.number().int().positive(),
  active: z.boolean()
});

export type Consent = z.infer<typeof ConsentSchema>;
