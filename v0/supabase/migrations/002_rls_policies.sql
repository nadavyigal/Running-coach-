-- Migration: Row Level Security Policies
-- Story 9.4 - Enable RLS and create owner-scoped policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Profiles policies
-- Users can only access their own profile
CREATE POLICY "Users can view own profile" ON profiles
    FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = auth_user_id);

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = auth_user_id);

-- Plans policies
-- Users can only access plans linked to their profile
CREATE POLICY "Users can view own plans" ON plans
    FOR SELECT USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own plans" ON plans
    FOR UPDATE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own plans" ON plans
    FOR INSERT WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own plans" ON plans
    FOR DELETE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

-- Workouts policies
-- Users can only access workouts from their plans
CREATE POLICY "Users can view own workouts" ON workouts
    FOR SELECT USING (
        plan_id IN (
            SELECT p.id FROM plans p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own workouts" ON workouts
    FOR UPDATE USING (
        plan_id IN (
            SELECT p.id FROM plans p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own workouts" ON workouts
    FOR INSERT WITH CHECK (
        plan_id IN (
            SELECT p.id FROM plans p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own workouts" ON workouts
    FOR DELETE USING (
        plan_id IN (
            SELECT p.id FROM plans p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

-- Conversations policies
-- Users can only access their own conversations
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own conversations" ON conversations
    FOR UPDATE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own conversations" ON conversations
    FOR INSERT WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own conversations" ON conversations
    FOR DELETE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

-- Conversation messages policies
-- Users can only access messages from their conversations
CREATE POLICY "Users can view own conversation messages" ON conversation_messages
    FOR SELECT USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN profiles p ON p.id = c.profile_id
            WHERE p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own conversation messages" ON conversation_messages
    FOR INSERT WITH CHECK (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN profiles p ON p.id = c.profile_id
            WHERE p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own conversation messages" ON conversation_messages
    FOR UPDATE USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN profiles p ON p.id = c.profile_id
            WHERE p.auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own conversation messages" ON conversation_messages
    FOR DELETE USING (
        conversation_id IN (
            SELECT c.id FROM conversations c
            JOIN profiles p ON p.id = c.profile_id
            WHERE p.auth_user_id = auth.uid()
        )
    );

-- Idempotency keys policies
-- Users can only access their own idempotency keys
CREATE POLICY "Users can view own idempotency keys" ON idempotency_keys
    FOR SELECT USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own idempotency keys" ON idempotency_keys
    FOR INSERT WITH CHECK (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own idempotency keys" ON idempotency_keys
    FOR UPDATE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own idempotency keys" ON idempotency_keys
    FOR DELETE USING (
        profile_id IN (
            SELECT id FROM profiles WHERE auth_user_id = auth.uid()
        )
    );