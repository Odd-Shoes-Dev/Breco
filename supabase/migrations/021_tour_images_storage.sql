-- Create storage bucket for tour package images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tour-images', 'tour-images', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for tour-images bucket
CREATE POLICY "Authenticated users can upload tour images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'tour-images');

CREATE POLICY "Anyone can view tour images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tour-images');

CREATE POLICY "Authenticated users can update tour images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'tour-images');

CREATE POLICY "Authenticated users can delete tour images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'tour-images');
