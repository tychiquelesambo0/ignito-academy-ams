'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, User, GraduationCap, CreditCard, FileText,
  Download, Loader2, CheckCircle2, Clock, AlertCircle,
  RefreshCw, Lock, UserCheck, XCircle, LogOut, ShieldCheck,
  ShieldX, BadgeCheck, Gavel, Check,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Applicant {
  prenom: string; nom: string; email: string
  phone_number: string; date_naissance: string
}

interface Application {
  applicant_id: string; intake_year: number
  ecole_provenance: string; option_academique: string
  exam_status: string; application_status: string
  payment_status: string; transaction_id: string | null
  payment_confirmed_at: string | null; conditional_message: string | null
  version: number; created_at: string; updated_at: string
}

interface UploadedDoc {
  id: string; file_name: string; file_size_bytes: number
  mime_type: string; uploaded_at: string
  file_path: string; document_type: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  identification:        "Preuve d'Identité",
  diploma:               "Diplôme d'État ou Attestation",
  bulletin_10:           'Bulletin de la 10e année',
  bulletin_11:           'Bulletin de la 11e année',
  bulletin_12:           'Bulletin de la 12e année',
  document_conditionnel: 'Document additionnel',
  other:                 'Autre document',
}

// Ordered groups mirroring the applicant dashboard
const DOC_GROUPS = [
  {
    key:   'identification',
    title: "Preuve d'Identité",
    desc:  "Carte d'électeur, passeport, attestation ou acte de naissance.",
    types: ['identification'],
  },
  {
    key:   'diploma',
    title: "Diplôme d'État ou Attestation",
    desc:  'Copie officielle de votre diplôme ou attestation de réussite.',
    types: ['diploma'],
  },
  {
    key:   'bulletins',
    title: 'Historique Scolaire (Bulletins)',
    desc:  'Bulletins de notes pour les 3 dernières années du secondaire.',
    types: ['bulletin_10', 'bulletin_11', 'bulletin_12'],
  },
  {
    key:   'additional',
    title: 'Documents Additionnels',
    desc:  'Documents soumis suite à une demande de compléments de dossier.',
    types: ['document_conditionnel'],
  },
]

const STATUS_OPTIONS = [
  { value: 'Admission sous réserve', label: 'Admission sous réserve' },
  { value: 'Admission définitive',   label: 'Admission définitive' },
  { value: 'Dossier refusé',         label: 'Dossier refusé' },
]

const APP_STATUS_LABELS: Record<string, string> = {
  'Dossier Créé':           'Dossier créé',
  'en_cours_devaluation':   "En cours d'évaluation",
  'Frais Réglés':           "En cours d'évaluation",
  'Admission sous réserve': 'Admission sous réserve',
  'Admission définitive':   'Admission définitive',
  'Dossier refusé':         'Dossier refusé',
}

