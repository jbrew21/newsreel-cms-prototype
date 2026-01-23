# NewsReel CMS

A modern, Strapi-like Content Management System for news editors built with Next.js, TypeScript, Supabase, and Tailwind CSS.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** (Auth, Database, Storage)
- **Tailwind CSS** + **shadcn/ui** for UI components

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Supabase account and project
- Authors table created in Supabase with `author_email` column

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

Create a `.env.local` file in the root directory:

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous/public key

You can find these in your Supabase project settings under API.

### 3. Set Up Supabase Database

Make sure you have the `authors` table created in your Supabase database:

```sql
create table public.authors (
  id uuid not null default gen_random_uuid (),
  author_first_name character varying(255) null,
  author_last_name character varying(255) null,
  author_bio text null,
  author_twitter character varying(255) null,
  author_linked_in character varying(255) null,
  author_email character varying(255) null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  published_at timestamp with time zone null,
  constraint authors_pkey primary key (id)
) TABLESPACE pg_default;
```

### 4. Configure Supabase Authentication

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** → **Providers**
3. Enable **Email** provider
4. Configure SMTP settings (if using custom SMTP) or use Supabase's default email service
5. Make sure **Enable email confirmations** is configured as needed

### 5. Add Test Author Data

Insert a test author in your Supabase database:

```sql
INSERT INTO public.authors (author_email, author_first_name, author_last_name)
VALUES ('your-email@example.com', 'Test', 'User');
```

Replace `your-email@example.com` with an email you can access for OTP testing.

### 6. Run the Development Server

```bash
npm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

## Testing the Login Flow

### Step 1: Access the Login Page

1. Open your browser and navigate to `http://localhost:3000`
2. You should see the NewsReel login page with:
   - Logo at the top
   - "Welcome to NewsReel!" heading
   - Email input field
   - Theme toggle button (moon/sun icon) in the top-right corner

### Step 2: Test Email Validation

1. Enter an email that **does NOT exist** in the `authors` table
2. Click "Send OTP"
3. You should see an error: "No account found with this email address."

### Step 3: Test OTP Sending

1. Enter an email that **exists** in the `authors` table (e.g., the test email you added)
2. Click "Send OTP"
3. You should see:
   - Loading state ("Sending OTP...")
   - Then transition to OTP verification screen
   - Message: "We've sent a code to [your-email]"

### Step 4: Check Your Email

1. Check the inbox of the email you entered
2. You should receive an email from Supabase with a 6-digit OTP code
3. The email subject will be something like "Your login code"

### Step 5: Verify OTP

1. Enter the 6-digit OTP code from your email
2. Click "Verify OTP"
3. On success, you should be redirected to `/dashboard`

### Step 6: Test Dashboard

1. You should see:
   - Header with "NewsReel CMS" title
   - Your email address displayed
   - Logout button
   - Empty dashboard content area

### Step 7: Test Logout

1. Click the "Logout" button
2. You should be redirected back to the login page (`/`)

### Step 8: Test Theme Toggle

1. Click the moon/sun icon in the top-right corner
2. The theme should switch between light and dark modes
3. All colors and text should adapt appropriately

## Troubleshooting

### OTP Email Not Received

1. Check your spam/junk folder
2. Verify Supabase email settings in the dashboard
3. Check Supabase logs for email delivery errors
4. Make sure the email exists in the `authors` table

### "No account found" Error

- Verify the email exists in the `authors` table
- Check that the `author_email` column has the correct value
- Try case-insensitive variations of the email

### Database Connection Issues

- Verify your `.env.local` file has correct Supabase credentials
- Check that your Supabase project is active
- Ensure Row Level Security (RLS) policies allow reading from `authors` table

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx         # Root layout with theme provider
│   ├── page.tsx           # Login page
│   ├── dashboard/         # Dashboard pages
│   └── globals.css        # Global styles & theme variables
├── components/            # React components
│   ├── auth/              # Authentication components
│   ├── theme/             # Theme system components
│   ├── brand/             # Branding components (Logo)
│   └── ui/                # shadcn/ui components
├── lib/                   # Utilities and configurations
│   ├── supabase/          # Supabase client & auth utilities
│   ├── theme.ts           # Theme utilities
│   └── utils.ts           # Utility functions
└── public/                # Static assets
    └── logo/              # Logo files
```

## Features

- 🔐 OTP-based authentication with Supabase
- 🎨 Modern, Strapi-inspired UI
- 🌓 Light/Dark theme support
- 📱 Responsive design
- 🚀 Enterprise-grade structure
- ♿ Accessible components
- 🔍 Email validation against authors table

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Next Steps

- Add more dashboard features
- Implement content management functionality
- Add user profile management
- Set up proper error boundaries
- Add loading states and animations