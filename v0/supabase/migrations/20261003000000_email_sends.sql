-- Track automated email sequence sends to prevent duplicate deliveries.

CREATE TABLE IF NOT EXISTS public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sequence_id TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, sequence_id)
);

CREATE INDEX IF NOT EXISTS idx_email_sends_profile_id
  ON public.email_sends(profile_id);

CREATE INDEX IF NOT EXISTS idx_email_sends_sequence_id
  ON public.email_sends(sequence_id);

COMMENT ON TABLE public.email_sends IS 'Delivery log for automated lifecycle email sequences.';
COMMENT ON COLUMN public.email_sends.sequence_id IS 'Sequence identifier, e.g. first_run_reminder, plan_activation, re_engagement.';
