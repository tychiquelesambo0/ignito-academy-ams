'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function handleLogout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function handleNewApplication() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // Generate new Applicant_ID for current intake year
  const currentYear = new Date().getFullYear()
  const { data: newId, error: idError } = await supabase.rpc('generate_applicant_id', {
    p_intake_year: currentYear
  })

  if (idError || !newId) {
    console.error('Error generating new Applicant_ID:', idError)
    redirect('/dashboard')
    return
  }

  // Create new application linked to same user_id
  const { error: appError } = await supabase
    .from('applications')
    .insert({
      applicant_id: newId,
      user_id: user.id,
      intake_year: currentYear,
      application_status: 'Dossier Créé',
      payment_status: 'Pending',
    })

  if (appError) {
    console.error('Error creating new application:', appError)
    redirect('/dashboard')
    return
  }

  // Redirect to academic history page for new application
  redirect(`/apply/academic-history?applicant_id=${newId}`)
}
