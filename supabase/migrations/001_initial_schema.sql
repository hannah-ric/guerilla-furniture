-- migrations/001_initial_schema.sql
CREATE TABLE build_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  furniture_type TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  materials JSONB NOT NULL,
  plan_data JSONB NOT NULL,
  model_url TEXT,
  validation_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  build_plan_id UUID REFERENCES build_plans(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE build_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can CRUD own plans" ON build_plans
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own chats" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id);