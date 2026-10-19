import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Γράψε το όνομά σου (τουλάχιστον 2 χαρακτήρες)."),
  email: z.string().trim().email("Βάλε ένα έγκυρο email."),
  phone: z
    .string()
    .trim()
    .min(1, "Βάλε ένα τηλέφωνο επικοινωνίας.")
    .regex(/^[+\d][\d\s()-]{5,}$/, "Βάλε ένα έγκυρο τηλέφωνο."),
  message: z.string().trim().min(10, "Γράψε μερικά λόγια παραπάνω (τουλάχιστον 10 χαρακτήρες)."),
});

export type ContactFormValues = z.infer<typeof contactSchema>;