const APP_STATUS_STYLE: Record<string, { bg: string; text: string; icon: React.ComponentType<{ className?: string }> }> = {
  'Dossier Créé':           { bg: 'bg-slate-100  border-slate-200',   text: 'text-slate-600',  icon: FileText },
  'en_cours_devaluation':   { bg: 'bg-amber-50   border-amber-200',   text: 'text-amber-700',  icon: Clock },
  'Frais Réglés':           { bg: 'bg-amber-50   border-amber-200',   text: 'text-amber-700',  icon: Clock },
  'Admission sous réserve': { bg: 'bg-purple-50  border-purple-200',  text: 'text-purple-700', icon: AlertCircle },
  'Admission définitive':   { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700',icon: UserCheck },
  'Dossier refusé':         { bg: 'bg-red-50     border-red-200',     text: 'text-red-700',    icon: XCircle },
}

const PAY_STYLE: Record<string, string> = {
  paid:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  Confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending:   'bg-amber-50   text-amber-700   border-amber-200',
  Failed:    'bg-red-50     text-red-700     border-red-200',
}
const PAY_LABELS: Record<string, string> = {
  paid: 'Payé', Confirmed: 'Confirmé', Pending: 'En attente', Failed: 'Échoué',
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SectionCard({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <Icon className="w-4 h-4 text-[#4EA6F5]" />
        <h3 className="font-serif text-sm font-bold text-[#021463]">{title}</h3>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-40 flex-shrink-0">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value ?? '—'}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const applicantId = decodeURIComponent(params.id as string)

  const [applicant,    setApplicant]    = useState<Applicant | null>(null)
  const [application,  setApplication]  = useState<Application | null>(null)
  const [documents,    setDocuments]    = useState<UploadedDoc[]>([])
  const [loading,      setLoading]      = useState(true)
  const [officerId,    setOfficerId]    = useState<string | null>(null)

  // Status update state (manual dropdown)
  const [selectedStatus,  setSelectedStatus]  = useState('')
  const [isUpdating,      setIsUpdating]      = useState(false)
  const [updateSuccess,   setUpdateSuccess]   = useState(false)
  const [versionConflict, setVersionConflict] = useState(false)
  const [updateError,     setUpdateError]     = useState<string | null>(null)
  const [emailNotif,      setEmailNotif]      = useState<{ ok: boolean; msg: string } | null>(null)

  // Decision action state (Edge Function buttons)
  const [decidingType,    setDecidingType]    = useState<string | null>(null)
  const [decisionSuccess, setDecisionSuccess] = useState<string | null>(null)
  const [decisionError,   setDecisionError]   = useState<string | null>(null)

  // Conditional admission panel state
  const [condMessage,      setCondMessage]      = useState('')

  // Document download state
  const [downloading, setDownloading] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/admin/login'); return }

    // Verify officer
    const { data: officer } = await supabase
      .from('admissions_officers')
      .select('id, is_active')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!officer) { router.push('/admin/forbidden'); return }
    setOfficerId(user.id)

    // Fetch application + applicant in one join
    const { data: appRow, error: appErr } = await supabase
      .from('applications')
      .select(`
        applicant_id, intake_year, ecole_provenance, option_academique,
        exam_status, application_status, payment_status,
        transaction_id, payment_confirmed_at,
        version, created_at, updated_at,
        applicants!inner (
          prenom, nom, email, phone_number, date_naissance
        )
      `)
      .eq('applicant_id', applicantId)
      .single()

    if (appErr || !appRow) {
      router.push('/admin'); return
    }

    // Cast to any: conditional_message was added via a direct SQL migration and
    // isn't reflected in the auto-generated Supabase TypeScript types yet.
    const raw = appRow as any
    const apt = raw.applicants
    setApplicant({
      prenom:         apt.prenom,
      nom:            apt.nom,
      email:          apt.email,
      phone_number:   apt.phone_number,
      date_naissance: apt.date_naissance,
    })
    const appData: Application = {
      applicant_id:        raw.applicant_id,
      intake_year:         raw.intake_year,
      ecole_provenance:    raw.ecole_provenance,
      option_academique:   raw.option_academique,
      exam_status:         raw.exam_status,
      application_status:  raw.application_status,
      payment_status:      raw.payment_status,
      transaction_id:      raw.transaction_id,
      payment_confirmed_at: raw.payment_confirmed_at,
      conditional_message: raw.conditional_message ?? null,
      version:             raw.version,
      created_at:          raw.created_at,
      updated_at:          raw.updated_at,
    }
    setApplication(appData)
    setSelectedStatus(appData.application_status)
    setCondMessage(appData.conditional_message ?? '')

    // Fetch documents
    const { data: docs } = await supabase
      .from('uploaded_documents')
      .select('id, file_name, file_size_bytes, mime_type, uploaded_at, file_path, document_type')
      .eq('applicant_id', applicantId)
      .order('uploaded_at', { ascending: true })

    setDocuments(docs ?? [])
    setLoading(false)
  }, [applicantId, router])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Status update (with optimistic locking) ────────────────────────────────

  const handleStatusUpdate = async () => {
    if (!application || selectedStatus === application.application_status) return

    // Admission sous réserve requires a message for the applicant
    if (selectedStatus === 'Admission sous réserve' && !condMessage.trim()) {
      setUpdateError("Un message pour le candidat est obligatoire pour l'admission sous réserve. Saisissez-le ci-dessous.")
      return
    }

    setIsUpdating(true)
    setUpdateError(null)
    setVersionConflict(false)
    setUpdateSuccess(false)

    const supabase = createClient()
    const { data, error } = await supabase.rpc(
      'update_application_status_with_version_check',
      {
        p_applicant_id:      application.applicant_id,
        p_new_status:        selectedStatus,
        p_expected_version:  application.version,
      } as any
    )

    setIsUpdating(false)

    if (error) {
      setUpdateError("Erreur lors de la mise à jour du statut. Veuillez réessayer.")
      return
    }

    if (data === false) {
      // Version mismatch — another officer edited concurrently
      setVersionConflict(true)
      return
    }

    // When setting Admission sous réserve, also persist the conditional message
    if (selectedStatus === 'Admission sous réserve' && condMessage.trim()) {
      await (supabase as any)
        .from('applications')
        .update({ conditional_message: condMessage.trim() })
        .eq('applicant_id', application.applicant_id)
    }

    // Send status-change notification email and surface the result to the admin
    try {
      const emailRes = await fetch('/api/send-status-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          applicant_id:        application.applicant_id,
          new_status:          selectedStatus,
          conditional_message: selectedStatus === 'Admission sous réserve' ? condMessage.trim() : undefined,
        }),
      })
      const emailData = await emailRes.json()
      if (emailData.skipped) {
        setEmailNotif(null) // no email needed for this status
      } else if (!emailRes.ok || !emailData.success) {
        setEmailNotif({ ok: false, msg: `Email non envoyé : ${emailData.error ?? 'Erreur inconnue'}` })
      } else {
        setEmailNotif({ ok: true, msg: `Email envoyé à ${emailData.recipient}` })
      }
    } catch (err) {
      setEmailNotif({ ok: false, msg: `Erreur réseau lors de l'envoi de l'email.` })
      console.error('[send-status-email]', err)
    }
    setTimeout(() => setEmailNotif(null), 8000)

    // Success — refresh data to get new version number
    setUpdateSuccess(true)
    await fetchData()
    setTimeout(() => setUpdateSuccess(false), 3000)
  }

  // ── Decision action (calls admin-decision Edge Function) ──────────────────

  const handleDecision = async (decisionType: 'conditional' | 'final' | 'rejected') => {
    if (!application || !officerId) return
    setDecidingType(decisionType)
    setDecisionError(null)
    setDecisionSuccess(null)
    setVersionConflict(false)

    const supabase = createClient()
    const { data, error } = await supabase.functions.invoke('admin-decision', {
      body: {
        applicant_id:     application.applicant_id,
        decision_type:    decisionType,
        admin_id:         officerId,
        expected_version: application.version,
      },
    })

    setDecidingType(null)

    if (error) {
      setDecisionError("Une erreur réseau est survenue. Veuillez réessayer.")
      return
    }

    if (data?.error === 'VERSION_CONFLICT' || data?.error === 'VERSION_CONFLICT_LATE') {
      setVersionConflict(true)
      setDecisionError("Cette candidature a été modifiée par un autre utilisateur. Veuillez actualiser la page.")
      return
    }

    if (data?.error === 'PDF_GENERATION_FAILED') {
      setDecisionError("La génération du courrier a échoué. Le statut n'a pas été modifié.")
      return
    }

    if (data?.error === 'EMAIL_SEND_FAILED') {
      setDecisionError("L'envoi de l'email a échoué après 3 tentatives. Le statut n'a pas été modifié.")
      return
    }

    if (!data?.success) {
      setDecisionError(data?.message ?? "Une erreur inattendue est survenue. Veuillez réessayer.")
      return
    }

    // For rejected decisions the Edge Function skips email — send it here.
    if (decisionType === 'rejected' && application) {
      try {
        await fetch('/api/send-status-email', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            applicant_id: application.applicant_id,
            new_status:   'Dossier refusé',
          }),
        })
      } catch (err) {
        console.error('[send-status-email rejected]', err)
      }
    }

    const labels: Record<string, string> = {
      conditional: "Admission sous réserve accordée. L'email de notification a été envoyé.",
      final:       "Admission définitive accordée. L'email de félicitations a été envoyé.",
      rejected:    "Dossier refusé. L'email de notification a été envoyé au candidat.",
    }
    setDecisionSuccess(labels[decisionType])
    await fetchData()
    setTimeout(() => setDecisionSuccess(null), 5000)
  }

  // ── Conditional admission decision ────────────────────────────────────────

  // ── Document download ──────────────────────────────────────────────────────

  const handleDownload = async (doc: UploadedDoc) => {
    setDownloading(doc.id)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 120) // 2 min expiry

      if (error || !data?.signedUrl) { alert('Erreur lors du téléchargement.'); return }

      const response = await fetch(data.signedUrl)
      const blob     = await response.blob()
      const url      = window.URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = doc.file_name
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch { alert('Erreur lors du téléchargement.') }
    finally  { setDownloading(null) }
  }

  // ── Sign out ───────────────────────────────────────────────────────────────

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#021463] mx-auto mb-4" />
          <p className="text-slate-500 text-sm">Chargement du dossier…</p>
        </div>
      </div>
    )
  }

  if (!application || !applicant) return null

  const statusStyle = APP_STATUS_STYLE[application.application_status] ?? APP_STATUS_STYLE['Dossier Créé']
  const StatusIcon  = statusStyle.icon
  const isDirty     = selectedStatus !== application.application_status

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Navbar ── */}
      <header className="bg-[#021463] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-serif text-2xl font-bold text-white tracking-tight">Admitta</span>
            <span className="hidden sm:inline text-white/30 text-lg font-thin">|</span>
            <span className="hidden sm:inline text-white/70 text-sm font-medium">Bureau des Admissions</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-white/65 hover:text-white text-sm font-medium transition-colors hover:bg-white/10 px-3 py-1.5 rounded-md"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Se déconnecter</span>
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 space-y-6">

        {/* ── Breadcrumb ── */}
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#021463] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au tableau de bord
        </Link>

        {/* ── Header card ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-1">
                Dossier de candidature
              </p>
              <h1 className="font-serif text-3xl font-bold text-[#021463] leading-tight">
                {applicant.prenom} {applicant.nom}
              </h1>
              <p className="font-mono text-sm text-slate-500 mt-1">{application.applicant_id}</p>
            </div>
            <div className="flex flex-col gap-2 sm:items-end">
              {/* Application status badge */}
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                <StatusIcon className="w-4 h-4" />
                {APP_STATUS_LABELS[application.application_status] ?? application.application_status}
              </span>
              {/* Payment badge */}
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium ${PAY_STYLE[application.payment_status] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                Paiement : {PAY_LABELS[application.payment_status] ?? application.payment_status}
              </span>
              <p className="text-xs text-slate-400">
                Soumis le {new Date(application.created_at).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Left column (2/3): data sections ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Personal info */}
            <SectionCard icon={User} title="Informations personnelles">
              <InfoRow label="Prénom"          value={applicant.prenom} />
              <InfoRow label="Nom"             value={applicant.nom} />
              <InfoRow label="Email"           value={applicant.email} />
              <InfoRow label="Téléphone"       value={applicant.phone_number} />
              <InfoRow label="Date de naissance" value={new Date(applicant.date_naissance).toLocaleDateString('fr-FR', {
                day: 'numeric', month: 'long', year: 'numeric',
              })} />
            </SectionCard>

            {/* Academic history */}
            <SectionCard icon={GraduationCap} title="Historique académique">
              <InfoRow label="École de provenance" value={application.ecole_provenance} />
              <InfoRow label="Option académique"   value={application.option_academique} />
              <InfoRow label="Examen d'État"       value={application.exam_status} />
              <InfoRow label="Année d'intégration" value={String(application.intake_year)} />
            </SectionCard>

            {/* Payment info */}
            <SectionCard icon={CreditCard} title="Informations de paiement">
              <InfoRow label="Statut paiement" value={PAY_LABELS[application.payment_status] ?? application.payment_status} />
              <InfoRow label="Référence"       value={application.transaction_id} />
              <InfoRow label="Confirmé le"     value={
                application.payment_confirmed_at
                  ? new Date(application.payment_confirmed_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })
                  : null
              } />
            </SectionCard>

            {/* Documents — 4-card categorised layout (mirrors applicant dashboard) */}
            <SectionCard icon={FileText} title={`Pièces justificatives (${documents.length} fichier${documents.length !== 1 ? 's' : ''})`}>
              {documents.length === 0 ? (
                <p className="text-sm text-slate-400 py-3">Aucun document téléchargé.</p>
              ) : (
                <div className="space-y-3 -mx-1">
                  {DOC_GROUPS.map(group => {
                    const groupDocs = documents.filter(d => group.types.includes(d.document_type ?? ''))
                    // Only show "Documents Additionnels" card when docs exist
                    if (group.key === 'additional' && groupDocs.length === 0) return null

                    return (
                      <div key={group.key} className="bg-slate-50 rounded-xl border border-slate-200 p-4">
                        {/* Card header */}
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${group.key === 'additional' ? 'text-amber-500' : 'text-[#4EA6F5]'}`} />
                          <p className="text-xs font-bold text-[#021463]">{group.title}</p>
                          <span className="ml-auto text-[10px] text-slate-400 font-medium">
                            {group.key === 'additional'
                              ? `${groupDocs.length} fichier${groupDocs.length !== 1 ? 's' : ''}`
                              : `${groupDocs.length}/${group.types.length}`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mb-3">{group.desc}</p>

                        {/* Bulletins: one row per sub-type */}
                        {group.key === 'bulletins' ? (
                          <div className="divide-y divide-slate-200">
                            {group.types.map((type, i) => {
                              const doc = documents.find(d => d.document_type === type)
                              return (
                                <div key={type} className={`flex items-center justify-between gap-3 ${i === 0 ? 'pb-2.5' : i < group.types.length - 1 ? 'py-2.5' : 'pt-2.5'}`}>
                                  <div className="flex items-center gap-2 min-w-0">
                                    {doc
                                      ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                      : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0" />}
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-slate-700">{DOC_TYPE_LABELS[type]}</p>
                                      {doc && <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{doc.file_name}</p>}
                                    </div>
                                  </div>
                                  {doc && (
                                    <button
                                      onClick={() => handleDownload(doc)}
                                      disabled={downloading === doc.id}
                                      className="flex items-center gap-1 text-[11px] font-medium text-[#4EA6F5] border border-[#4EA6F5] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                                    >
                                      {downloading === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                      Télécharger
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          /* Identity, Diploma, Additionnels: one row per file */
                          <div className="divide-y divide-slate-200">
                            {groupDocs.length === 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 flex-shrink-0" />
                                <p className="text-xs text-slate-400 italic">Non soumis</p>
                              </div>
                            ) : (
                              groupDocs.map((doc, i) => (
                                <div key={doc.id} className={`flex items-center justify-between gap-3 ${i === 0 ? (groupDocs.length > 1 ? 'pb-2.5' : '') : i < groupDocs.length - 1 ? 'py-2.5' : 'pt-2.5'}`}>
                                  <div className="flex items-start gap-2 min-w-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                      <p className="text-xs text-slate-700 truncate max-w-[200px]">{doc.file_name}</p>
                                      <p className="text-[11px] text-slate-400">
                                        {(doc.file_size_bytes / 1048576).toFixed(2)} Mo &middot;{' '}
                                        {new Date(doc.uploaded_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    disabled={downloading === doc.id}
                                    className="flex items-center gap-1 text-[11px] font-medium text-[#4EA6F5] border border-[#4EA6F5] hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                                  >
                                    {downloading === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                                    Télécharger
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* ── Right column (1/3): status panel ── */}
          <div className="space-y-6">
            <div className="lg:sticky lg:top-[84px] space-y-4">


              {/* Status update card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
                  <Lock className="w-4 h-4 text-[#4EA6F5]" />
                  <h3 className="font-serif text-sm font-bold text-[#021463]">Statut du dossier</h3>
                  <span className="ml-auto text-[10px] text-slate-400 font-mono">v{application.version}</span>
                </div>

                <div className="px-5 py-5 space-y-4">

                  {/* Current status */}
                  <div>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Statut actuel</p>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {APP_STATUS_LABELS[application.application_status] ?? application.application_status}
                    </span>
                  </div>

                  {/* New status select */}
                  <div className="space-y-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Mettre à jour</p>
                    <select
                      value={selectedStatus}
                      onChange={e => {
                        setSelectedStatus(e.target.value)
                        setVersionConflict(false)
                        setUpdateError(null)
                        setUpdateSuccess(false)
                      }}
                      className="w-full h-10 rounded-lg border border-slate-200 text-sm px-3 focus:outline-none focus:ring-2 focus:ring-[#4EA6F5]/40 focus:border-[#4EA6F5] transition-colors bg-white"
                    >
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>

                    {/* Inline required message — only when Admission sous réserve is selected */}
                    {selectedStatus === 'Admission sous réserve' && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-2">
                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
                          <span className="text-amber-500">★</span> Message obligatoire
                        </p>
                        <textarea
                          value={condMessage}
                          onChange={e => { setCondMessage(e.target.value); setUpdateError(null) }}
                          placeholder="Ex. : Veuillez soumettre votre bulletin de la 12e année certifié par l'école."
                          rows={3}
                          className="w-full rounded-md border border-amber-200 bg-white text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 transition-colors resize-none text-amber-900 placeholder-amber-300"
                        />
                        {!condMessage.trim() && (
                          <p className="text-[10px] text-amber-600">
                            Ce message sera affiché au candidat et inclus dans sa lettre de décision.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Version conflict warning */}
                  {versionConflict && (
                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-amber-800">
                        <p className="font-semibold mb-1">Conflit de modification</p>
                        <p>Cette candidature a été modifiée par un autre utilisateur. Veuillez actualiser la page avant de continuer.</p>
                        <button
                          onClick={() => { setVersionConflict(false); fetchData() }}
                          className="flex items-center gap-1 mt-2 text-amber-700 font-semibold hover:underline"
                        >
                          <RefreshCw className="w-3 h-3" /> Actualiser
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Generic error */}
                  {updateError && !versionConflict && (
                    <p className="text-xs text-red-500">{updateError}</p>
                  )}

                  {/* Success */}
                  {updateSuccess && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-800 font-medium">Statut mis à jour avec succès.</p>
                    </div>
                  )}

                  {/* Email notification result */}
                  {emailNotif && (
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${emailNotif.ok ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
                      {emailNotif.ok
                        ? <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        : <AlertCircle   className="w-4 h-4 text-red-500 flex-shrink-0" />}
                      <p className={`text-xs font-medium ${emailNotif.ok ? 'text-blue-800' : 'text-red-700'}`}>
                        {emailNotif.msg}
                      </p>
                    </div>
                  )}

                  {/* Submit button */}
                  {(() => {
                    const condMsgMissing = selectedStatus === 'Admission sous réserve' && !condMessage.trim()
                    const canSubmit = isDirty && !isUpdating && !versionConflict && !condMsgMissing
                    return (
                      <button
                        onClick={handleStatusUpdate}
                        disabled={!canSubmit}
                        className={`w-full h-10 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2
                          ${canSubmit
                            ? 'bg-[#021463] hover:bg-[#021463]/90 text-white'
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                        {isUpdating
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Mise à jour…</>
                          : 'Enregistrer le statut'}
                      </button>
                    )
                  })()}
                </div>
              </div>

              {/* Metadata card */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">Métadonnées</p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-400">Identifiant</span><span className="font-mono font-bold text-[#021463]">{application.applicant_id}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Promotion</span><span className="text-slate-700">{application.intake_year}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Créé le</span><span className="text-slate-700">{new Date(application.created_at).toLocaleDateString('fr-FR')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Modifié le</span><span className="text-slate-700">{new Date(application.updated_at).toLocaleDateString('fr-FR')}</span></div>
                  <div className="flex justify-between"><span className="text-slate-400">Révision</span><span className="font-mono text-slate-700">v{application.version}</span></div>
                </div>
              </div>

            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-300 pt-4">© 2026 Ignito Academy. Tous droits réservés.</p>
      </main>
    </div>
  )
}
