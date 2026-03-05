'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamicImport from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { ApplicationStatusTracker } from '@/components/ApplicationStatusTracker'
import { DocumentUpload } from '@/components/DocumentUpload'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { handleLogout, handleNewApplication } from './actions'
import { AlertTriangle, Loader2, Paperclip, CheckCircle2, X } from 'lucide-react'
import { useRef } from 'react'
import type { DecisionStatus } from '@/components/pdf/DecisionLetterPDF'

// Lazy-load the PDF button to avoid SSR — @react-pdf/renderer is client-only
const PDFDownloadButton = dynamicImport(
  () => import('@/components/pdf/PDFDownloadButton').then(m => m.PDFDownloadButton),
  { ssr: false, loading: () => (
    <span className="inline-flex items-center gap-2 px-5 min-h-[48px] rounded-md text-sm font-semibold bg-slate-100 text-slate-400 cursor-wait">
      <Loader2 className="w-4 h-4 animate-spin" />Chargement…
    </span>
  )}
)

const DECISION_STATUSES: DecisionStatus[] = [
  'Admission définitive',
  'Admission sous réserve',
  'Dossier refusé',
]

export default function DashboardPage() {
  const router = useRouter()
  const [applicationsWithDocs, setApplicationsWithDocs] = useState<any[]>([])
  const [applicant, setApplicant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [resubmitting, setResubmitting] = useState<string | null>(null)
  const [resubmitToast, setResubmitToast] = useState<string | null>(null)
  // Conditional upload state keyed by applicant_id
  const [condFile, setCondFile]       = useState<File | null>(null)
  const [condUploading, setCondUploading] = useState(false)
  const [condUploadError, setCondUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = async () => {
    const supabase = createClient()

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      router.push('/login')
      return
    }

    // Fetch user's applications
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (appsError) {
      console.error('Error fetching applications:', appsError)
    }

    // Fetch uploaded documents for each application
    const appsWithDocs = await Promise.all(
      (applications || []).map(async (app) => {
        const { data: docs } = await supabase
          .from('uploaded_documents')
          .select('id, file_name, file_size_bytes, mime_type, uploaded_at, file_path, document_type')
          .eq('applicant_id', app.applicant_id)
          .order('uploaded_at', { ascending: false })
        
        return {
          ...app,
          uploadedDocuments: docs || []
        }
      })
    )

    setApplicationsWithDocs(appsWithDocs)

    // Get applicant profile
    const { data: applicantData } = await supabase
      .from('applicants')
      .select('prenom, nom, email')
      .eq('id', user.id)
      .single()

    setApplicant(applicantData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#021463] mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Chargement de votre espace…</p>
        </div>
      </div>
    )
  }

  const handleConditionalUploadAndSubmit = async (applicantId: string) => {
    if (!condFile) return
    setCondUploading(true)
    setCondUploadError(null)

    try {
      // 1. Upload the conditional document
      const form = new FormData()
      form.append('file', condFile)
      form.append('applicantId', applicantId)
      form.append('documentType', 'document_conditionnel')

      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: form })
      const uploadData = await uploadRes.json()

      if (!uploadRes.ok) {
        setCondUploadError(uploadData?.error ?? 'Erreur lors du téléchargement.')
        setCondUploading(false)
        return
      }

      // 2. Resubmit the application
      const submitRes = await fetch('/api/applications/resubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicant_id: applicantId }),
      })
      const submitData = await submitRes.json()

      if (!submitRes.ok) {
        setCondUploadError(submitData?.error ?? 'Erreur lors de la soumission.')
        setCondUploading(false)
        return
      }

      // 3. Success
      setCondFile(null)
      setResubmitToast('Documents soumis avec succès. Votre dossier est de nouveau en cours d\'évaluation.')
      await fetchData()
    } catch {
      setCondUploadError('Une erreur réseau est survenue. Veuillez réessayer.')
    } finally {
      setCondUploading(false)
      setTimeout(() => setResubmitToast(null), 5000)
    }
  }

  const handleResubmit = async (applicantId: string) => {
    setResubmitting(applicantId)
    try {
      const res = await fetch('/api/applications/resubmit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ applicant_id: applicantId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResubmitToast(data?.error ?? 'Une erreur est survenue.')
      } else {
        setResubmitToast('Documents soumis avec succès. Votre dossier est de nouveau en cours d\'évaluation.')
        await fetchData()
      }
    } catch {
      setResubmitToast('Une erreur réseau est survenue.')
    } finally {
      setResubmitting(null)
      setTimeout(() => setResubmitToast(null), 5000)
    }
  }

  // Diploma is only required if the applicant has already obtained their diploma
  const diplomaRequired = application?.exam_status === 'Diplôme obtenu'
  const REQUIRED_DOC_TYPES = [
    'identification',
    'bulletin_10',
    'bulletin_11',
    'bulletin_12',
    ...(diplomaRequired ? ['diploma'] : []),
  ]

  // Check if user has completed applications from previous years
  const currentYear = new Date().getFullYear()
  const hasCompletedPreviousApplication = applicationsWithDocs?.some(
    app => app.intake_year < currentYear && 
    (app.application_status === 'Admission définitive' || 
     app.application_status === 'Dossier refusé' ||
     app.application_status === 'Admission sous réserve')
  )

  // Check if user already has an application for current year
  const hasCurrentYearApplication = applicationsWithDocs?.some(
    app => app.intake_year === currentYear
  )

  const canReapply = hasCompletedPreviousApplication && !hasCurrentYearApplication

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Admitta Navbar ── */}
      <header className="bg-[#021463] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="font-serif text-2xl font-bold text-white tracking-tight">Admitta</span>
          <Button
            onClick={() => handleLogout()}
            variant="ghost"
            className="text-white/65 hover:text-white hover:bg-white/10 text-sm font-medium min-h-[40px] px-4"
          >
            Se déconnecter
          </Button>
        </div>
      </header>

      {/* ── Toast ── */}
      {resubmitToast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium max-w-md text-center transition-all
          ${resubmitToast.includes('succès') ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {resubmitToast}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 space-y-8">

        {/* ── Greeting + ID row ── */}
        <div>
          <h1 className="font-serif text-3xl font-bold text-[#021463] mb-1">
            Bienvenue, {applicant?.prenom} {applicant?.nom}
          </h1>
          <p className="text-slate-500 text-sm">
            Suivez l&apos;état de votre candidature et gérez vos documents justificatifs.
          </p>
        </div>

        {canReapply && (
          <form action={handleNewApplication}>
            <Button type="submit" className="bg-[#4EA6F5] hover:bg-[#4EA6F5]/90 text-white min-h-[48px] px-6 font-semibold rounded-md">
              Nouvelle candidature
            </Button>
          </form>
        )}

        {/* ── Applications ── */}
        <div className="space-y-8">
          {applicationsWithDocs && applicationsWithDocs.length > 0 ? (
            applicationsWithDocs.map((application) => (
              <div key={application.id} className="space-y-5">

                {/* Meta row */}
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                  Dossier créé le {new Date(application.created_at).toLocaleDateString('fr-FR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </p>

                {/* Status tracker */}
                <ApplicationStatusTracker
                  applicationStatus={application.application_status}
                  paymentStatus={application.payment_status}
                  applicantId={application.applicant_id}
                />

                {/* ── Decision Letter Download ── */}
                {DECISION_STATUSES.includes(application.application_status as DecisionStatus) && applicant && (
                  <div className={`rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4
                    ${application.application_status === 'Admission définitive'
                      ? 'bg-[#021463]/5 border-[#021463]/15'
                      : application.application_status === 'Admission sous réserve'
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                      ${application.application_status === 'Admission définitive'
                        ? 'bg-[#021463]/10'
                        : application.application_status === 'Admission sous réserve'
                        ? 'bg-amber-100'
                        : 'bg-slate-200'}`}
                    >
                      <svg className={`w-5 h-5
                        ${application.application_status === 'Admission définitive'
                          ? 'text-[#021463]'
                          : application.application_status === 'Admission sous réserve'
                          ? 'text-amber-700'
                          : 'text-slate-500'}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold mb-0.5
                        ${application.application_status === 'Admission définitive'
                          ? 'text-[#021463]'
                          : application.application_status === 'Admission sous réserve'
                          ? 'text-amber-900'
                          : 'text-slate-700'}`}>
                        Votre lettre de décision officielle est disponible
                      </p>
                      <p className={`text-xs leading-relaxed
                        ${application.application_status === 'Admission définitive'
                          ? 'text-[#021463]/65'
                          : application.application_status === 'Admission sous réserve'
                          ? 'text-amber-700'
                          : 'text-slate-500'}`}>
                        Document généré par le Bureau des Admissions · Ignito Academy
                      </p>
                    </div>

                    <PDFDownloadButton
                      applicantName={`${applicant.prenom} ${applicant.nom}`}
                      applicantId={application.applicant_id}
                      status={application.application_status as DecisionStatus}
                      conditionalMessage={application.conditional_message}
                    />
                  </div>
                )}

                {/* Academic info card */}
                {application.ecole_provenance && application.option_academique && (
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h4 className="font-serif text-base font-bold text-[#021463] mb-4">
                      Informations académiques
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">École</p>
                        <p className="font-medium text-[#1E293B]">{application.ecole_provenance}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Option</p>
                        <p className="font-medium text-[#1E293B]">{application.option_academique}</p>
                      </div>
                      {application.exam_status && (
                        <div className="space-y-0.5">
                          <p className="text-xs text-slate-400 uppercase tracking-wider font-medium">Examen d&apos;État</p>
                          <p className="font-medium text-[#1E293B]">{application.exam_status}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action banners */}
                {(() => {
                  const allDocsUploaded = REQUIRED_DOC_TYPES.every(t =>
                    application.uploadedDocuments?.some((d: any) => d.document_type === t)
                  )
                  return (
                    <>
                      {!allDocsUploaded && application.payment_status !== 'Confirmed' && application.payment_status !== 'paid' && application.application_status !== 'Admission sous réserve' && (
                        <div className="flex items-start gap-3.5 p-4 bg-blue-50 border border-[#021463]/15 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-[#021463]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg className="w-4 h-4 text-[#021463]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-[#021463] mb-0.5">Action requise</p>
                            <p className="text-sm text-[#1E293B]/70 leading-relaxed">
                              Veuillez télécharger les 5 documents requis ci-dessous. Le paiement des frais d&apos;étude de dossier sera débloqué ensuite.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}

                {application.uploadedDocuments && REQUIRED_DOC_TYPES.every((t: string) =>
                  application.uploadedDocuments.some((d: any) => d.document_type === t)
                ) && application.payment_status === 'Pending' && (
                  <div className="flex items-start gap-3.5 p-4 bg-[#10B981]/5 border border-[#10B981]/20 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-[#10B981]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#10B981]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#065f46] mb-1">Documents reçus — dernière étape</p>
                      <p className="text-sm text-[#1E293B]/65 mb-3">
                        Vos documents ont été téléchargés avec succès. Procédez au paiement pour valider votre candidature.
                      </p>
                      <Link href={`/apply/payment?applicant_id=${application.applicant_id}`}>
                        <Button className="bg-[#021463] hover:bg-[#021463]/90 text-white min-h-[44px] px-6 text-sm font-semibold rounded-md">
                          Procéder au paiement (29 USD)
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {application.payment_status === 'Failed' && (
                  <div className="flex items-start gap-3.5 p-4 bg-[#EF4444]/5 border border-[#EF4444]/20 rounded-xl">
                    <div className="w-8 h-8 rounded-lg bg-[#EF4444]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-4 h-4 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 2a10 10 0 100 20A10 10 0 0012 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#991b1b] mb-1">Paiement échoué</p>
                      <p className="text-sm text-[#1E293B]/65 mb-3">
                        Votre tentative de paiement n&apos;a pas abouti. Veuillez réessayer.
                      </p>
                      <Link href={`/apply/payment?applicant_id=${application.applicant_id}`}>
                        <Button className="bg-[#EF4444] hover:bg-[#EF4444]/90 text-white min-h-[44px] px-6 text-sm font-semibold rounded-md">
                          Réessayer le paiement
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* ── Conditional admission: unified single card — shown ABOVE document list ── */}
                {application.application_status === 'Admission sous réserve' && (
                  <div className="border border-amber-400 rounded-xl overflow-hidden">

                    {/* Top: admin message */}
                    <div className="flex items-start gap-3.5 p-5 bg-amber-50 border-b border-amber-200">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-amber-900 mb-1">
                          Action requise : Admission sous réserve
                        </p>
                        <p className="text-sm text-amber-800 leading-relaxed">
                          {application.conditional_message
                            ? application.conditional_message
                            : 'Votre dossier a été examiné. Veuillez soumettre les documents manquants pour finaliser votre admission.'}
                        </p>
                      </div>
                    </div>

                    {/* Bottom: upload zone */}
                    <div className="p-5 bg-amber-50/60 space-y-3">
                      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                        Télécharger le document manquant &nbsp;·&nbsp; PDF, JPG ou PNG — max 5 Mo
                      </p>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={e => {
                          const f = e.target.files?.[0] ?? null
                          setCondFile(f)
                          setCondUploadError(null)
                          e.target.value = ''
                        }}
                      />

                      {!condFile ? (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border-2 border-dashed border-amber-300 bg-white text-amber-700 text-sm font-medium hover:border-amber-400 hover:bg-amber-50 transition-colors"
                        >
                          <Paperclip className="w-4 h-4" />
                          Choisir le document requis
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 p-3 bg-white rounded-lg border border-amber-200">
                          <Paperclip className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span className="text-sm text-amber-900 font-medium flex-1 truncate">{condFile.name}</span>
                          <button
                            onClick={() => { setCondFile(null); setCondUploadError(null) }}
                            className="text-amber-400 hover:text-amber-700 transition-colors"
                            aria-label="Retirer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {condUploadError && (
                        <p className="text-xs text-red-600 font-medium">{condUploadError}</p>
                      )}

                      {condFile && (
                        <Button
                          onClick={() => handleConditionalUploadAndSubmit(application.applicant_id)}
                          disabled={condUploading}
                          className="w-full bg-amber-600 hover:bg-amber-700 text-white min-h-[48px] text-sm font-semibold rounded-md transition-all"
                        >
                          {condUploading
                            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Envoi en cours…</>
                            : <><CheckCircle2 className="w-4 h-4 mr-2" />Soumettre les documents manquants</>}
                        </Button>
                      )}
                    </div>

                  </div>
                )}

                {/* Document upload */}
                <div>
                  <h4 className="font-serif text-base font-bold text-[#021463] mb-3">Documents justificatifs</h4>
                  <DocumentUpload
                    paymentStatus={application.payment_status}
                    applicantId={application.applicant_id}
                    uploadedDocuments={application.uploadedDocuments}
                    onUploadSuccess={fetchData}
                    applicationStatus={application.application_status}
                    examStatus={application.exam_status}
                  />
                </div>

              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
              <p className="text-slate-400 mb-5 text-sm">Vous n&apos;avez pas encore de candidature en cours.</p>
              <Link href="/apply">
                <Button className="bg-[#021463] hover:bg-[#021463]/90 text-white min-h-[48px] px-8 font-semibold rounded-md">
                  Commencer une candidature
                </Button>
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-300 pt-4">© 2026 Ignito Academy. Tous droits réservés.</p>
      </main>
    </div>
  )
}
