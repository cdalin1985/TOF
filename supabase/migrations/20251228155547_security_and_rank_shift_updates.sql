-- Recovered from Supabase migration history (version 20251228155547).
-- Source: supabase_migrations.schema_migrations
-- Name: security_and_rank_shift_updates

-- 1. Create the Rank Shift RPC
CREATE OR REPLACE FUNCTION public.handle_rank_shift(
    challenger_id UUID,
    target_rank INT,
    old_rank INT
)
RETURNS VOID AS $$
BEGIN
    -- Move everyone in the middle down by 1
    UPDATE public.profiles
    SET rank = rank + 1
    WHERE rank >= target_rank AND rank < old_rank;

    -- Set the challenger to the new rank
    UPDATE public.profiles
    SET rank = target_rank
    WHERE id = challenger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Update RLS Policies
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

-- Matches
DROP POLICY IF EXISTS "Public matches are viewable by everyone." ON public.matches;
CREATE POLICY "Everyone can see matches"
  ON public.matches FOR SELECT
  USING ( true );

CREATE POLICY "Challengers can insert matches"
  ON public.matches FOR INSERT
  WITH CHECK ( auth.uid() = challenger_id );

CREATE POLICY "Participants can update their matches"
  ON public.matches FOR UPDATE
  USING ( auth.uid() = challenger_id OR auth.uid() = opponent_id );

-- Comments
DROP POLICY IF EXISTS "Everyone can read comments" ON public.comments;
CREATE POLICY "Everyone can read comments"
  ON public.comments FOR SELECT
  USING ( true );

CREATE POLICY "Authenticated users can post comments"
  ON public.comments FOR INSERT
  WITH CHECK ( auth.role() = 'authenticated' );
