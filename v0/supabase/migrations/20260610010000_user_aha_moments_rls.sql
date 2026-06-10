-- RLS for user_aha_moments (applied to prod 2026-06-10)
ALTER TABLE user_aha_moments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aha moments" ON user_aha_moments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own aha moments" ON user_aha_moments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own aha moments" ON user_aha_moments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
