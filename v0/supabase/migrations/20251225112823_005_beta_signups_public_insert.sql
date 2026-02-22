-- Migration: Allow public inserts into beta_signups waitlist

CREATE POLICY "Allow public beta signup insert" ON beta_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (email IS NOT NULL);;
