import { createClient } from '@supabase/supabase-js';


// Initialize database client
const supabaseUrl = 'https://djotoapomhlavxknwsxw.databasepad.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ijk1MDg0NDA0LTIzYTgtNDFiMy1hZGY5LThkZjAxZGQ0YjFhZCJ9.eyJwcm9qZWN0SWQiOiJkam90b2Fwb21obGF2eGtud3N4dyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzc1NzQ5MjUzLCJleHAiOjIwOTExMDkyNTMsImlzcyI6ImZhbW91cy5kYXRhYmFzZXBhZCIsImF1ZCI6ImZhbW91cy5jbGllbnRzIn0.HX5KXmq66DJnKg2kXth1sVc41vcgMRxB04zyHRZLQ18';
const supabase = createClient(supabaseUrl, supabaseKey);


export { supabase };