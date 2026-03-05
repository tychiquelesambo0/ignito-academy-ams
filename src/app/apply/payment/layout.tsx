import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Paiement des Frais - Admitta | Ignito Academy",
  description: "Réglez les frais d'étude de dossier pour finaliser votre candidature.",
}

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
