-- Person A: Bugs Table
CREATE TABLE IF NOT EXISTS public.bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'new',
  priority VARCHAR NOT NULL,
  severity VARCHAR NOT NULL,
  component VARCHAR NOT NULL,
  
  -- Denormalizing names here to match the python fallback schema in `database.py` 
  -- and avoid complex joins with auth.users for a hackathon
  assignee_id UUID NULL,
  assignee_name VARCHAR NULL,
  reporter_id UUID NOT NULL,
  reporter_name VARCHAR NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Integrations columns (Person C/B might write to these later)
  github_issue_id VARCHAR NULL,
  github_issue_url VARCHAR NULL,
  ai_summary TEXT NULL,
  ai_summary_generated_at TIMESTAMP WITH TIME ZONE NULL
);

-- Person A: Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES public.bugs(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  user_id UUID NOT NULL,
  user_name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optional: Add indexes for better query performance on dashboard
CREATE INDEX IF NOT EXISTS idx_bugs_status ON public.bugs(status);
CREATE INDEX IF NOT EXISTS idx_bugs_assignee_id ON public.bugs(assignee_id);
CREATE INDEX IF NOT EXISTS idx_comments_bug_id ON public.comments(bug_id);
