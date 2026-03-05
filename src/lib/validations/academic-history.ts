import { z } from 'zod'

export const academicHistorySchema = z.object({
  ecole_provenance: z
    .string()
    .min(2, 'Le nom de l\'école doit contenir au moins 2 caractères')
    .max(200, 'Le nom de l\'école ne peut pas dépasser 200 caractères'),
  
  option_academique: z
    .string()
    .min(2, 'L\'option doit contenir au moins 2 caractères')
    .max(100, 'L\'option ne peut pas dépasser 100 caractères'),
  
  exam_status: z.enum(['En attente des résultats', 'Diplôme obtenu'], {
    errorMap: () => ({ message: 'Veuillez sélectionner un statut' }),
  }),
})

export type AcademicHistoryFormData = z.infer<typeof academicHistorySchema>
