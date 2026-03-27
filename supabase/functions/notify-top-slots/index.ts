// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0';

function buildCorsHeaders(req: Request) {
  // Permitir dev en localhost y facilitar debugging.
  // Si prefieres un allowlist estricto, cambia "*" por tu dominio.
  const origin = req.headers.get('Origin') ?? '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };
}

interface SlotPayload {
  date: string;
  start_min: number;
  end_min: number;
  pct_available: number;
  preferred_count: number;
  available_count?: number;
  total_members?: number;
}

interface Payload {
  groupId: string;
  targetPeople: number;
  slots: SlotPayload[];
}

function formatCalendarDateEs(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map((v) => Number(v));
  if (!y || !m || !d) return dateISO;
  const dateUtc = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC'
  }).format(dateUtc);
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);

  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing Supabase env vars' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing auth token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const jwt = authHeader.slice('Bearer '.length);

    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid auth token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = (await req.json()) as Payload;
    const { groupId, targetPeople, slots } = body;

    if (!groupId || targetPeople == null || !slots?.length) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) {
      console.error('Group fetch error', groupError.message, 'groupId', groupId);
      return new Response(
        JSON.stringify({ error: 'Group not found', detail: groupError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!group) {
      return new Response(JSON.stringify({ error: 'Group not found', detail: 'No row for id: ' + groupId }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: membership, error: membershipError } = await supabase
      .from('group_members')
      .select('id, role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (membership.role !== 'host') {
      return new Response(JSON.stringify({ error: 'Forbidden', detail: 'Solo el host puede enviar el correo del planner' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', groupId);

    if (membersError) {
      return new Response(JSON.stringify({ error: 'Error loading members' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const memberIds = members.map((m: { user_id: string }) => m.user_id);

    const { data: profiles, error: profilesError } = await supabase.auth.admin.listUsers();
    if (profilesError) {
      return new Response(JSON.stringify({ error: 'Error loading users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const recipientEmails = profiles.users
      .filter((u) => memberIds.includes(u.id) && !!u.email)
      .map((u) => u.email as string);

    if (!recipientEmails.length) {
      return new Response(JSON.stringify({ error: 'No recipient emails' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const formatTime = (min: number) => {
      const h = Math.floor(min / 60)
        .toString()
        .padStart(2, '0');
      const m = (min % 60).toString().padStart(2, '0');
      return `${h}:${m}`;
    };

    const slotLines = slots
      .map((s) => {
        // Group calendar date (YYYY-MM-DD), timezone-independent rendering.
        const dateLabel = formatCalendarDateEs(s.date);
        const available = s.available_count ?? 0;
        const total = s.total_members ?? 0;
        const pct = Math.round(s.pct_available * 100);
        const preferred = s.preferred_count;

        return `
          <tr>
            <td style="padding:8px 0;font-weight:600;">${dateLabel}</td>
          </tr>
          <tr>
            <td style="padding:2px 0;color:#374151;">${formatTime(s.start_min)} – ${formatTime(
              s.end_min
            )}</td>
          </tr>
          <tr>
            <td style="padding:2px 0 12px 0;color:#4b5563;font-size:14px;">
              ${available}/${total} disponibles · ${pct}% disponible${
          preferred > 0 ? ` · ⭐ ${preferred} preferidos` : ''
        }
            </td>
          </tr>
        `;
      })
      .join('');

    const subject = `📅 Mejores horarios — ${group.name}`;

    const html = `
      <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
        <h1 style="font-size:20px;margin-bottom:8px;">${group.name}</h1>
        <p style="margin:0 0 12px 0;">El host del grupo comparte los mejores huecos detectados en el planner. Objetivo acordado de mínimo de personas con disponibilidad: <strong>${targetPeople}</strong>.</p>
        <p style="margin:0 0 16px 0;">Propuesta de horarios:</p>
        <p style="margin:0 0 12px 0;color:#374151;">
          Todos los horarios se muestran en la zona horaria del grupo: <strong>${group.timezone ?? 'Europe/Madrid'}</strong>.
        </p>
        <table style="width:100%;max-width:480px;border-collapse:collapse;">
          ${slotLines}
        </table>
        <p style="margin-top:16px;font-size:12px;color:#6b7280;">
          Mensaje enviado desde QuedaFlow a solicitud del host del grupo.
        </p>
      </div>
    `;

    const brevoApiKey = Deno.env.get('BREVO_API_KEY');
    const brevoSenderEmail = Deno.env.get('BREVO_SENDER_EMAIL') ?? '';
    if (!brevoApiKey) {
      return new Response(JSON.stringify({ error: 'Missing BREVO_API_KEY' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    if (!brevoSenderEmail) {
      return new Response(JSON.stringify({ error: 'Missing BREVO_SENDER_EMAIL' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const emailRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': brevoApiKey
      },
      body: JSON.stringify({
        sender: { name: 'QuedaFlow', email: brevoSenderEmail },
        to: recipientEmails.map((email) => ({ email })),
        subject,
        htmlContent: html
      })
    });

    if (!emailRes.ok) {
      const text = await emailRes.text();
      console.error('Brevo error', text);
      return new Response(JSON.stringify({ error: 'Error sending email' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { error: updateError } = await supabase
      .from('groups')
      .update({ notification_sent_at: new Date().toISOString() })
      .eq('id', groupId);

    if (updateError) {
      console.error('Error updating notification_sent_at', updateError);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'Unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});