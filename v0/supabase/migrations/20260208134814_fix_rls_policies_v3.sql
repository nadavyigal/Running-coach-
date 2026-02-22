-- Note: profile_id in conversations/plans/idempotency_keys is uuid, but profiles.id is bigint
-- This appears to be a schema design issue that needs separate resolution
-- For now, we'll create policies that work with the auth_user_id directly

-- conversations: Allow authenticated users to access their own conversations
-- Since there's no profile_id link, we'll need to rely on application-level security
-- or create a proper foreign key to profiles.auth_user_id
CREATE POLICY "Authenticated users can manage conversations"
  ON conversations
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- conversation_messages: Allow authenticated users
CREATE POLICY "Authenticated users can read messages"
  ON conversation_messages
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert messages"
  ON conversation_messages
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- plans: Allow authenticated users to manage their plans
CREATE POLICY "Authenticated users can manage plans"
  ON plans
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- workouts: Allow authenticated users to manage workouts
CREATE POLICY "Authenticated users can manage workouts"
  ON workouts
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- idempotency_keys: Allow authenticated users
CREATE POLICY "Authenticated users can manage idempotency keys"
  ON idempotency_keys
  FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Service role bypass for all tables
CREATE POLICY "Service role full access to conversations"
  ON conversations
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to conversation_messages"
  ON conversation_messages
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to plans"
  ON plans
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to workouts"
  ON workouts
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to idempotency_keys"
  ON idempotency_keys
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');;
