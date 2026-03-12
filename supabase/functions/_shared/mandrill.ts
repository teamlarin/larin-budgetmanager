const MANDRILL_API_URL = 'https://mandrillapp.com/api/1.0/messages/send';

interface MandrillSendOptions {
  from_email: string;
  from_name: string;
  to: string[];
  subject: string;
  html: string;
}

export async function sendEmail({ from_email, from_name, to, subject, html }: MandrillSendOptions) {
  const apiKey = Deno.env.get('MANDRILL_API_KEY');
  if (!apiKey) throw new Error('MANDRILL_API_KEY not configured');

  const response = await fetch(MANDRILL_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      message: {
        html,
        subject,
        from_email,
        from_name,
        to: to.map(email => ({ email, type: 'to' })),
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Mandrill error: ${JSON.stringify(data)}`);
  }

  // Check for rejected/invalid status
  if (Array.isArray(data)) {
    const failed = data.filter((r: any) => r.status === 'rejected' || r.status === 'invalid');
    if (failed.length > 0) {
      throw new Error(`Mandrill delivery failed: ${JSON.stringify(failed)}`);
    }
  }

  return data;
}
