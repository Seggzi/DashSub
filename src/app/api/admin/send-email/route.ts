import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { target, email, subject, body } = await request.json();

    if (!subject || !body) {
      return NextResponse.json({ error: 'Subject and body required' }, { status: 400 });
    }

    // Get SMTP config from settings
    const { data: smtpRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'email')
      .single();

    const smtp = smtpRow?.value as any;

    if (!smtp?.smtp_host || !smtp?.smtp_user || !smtp?.smtp_pass) {
      return NextResponse.json({ error: 'SMTP not configured. Go to Settings → Email Config first.' }, { status: 400 });
    }

    // Build recipient list
    let recipients: { email: string; full_name: string }[] = [];

    if (target === 'single') {
      if (!email) return NextResponse.json({ error: 'Email required for single target' }, { status: 400 });
      const { data: profile } = await supabase.from('profiles').select('full_name, email').eq('email', email).single();
      recipients = [{ email, full_name: profile?.full_name || 'User' }];
    } else {
      // All users — get from profiles
      const { data: profiles } = await supabase.from('profiles').select('email, full_name').not('email', 'is', null);
      recipients = (profiles || [])
        .filter(p => p.email)
        .map(p => ({ email: p.email!, full_name: p.full_name || 'User' }));
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'No recipients found' }, { status: 400 });
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: smtp.smtp_host,
      port: smtp.smtp_port || 587,
      secure: smtp.smtp_port === 465,
      auth: { user: smtp.smtp_user, pass: smtp.smtp_pass },
    });

    // Send emails
    let sent = 0;
    for (const recipient of recipients) {
      try {
        const personalizedBody = body
          .replace(/\{\{full_name\}\}/g, recipient.full_name)
          .replace(/\{\{email\}\}/g, recipient.email);

        await transporter.sendMail({
          from: `"${smtp.from_name || 'DashSub'}" <${smtp.from_email || smtp.smtp_user}>`,
          to: recipient.email,
          subject,
          html: personalizedBody,
        });
        sent++;
      } catch (sendErr) {
        console.error(`Failed to send to ${recipient.email}:`, sendErr);
      }
    }

    return NextResponse.json({ success: true, count: sent, total: recipients.length });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}