-- ============================================================
-- 🎆 Firework Wall — Supabase Database Schema
--
-- 用法：
--   1. 在 Supabase Dashboard → SQL Editor → New query
--   2. 粘贴本文件全部内容
--   3. 点击 Run（如出现 RLS 警告对话框，选 "Run and enable RLS"）
--
-- 前置条件：
--   - 已创建 Supabase 项目
--   - 已在 Authentication → Providers 启用 GitHub OAuth
-- ============================================================

-- 1. 烟花数据表
CREATE TABLE IF NOT EXISTS fireworks (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 10),
  color TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 索引（加速按用户查询和按时间排序）
CREATE INDEX IF NOT EXISTS idx_fireworks_user_id ON fireworks(user_id);
CREATE INDEX IF NOT EXISTS idx_fireworks_created_at ON fireworks(created_at DESC);

-- 3. 启用 Realtime（让 INSERT 事件能被前端实时订阅）
ALTER PUBLICATION supabase_realtime ADD TABLE fireworks;

-- 4. 启用 Row Level Security
ALTER TABLE fireworks ENABLE ROW LEVEL SECURITY;

-- 5. RLS 策略：任何人（含未登录）都能 SELECT
DROP POLICY IF EXISTS "anyone can read fireworks" ON fireworks;
CREATE POLICY "anyone can read fireworks"
  ON fireworks FOR SELECT
  USING (true);

-- 6. RLS 策略：仅登录用户能 INSERT，且 user_id 必须等于自己（防冒充）
DROP POLICY IF EXISTS "authenticated users can insert their own fireworks" ON fireworks;
CREATE POLICY "authenticated users can insert their own fireworks"
  ON fireworks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 7. RLS 策略：用户只能删除自己的烟花（撤回功能用，可选）
DROP POLICY IF EXISTS "users can delete their own fireworks" ON fireworks;
CREATE POLICY "users can delete their own fireworks"
  ON fireworks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- ✅ Schema 部署完成
--
-- 验证：
--   SELECT * FROM fireworks LIMIT 1;        -- 应返回空（表已就绪）
--   SELECT pg_get_publication_tables('supabase_realtime');  -- 应包含 fireworks
-- ============================================================
