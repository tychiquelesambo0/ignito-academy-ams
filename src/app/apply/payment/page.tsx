'use client'

export const dynamic = 'force-dynamic'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

type PaymentProvider = 'M-Pesa' | 'Orange Money' | 'Airtel Money'

const PROVIDERS: { id: PaymentProvider; label: string; sub: string; color: string; letter: string }[] = [
  { id: 'M-Pesa',        label: 'M-Pesa',        sub: 'Vodacom M-Pesa',  color: 'bg-green-600',  letter: 'M' },
  { id: 'Orange Money',  label: 'Orange Money',  sub: 'Orange RDC',      color: 'bg-orange-500', letter: 'O' },
  { id: 'Airtel Money',  label: 'Airtel Money',  sub: 'Airtel RDC',      color: 'bg-red-600',    letter: 'A' },
]

// ─── Inner component (needs useSearchParams → must be inside Suspense) ───────

function PaymentForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const applicantId = searchParams.get('applicant_id')

  const [selected, setSelected] = useState<PaymentProvider | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [succeeded, setSucceeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleMockPayment = async () => {
    if (!selected) {
      setError('Veuillez sélectionner un mode de paiement.')
      return
    }
    if (!applicantId) {
      setError('Identifiant de candidature manquant.')
      return
    }

    setIsLoading(true)
    setError(null)

    // Simulate a 2.5 s network delay for realism
    await new Promise(resolve => setTimeout(resolve, 2500))

    try {
      const res = await fetch('/api/payment/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicantId, provider: selected }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erreur lors du traitement du paiement.')
        setIsLoading(false)
        return
      }

      // Success — show confirmation screen briefly, then go to dashboard
      setSucceeded(true)
      setIsLoading(false)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
      setIsLoading(false)
    }
  }

  // ── Success screen ──────────────────────────────────────────────────────────
  if (succeeded) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <div>
          <p className="font-serif text-2xl font-bold text-[#021463]">Paiement réussi !</p>
          <p className="text-sm text-slate-500 mt-1">Redirection vers votre tableau de bord…</p>
        </div>
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#021463] mt-2" />
      </div>
    )
  }

  // ── Payment form ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7">

      {/* Demo banner */}
      <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800 leading-relaxed">
          <span className="font-semibold">Mode Démo</span> — En attente de l&apos;intégration Nomba.
          Cliquez sur le bouton ci-dessous pour simuler un paiement réussi.
        </p>
      </div>

      {/* Applicant ID */}
      {applicantId && (
        <div className="flex items-center justify-between p-4 bg-slate-50 border-l-4 border-l-[#4EA6F5] border border-slate-200 rounded-lg">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-0.5">
              Identifiant de candidature
            </p>
            <p className="font-mono font-bold text-[#021463] text-base tracking-wide">{applicantId}</p>
          </div>
        </div>
      )}

      {/* Amount */}
      <div className="flex items-center justify-between p-5 bg-[#021463]/5 border border-[#021463]/15 rounded-xl">
        <div>
          <p className="text-sm text-slate-500 font-medium">Frais d&apos;étude de dossier</p>
          <p className="text-xs text-slate-400 mt-0.5">Non remboursables</p>
        </div>
        <p className="text-2xl font-bold text-[#021463]">29 USD</p>
      </div>

      {/* Provider selection */}
      <div className="space-y-2.5">
        <p className="text-sm font-semibold text-slate-700">Mode de paiement *</p>
        {PROVIDERS.map(p => {
          const active = selected === p.id
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => { setSelected(p.id); setError(null) }}
              className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all
                ${active
                  ? 'border-[#4EA6F5] bg-blue-50/40 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                }`}
            >
              <div className={`w-11 h-11 ${p.color} rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                {p.letter}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm ${active ? 'text-[#021463]' : 'text-slate-800'}`}>{p.label}</p>
                <p className="text-xs text-slate-400">{p.sub}</p>
              </div>
              {/* Custom radio indicator */}
              <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors
                ${active ? 'border-[#4EA6F5]' : 'border-slate-300'}`}>
                {active && <div className="w-2.5 h-2.5 rounded-full bg-[#4EA6F5]" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </p>
      )}

      {/* CTA */}
      <Button
        onClick={handleMockPayment}
        disabled={isLoading || !selected}
        className="w-full bg-[#021463] hover:bg-[#021463]/90 text-white text-base font-semibold rounded-lg min-h-[56px] disabled:opacity-50 transition-all"
      >
        {isLoading
          ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Traitement en cours…</>
          : 'Payer 29 USD'}
      </Button>

      {/* Security notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-1">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Paiement sécurisé via Nomba · Données chiffrées SSL</span>
      </div>

      <p className="text-center text-xs text-slate-300">© 2026 Ignito Academy. Tous droits réservés.</p>
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────────

export default function PaymentPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* Admitta navbar */}
      <header className="bg-[#021463] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center">
          <span className="font-serif text-2xl font-bold text-white tracking-tight">Admitta</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12">

        {/* Page heading */}
        <div className="mb-8">
          <h1 className="font-serif text-3xl font-bold text-[#021463]">
            Paiement des frais de dossier
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            Étape finale — Validez votre candidature en réglant les frais d&apos;étude.
          </p>
        </div>

        {/* Checkout card — intentionally narrower than the page grid */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
          <Suspense fallback={
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-[#021463]" />
            </div>
          }>
            <PaymentForm />
          </Suspense>
        </div>

      </main>
    </div>
  )
}
