'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm, Controller } from 'react-hook-form'
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

const GRADUATION_YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026]

// ── Scholarship eligibility silent filter ─────────────────────────────────────
function computeScholarshipEligibility(
  dateNaissance: string | null | undefined,
  graduationYear: number,
  grade10: number,
  grade11: number,
  grade12: number,
): boolean {
  try {
    // Must be under 25
    if (!dateNaissance) return false
    const dob   = new Date(dateNaissance)
    const today = new Date()
    const age   = today.getFullYear() - dob.getFullYear() - (
      today < new Date(today.getFullYear(), dob.getMonth(), dob.getDate()) ? 1 : 0
    )
    if (age >= 25) return false

    // Graduation year must be 2024, 2025, or 2026
    if (graduationYear < 2024) return false

    // Average of 3 grade years must be ≥ 70
    const avg = (grade10 + grade11 + grade12) / 3
    return avg >= 70
  } catch {
    return false
  }
}

function AcademicHistoryPageInner() {
  const router     = useRouter()
  const searchParams = useSearchParams()
  const applicantId  = searchParams.get('applicant_id')
  const [error,         setError]         = useState<string | null>(null)
  const [isLoading,     setIsLoading]     = useState(false)
  const [selectedOption, setSelectedOption] = useState<string>('')
  const [autreValue,    setAutreValue]    = useState<string>('')
  const supabase = createClient()

  const {
    register,
    handleSubmit,
    control,
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

    const isAutre = selectedOption === 'Autre (Préciser)'
    if (isAutre && !autreValue.trim()) {
      setError('Veuillez préciser votre option académique.')
      setIsLoading(false)
      return
    }
    const finalOptionAcademique = isAutre ? autreValue.trim() : selectedOption

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('Vous devez être connecté pour continuer')
        setIsLoading(false)
        return
      }

      // Fetch applicant date_naissance for scholarship check
      const { data: profile } = await supabase
        .from('applicants')
        .select('date_naissance')
        .eq('id', user.id)
        .single()

      // Silent scholarship eligibility check
      const profileData = profile as any
      const isEligible = computeScholarshipEligibility(
        profileData?.date_naissance,
        data.graduation_year,
        data.grade_10_average,
        data.grade_11_average,
        data.grade_12_average,
      )

      // Update application: academic history + auto-advance status + waive payment
      // Cast to any because Supabase auto-generated types don't yet include the new scholarship columns
      const updatePayload: Record<string, unknown> = {
        ecole_provenance:        data.ecole_provenance,
        option_academique:       finalOptionAcademique,
        exam_status:             data.exam_status,
        graduation_year:         data.graduation_year,
        grade_10_average:        data.grade_10_average,
        grade_11_average:        data.grade_11_average,
        grade_12_average:        data.grade_12_average,
        exetat_percentage:       data.exetat_percentage ?? null,
        application_status:      'en_cours_devaluation',
        payment_status:          'waived',
        is_scholarship_eligible: isEligible,
        scholarship_status:      isEligible ? 'eligible' : 'not_eligible',
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from('applications')
        .update(updatePayload)
        .eq('user_id', user.id)

      if (updateError) {
        setError(`Erreur lors de la sauvegarde: ${updateError.message}`)
        setIsLoading(false)
        return
      }

      router.push('/dashboard')
    } catch {
      setError("Une erreur inattendue s'est produite")
      setIsLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/apply')
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Navbar ── */}
      <header className="bg-[#021463] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="font-serif text-2xl font-bold text-white tracking-tight">Admitta</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm font-medium transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Se déconnecter
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12">

        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-2">
            <span>Progression</span>
            <span>2 / 2</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#4EA6F5] rounded-full" style={{ width: '100%' }} />
          </div>
          <p className="text-sm text-slate-500 mt-2.5">
            Étape 2 sur 2 : <span className="font-medium text-slate-600">Informations académiques</span>
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

          <div className="px-8 pt-8 pb-6 border-b border-slate-100">
            <h1 className="font-serif text-3xl font-bold text-[#021463]">Historique académique</h1>
            <p className="text-slate-500 text-sm mt-1.5 leading-relaxed">
              Renseignez votre parcours scolaire pour compléter votre dossier de candidature.
            </p>
          </div>

          <div className="px-8 py-8 space-y-7">

            {applicantId && (
              <div className="flex items-start gap-4 p-4 bg-slate-50 border-l-4 border-[#4EA6F5] rounded-r-lg">
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1">Identifiant de candidature</p>
                  <p className="text-xl font-bold text-[#021463] font-mono tracking-wide">{applicantId}</p>
                  <p className="text-xs text-slate-400 mt-1">Conservez cet identifiant pour suivre votre dossier</p>
                </div>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm leading-relaxed">
                {error}
              </div>
            )}

            {/* Frais offerts banner */}
            <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <span className="text-lg">🎓</span>
              <p className="text-sm text-emerald-800 font-medium">
                Frais de dossier exceptionnellement offerts pour notre Cohorte Inaugurale
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

              {/* École de provenance */}
              <div className="space-y-1.5">
                <Label htmlFor="ecole_provenance" className="text-sm font-medium text-[#1E293B]">
                  École de provenance <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ecole_provenance"
                  {...register('ecole_provenance')}
                  placeholder="Nom de votre école actuelle ou précédente"
                  className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                />
                {errors.ecole_provenance && <p className="text-xs text-red-500">{errors.ecole_provenance.message}</p>}
              </div>

              {/* Option académique */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1E293B]">
                  Option académique <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={selectedOption}
                  onValueChange={(val) => {
                    setSelectedOption(val)
                    setValue('option_academique', val === 'Autre (Préciser)' ? '' : val)
                    if (val !== 'Autre (Préciser)') setAutreValue('')
                  }}
                >
                  <SelectTrigger className="min-h-[48px] border-slate-200 focus:ring-[#4EA6F5]/30">
                    <SelectValue placeholder="Sélectionnez votre option..." />
                  </SelectTrigger>
                  <SelectContent>
                    {OPTION_ACADEMIQUE_LIST.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedOption === 'Autre (Préciser)' && (
                  <Input
                    placeholder="Veuillez préciser votre option..."
                    value={autreValue}
                    onChange={e => { setAutreValue(e.target.value); setValue('option_academique', e.target.value) }}
                    className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 mt-2"
                  />
                )}
                {errors.option_academique && <p className="text-xs text-red-500">{errors.option_academique.message}</p>}
              </div>

              {/* Statut examen d'État */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium text-[#1E293B]">
                  Statut de l&apos;examen d&apos;État <span className="text-red-500">*</span>
                </Label>
                <RadioGroup
                  value={examStatus}
                  onValueChange={val => setValue('exam_status', val as 'En attente des résultats' | 'Diplôme obtenu')}
                  className="space-y-2"
                >
                  {(['En attente des résultats', 'Diplôme obtenu'] as const).map(val => (
                    <label
                      key={val}
                      htmlFor={val}
                      className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                        examStatus === val ? 'border-[#4EA6F5] bg-[#4EA6F5]/5' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <RadioGroupItem value={val} id={val} className="text-[#4EA6F5]" />
                      <span className="text-sm text-[#1E293B]">{val}</span>
                    </label>
                  ))}
                </RadioGroup>
                {errors.exam_status && <p className="text-xs text-red-500">{errors.exam_status.message}</p>}
              </div>

              {/* Année d'obtention du diplôme */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[#1E293B]">
                  Année d&apos;obtention du Diplôme d&apos;État <span className="text-red-500">*</span>
                </Label>
                <Controller
                  name="graduation_year"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString() ?? ''}
                      onValueChange={val => field.onChange(Number(val))}
                    >
                      <SelectTrigger className="min-h-[48px] border-slate-200 focus:ring-[#4EA6F5]/30">
                        <SelectValue placeholder="Sélectionnez l'année..." />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADUATION_YEARS.map(yr => (
                          <SelectItem key={yr} value={yr.toString()}>{yr}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.graduation_year && <p className="text-xs text-red-500">{errors.graduation_year.message}</p>}
              </div>

              {/* ── Grades Section ── */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-5 py-3 border-b border-slate-200">
                  <p className="text-sm font-semibold text-[#021463]">Moyennes annuelles (sur 100)</p>
                  <p className="text-xs text-slate-400 mt-0.5">Ces informations servent à évaluer votre éligibilité à la Bourse d'Excellence.</p>
                </div>
                <div className="px-5 py-5 grid grid-cols-1 sm:grid-cols-3 gap-5">

                  {/* 10e année */}
                  <div className="space-y-1.5">
                    <Label htmlFor="grade_10" className="text-sm font-medium text-[#1E293B]">
                      10e année <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="grade_10"
                      type="number"
                      min={0} max={100} step={0.01}
                      placeholder="Ex. : 75"
                      {...register('grade_10_average', { valueAsNumber: true })}
                      className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                    />
                    {errors.grade_10_average && <p className="text-xs text-red-500">{errors.grade_10_average.message}</p>}
                  </div>

                  {/* 11e année */}
                  <div className="space-y-1.5">
                    <Label htmlFor="grade_11" className="text-sm font-medium text-[#1E293B]">
                      11e année <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="grade_11"
                      type="number"
                      min={0} max={100} step={0.01}
                      placeholder="Ex. : 78"
                      {...register('grade_11_average', { valueAsNumber: true })}
                      className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                    />
                    {errors.grade_11_average && <p className="text-xs text-red-500">{errors.grade_11_average.message}</p>}
                  </div>

                  {/* 12e année */}
                  <div className="space-y-1.5">
                    <Label htmlFor="grade_12" className="text-sm font-medium text-[#1E293B]">
                      12e année <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="grade_12"
                      type="number"
                      min={0} max={100} step={0.01}
                      placeholder="Ex. : 80"
                      {...register('grade_12_average', { valueAsNumber: true })}
                      className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                    />
                    {errors.grade_12_average && <p className="text-xs text-red-500">{errors.grade_12_average.message}</p>}
                  </div>
                </div>

                {/* Exétat — hidden when waiting for results */}
                {examStatus === 'Diplôme obtenu' && (
                  <div className="px-5 pb-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="exetat" className="text-sm font-medium text-[#1E293B]">
                        Pourcentage à l&apos;Examen d&apos;État (%) <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="exetat"
                        type="number"
                        min={0} max={100} step={0.01}
                        placeholder="Ex. : 72.5"
                        {...register('exetat_percentage', { valueAsNumber: true })}
                        className="min-h-[48px] border-slate-200 focus-visible:ring-[#4EA6F5]/30 focus-visible:border-[#4EA6F5]"
                      />
                      {errors.exetat_percentage && <p className="text-xs text-red-500">{errors.exetat_percentage.message}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit */}
              <div className="pt-2 pb-2">
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full min-h-[48px] bg-[#021463] hover:bg-[#021463]/90 text-white font-semibold rounded-md text-sm transition-all"
                >
                  {isLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Soumission en cours…</>
                    : 'Soumettre mon dossier'}
                </Button>
              </div>

            </form>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">© 2026 Ignito Academy. Tous droits réservés.</p>
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
