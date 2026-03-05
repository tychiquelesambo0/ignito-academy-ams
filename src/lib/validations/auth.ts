import { z } from 'zod'

export const registrationSchema = z.object({
  prenom: z
    .string()
    .min(2, 'Le prénom doit contenir au moins 2 caractères')
    .max(100, 'Le prénom ne peut pas dépasser 100 caractères')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le prénom ne peut contenir que des lettres'),
  
  nom: z
    .string()
    .min(2, 'Le nom doit contenir au moins 2 caractères')
    .max(100, 'Le nom ne peut pas dépasser 100 caractères')
    .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, 'Le nom ne peut contenir que des lettres'),
  
  email: z
    .string()
    .email('Adresse email invalide')
    .toLowerCase(),
  
  phone_number: z
    .string()
    .regex(/^\+243[0-9]{9}$/, 'Le numéro doit être au format +243XXXXXXXXX (13 caractères)'),
  
  date_naissance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide')
    .refine((date) => {
      const birthDate = new Date(date)
      const today = new Date()
      const age = today.getFullYear() - birthDate.getFullYear()
      return age >= 16 && age <= 100
    }, 'Vous devez avoir au moins 16 ans'),
  
  password: z
    .string()
    .min(6, 'Le mot de passe doit contenir au moins 6 caractères'),
  
  confirmPassword: z
    .string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
})

export type RegistrationFormData = z.infer<typeof registrationSchema>
