INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true);

CREATE POLICY "Public read access for screenshots"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'screenshots');

CREATE POLICY "Allow uploads to screenshots bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'screenshots');