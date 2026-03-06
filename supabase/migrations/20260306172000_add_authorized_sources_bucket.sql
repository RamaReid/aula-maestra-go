INSERT INTO storage.buckets (id, name, public)
VALUES ('authorized-sources', 'authorized-sources', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can read authorized sources files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'authorized-sources' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can upload authorized sources files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'authorized-sources' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update authorized sources files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'authorized-sources' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete authorized sources files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'authorized-sources' AND auth.role() = 'authenticated');
