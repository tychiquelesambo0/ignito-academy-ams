/**
 * POST /api/send-status-email
 *
 * Sends a branded French email to an applicant whenever an admin changes
 * their application status.  Called from:
 *   - admin/applications/[id]/page.tsx → handleStatusUpdate() (status dropdown)
 *   - admin/applications/[id]/page.tsx → handleDecision()     (rejected only — others handled by Edge Fn)
 *
 * Body: { applicant_id: string, new_status: string, conditional_message?: string }
 *
 * Security: caller must be an authenticated admissions officer.
 */

import React                          from 'react'
import { NextRequest, NextResponse }   from 'next/server'
import { render }                      from '@react-email/render'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { sendEmailWithRetry }          from '@/lib/email/send-with-retry'
import {
  ApplicationStatusEmail,
  getStatusEmailSubject,
  type StatusEmailType,
} from '@/components/emails/ApplicationStatusEmail'

// Statuses that should trigger an applicant email
const EMAILABLE_STATUSES: StatusEmailType[] = [
  'en_cours_devaluation',
  'Admission sous réserve',
  'Admission définitive',
  'Dossier refusé',
]

function isEmailableStatus(s: string): s is StatusEmailType {
  return (EMAILABLE_STATUSES as string[]).includes(s)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { applicant_id, new_status, conditional_message } = body

    if (!applicant_id || !new_status) {
      return NextResponse.json(
        { error: 'applicant_id et new_status sont requis.' },
        { status: 400 },
      )
    }

    // Only send emails for statuses that have a template
    if (!isEmailableStatus(new_status)) {
      return NextResponse.json({ skipped: true, reason: 'Statut sans template email.' })
    }

    // Verify the caller is an authenticated admissions officer
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 })
    }

    const { data: officer } = await supabase
      .from('admissions_officers')
      .select('id')
      .eq('id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!officer) {
      return NextResponse.json({ error: 'Accès réservé au Bureau des Admissions.' }, { status: 403 })
    }

    // Fetch applicant email + name via service-role client (bypasses RLS)
    const admin = createAdminClient()

    const { data: appRow, error: appErr } = await admin
      .from('applications')
      .select('applicant_id, applicants!inner(prenom, nom, email)')
      .eq('applicant_id', applicant_id)
      .single()

    if (appErr || !appRow) {
      return NextResponse.json(
        { error: `Dossier introuvable : ${applicant_id}` },
        { status: 404 },
      )
    }

    const apt  = (appRow as any).applicants
    const name = `${apt.prenom} ${apt.nom}`
    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://ignitoacademy.com'}/dashboard`

    // Render React Email → HTML string (must use React.createElement, not direct call)
    const html = await render(
      React.createElement(ApplicationStatusEmail, {
        applicantName:      name,
        applicantId:        applicant_id,
        status:             new_status,
        dashboardUrl,
        conditionalMessage: new_status === 'Admission sous réserve' ? conditional_message : undefined,
      }),
    )
    console.log(`[send-status-email] HTML rendered, length=${html.length}`)

    const subject = getStatusEmailSubject(new_status, applicant_id)

    const emailType = new_status === 'en_cours_devaluation'   ? 'payment_confirmation'
                    : new_status === 'Admission sous réserve' ? 'conditional_acceptance'
                    : new_status === 'Admission définitive'   ? 'final_acceptance'
                    : 'refusal'

    console.log(`[send-status-email] Sending ${emailType} to ${apt.email}`)

    // Send with retry + audit log
    const result = await sendEmailWithRetry({
      to:          apt.email,
      subject,
      html,
      applicantId: applicant_id,
      emailType,
    })

    console.log(`[send-status-email] result:`, JSON.stringify(result))

    if (!result.success) {
      return NextResponse.json(
        {
          error:      `Échec d'envoi email après ${result.retryCount} tentatives.`,
          detail:     String(result.error),
          recipient:  apt.email,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success:    true,
      messageId:  result.messageId,
      wasMock:    result.wasMock ?? false,
      retryCount: result.retryCount,
      recipient:  apt.email,
    })

  } catch (err) {
    console.error('[send-status-email] unexpected error:', err)
    return NextResponse.json(
      { error: 'Erreur interne. Veuillez réessayer.' },
      { status: 500 },
    )
  }
}
