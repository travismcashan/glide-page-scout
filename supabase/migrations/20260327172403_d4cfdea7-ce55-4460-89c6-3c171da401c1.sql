
CREATE TABLE public.oauth_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_email text,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_expires_at timestamptz,
  scopes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_email)
);

ALTER TABLE public.oauth_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to oauth_connections" ON public.oauth_connections
  FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_oauth_connections_updated_at
  BEFORE UPDATE ON public.oauth_connections
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
