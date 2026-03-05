'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { academicHistorySchema, type AcademicHistoryFormData } from '@/lib/validations/academic-history'
import { createClient } from '@/lib/supabase/client'
import { LogOut, Loader2 } from 'lucide-react'

const OPTION_ACADEMIQUE_LIST = [
  'Pédagogie Générale',
  'Littéraire (Latin-Philosophie)',
  'Littéraire (Mathématiques-Philosophie)',
  'Scientifique (Mathématiques-Physique)',
  'Scientifique (Chimie-Biologie)',
  'Commerciale et Administrative',
  'Commerciale et Informatique',
  'Électricité',
  'Électronique',
  'Mécanique Générale',
  'Mécanique Automobile',
  'Construction',
  'Coupe et Couture',
  'Hôtellerie et Restauration',
  'Agriculture',
  'Vétérinaire',
  'Santé / Infirmerie',
  'Autre (Préciser)',
] as const

function AcademicHistoryPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const applicantId = searchParams.get('applicant_id')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [autreValue, setAutreValue] = useState<string>('')
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AcademicHistoryFormData>({
    resolver: zodResolver(academicHistorySchema),
  })

  const examStatus = watch('exam_status')

  const onSubmit = async (data: AcademicHistoryFormData) => {
    setIsLoading(true)
    setError(null)

    // Resolve final option_academique value
    const isAutre = selectedOption === 'Autre (Préciser)'
    if (isAutre && !autreValue.trim()) {
      setError('Veuillez préciser votre option académique.')
      setIsLoading(false)
      return
    }
    const finalOptionAcademique = isAutre ? autreValue.trim() : selectedOption

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        setError('Vous devez être connecté pour continuer')
        setIsLoading(false)
        return
      }

      // Check if payment is already confirmed
      const { data: currentApp } = await supabase
        .from('applications')
        .select('payment_status')
        .eq('user_id', user.id)
        .single()

      if (currentApp?.payment_status === 'Confirmed') {
        setError('Vous ne pouvez plus modifier votre historique académique après confirmation du paiement')
        setIsLoading(false)
        return
      }

      // Update application with academic history
      const { error: updateError } = await supabase
        .from('applications')
        .update({
          ecole_provenance: data.ecole_provenance,
          option_academique: finalOptionAcademique,
          exam_status: data.exam_status,
        })
        .eq('user_id', user.id)
        .neq('payment_status', 'Confirmed') // Additional safety check

      if (updateError) {
        setError(`Erreur lors de la sauvegarde: ${updateError.message}`)
        setIsLoading(false)
        return
      }

      // Forward to dashboard (documents step) — payment is the final validation step
      router.push('/dashboard')
    } catch (err) {
      setError('Une erreur inattendue s\'est produite')
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/apply')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Admitta Nav Bar ── */}
      <header className="bg-[#021463] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="font-serif text-2xl font-bold text-white tracking-tight">
            Admitta
          </span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12">

        {/* Progress tracker */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
            <span>Progression</span>
            <span>2 / 3</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#4EA6F5] rounded-full" style={{ width: '66%' }} />
          </div>
          <p className="text-sm text-slate-500 mt-2.5">
            Étape 2 sur 3 : <span className="font-medium text-slate-600">Informations académiques</span>
          </p>
        </div>

        {/* ── Form Card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

          {/* Card header */}
          <div className="px-8 pt-8 pb-6 border-b border-slate-100">
            <h1 className="font-serif text-3xl font-bold text-[#021463]">
              Historique académique
            </h1>
            <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
              Renseignez votre parcours scolaire pour compléter votre dossier de candidature.
            </p>
          </div>

          <div className="px-8 py-8 space-y-7">

            {/* Applicant ID box */}
            {applicantId && (
              <div className="flex items-start gap-4 p-4 bg-slate-50 border-l-4 border-[#4EA6F5] rounded-r-lg">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">
                    Identifiant de candidature
                  </p>
                  <p className="text-xl font-bold text-[#021463] font-mono tracking-wide">
                    {applicantId}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Conservez cet identifiant pour suivre votre dossier
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-4 bg-[#EF4444]/8 border border-[#EF4444]/20 rounded-lg text-[#EF4444] text-sm leading-relaxed">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* École de provenance */}
              <div className="space-y-1.5">
                <Label htmlFor="ecole_provenance" className="text-sm font-medium text-[#1E293B]">
                  École de provenance <span className="text-[#EF4444]">*</span>
                </Label>
                <Input
                  id="ecole_provenance"
                  {...register('ecole_provenance')}
                  placeholder="Nom de votre école actuelle ou précédente"
                  className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                />
                {errors.ecole_provenance && (
                  <p className="text-xs text-[#EF4444]">{errors.ecole_provenance.message}</p>
                )}
              </div>

              {/* Option académique — dropdown */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1E293B]">
                  Option académique <span className="text-[#EF4444]">*</span>
                </Label>
                <Select
                  value={selectedOption}
                  onValueChange={(val) => {
                    setSelectedOption(val)
                    // Keep the form field in sync for zod validation
                    setValue('option_academique', val === 'Autre (Préciser)' ? '' : val)
                    if (val !== 'Autre (Préciser)') setAutreValue('')
                  }}
                >
                  <SelectTrigger className="min-h-[48px] border-slate-200 focus:ring-[#4EA6F5]/30 focus:border-[#4EA6F5] data-[placeholder]:text-slate-400">
                    <SelectValue placeholder="Sélectionnez votre option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OPTION_ACADEMIQUE_LIST.map((opt) => (
                      <SelectItem key={opt} value={opt} className="cursor-pointer">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Conditional "Autre" free-text input */}
                {selectedOption === 'Autre (Préciser)' && (
                  <div className="mt-2">
                    <Input
                      placeholder="Veuillez préciser votre option..."
                      value={autreValue}
                      onChange={(e) => {
                        setAutreValue(e.target.value)
                        setValue('option_academique', e.target.value)
                      }}
                      required
                      className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                    />
                  </div>
                )}

                {errors.option_academique && (
                  <p className="text-xs text-[#EF4444]">{errors.option_academique.message}</p>
                )}
              </div>

              {/* Exam Status */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-[#1E293B]">
                  Statut de l&apos;examen d&apos;État <span className="text-[#EF4444]">*</span>
                </Label>
                <RadioGroup
                  value={examStatus}
                  onValueChange={(value) => setValue('exam_status', value as 'En attente des résultats' | 'Diplôme obtenu')}
                  className="space-y-2"
                >
                  <label
                    htmlFor="waiting"
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      examStatus === 'En attente des résultats'
                        ? 'border-[#4EA6F5] bg-[#4EA6F5]/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem value="En attente des résultats" id="waiting" className="text-[#4EA6F5]" />
                    <span className="text-sm text-[#1E293B] font-normal">En attente des résultats</span>
                  </label>
                  <label
                    htmlFor="obtained"
                    className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      examStatus === 'Diplôme obtenu'
                        ? 'border-[#4EA6F5] bg-[#4EA6F5]/5'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <RadioGroupItem value="Diplôme obtenu" id="obtained" className="text-[#4EA6F5]" />
                    <span className="text-sm text-[#1E293B] font-normal">Diplôme obtenu</span>
                  </label>
                </RadioGroup>
                {errors.exam_status && (
                  <p className="text-xs text-[#EF4444]">{errors.exam_status.message}</p>
                )}
              </div>

              {/* Single CTA */}
              <div className="pt-2 pb-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[48px] bg-[#021463] hover:bg-[#021463]/90 text-white font-semibold rounded-md text-sm transition-all"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sauvegarde en cours…</>
                    : 'Continuer'
                  }
                </Button>
              </div>

            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 Ignito Academy. Tous droits réservés.
        </p>
      </main>
    </div>
  )
}

export default function AcademicHistoryPage() {
  return (
    <Suspense>
      <AcademicHistoryPageInner />
    </Suspense>
  )
}
