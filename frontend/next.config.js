/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  output: 'export',
  distDir: 'out',
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://sayjajeatdrcejexxrih.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNheWphamVhdGRyY2VqZXh4cmloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjQ5NjIyOTksImV4cCI6MjA0MDUzODI5OX0.JfxTJKZHKnDnL4fJfLI5jISRAhpRfkV2lQ2zTxCrPFY',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '/.netlify/functions',
  },
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig