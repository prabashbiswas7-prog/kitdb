# KitDB — Full Deploy Guide
## Stack: Supabase (backend/DB/auth) + Cloudflare Pages (frontend) + GitHub 

---

## STEP 1 — Create Supabase Project (Free, unlimited users)

1. Go to **https://supabase.com** → Sign up free
2. Click **New Project** → name it `kitdb` → choose a region close to you → set a DB password
3. Wait ~2 minutes for project to spin up

### Run the database schema:
4. In Supabase dashboard → click **SQL Editor** → click **New Query**
5. Open `supabase/schema.sql` from this project
6. Paste the entire contents → click **Run**
7. You should see "Success" — all tables, policies and sample kits are created

### Get your API keys:
8. Go to **Settings → API** in Supabase
9. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## STEP 2 — Add your Supabase keys to the frontend

Open these files and replace `YOUR_SUPABASE_URL` and `YOUR_SUPABASE_ANON_KEY`:

- `frontend/assets/js/config.js`  ← public site
- `frontend/admin/index.html`     ← admin panel

Search for:
```
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

Replace with your actual values from Step 1.

---

## STEP 3 — Push to GitHub

1. Create a new GitHub repository (public or private)
2. In your project folder:
```bash
git init
git add .
git commit -m "Initial KitDB commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/kitdb.git
git push -u origin main
```

---

## STEP 4 — Deploy to Cloudflare Pages (Free, unlimited bandwidth)

1. Go to **https://pages.cloudflare.com** → Sign up / Log in
2. Click **Create a project** → **Connect to Git**
3. Select your GitHub repository
4. Build settings:
   - **Framework preset**: None
   - **Build command**: *(leave empty)*
   - **Build output directory**: `frontend`
5. Click **Save and Deploy**
6. In ~1 minute your site is live at `https://kitdb.pages.dev` (or custom domain)

### Custom domain (optional):
- In Cloudflare Pages → your project → **Custom domains** → Add domain
- Update your DNS to point to Cloudflare

---

## STEP 5 — Create your first Admin account

1. Visit your live site at `https://yoursite.pages.dev/admin/`
2. You'll see the admin login screen
3. First time only: since no admin exists yet, you need to:
   - Go to **Supabase → Authentication → Users → Invite user** (enter your email)
   - OR: Go to **Supabase → SQL Editor** and run:
     ```sql
     -- After you sign up via the normal site, run this to make yourself admin:
     UPDATE public.profiles
     SET role = 'admin'
     WHERE username = 'YOUR_USERNAME';
     ```
4. Once you're admin, use the Admin Panel to create additional admin accounts

---

## STEP 6 — Configure Email (for user signups)

Supabase free tier sends confirmation emails via their shared service (limited).
For production, set up a free SMTP sender:

1. Go to **Supabase → Authentication → SMTP Settings**
2. Use **Resend.com** (free 3,000 emails/month):
   - Sign up at resend.com → get API key
   - SMTP Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key
3. Save settings

---

## STEP 7 — Add Google AdSense (when ready)

1. Sign up at **https://adsense.google.com**
2. Get approved (site needs some content first)
3. In KitDB Admin → **Ad Slots**:
   - Paste your AdSense `<ins>` code into each slot
   - Toggle the slot ON
4. The ads appear automatically on the site

---

## FILE STRUCTURE

```
kitdb/
├── frontend/
│   ├── index.html          ← Homepage
│   ├── browse.html         ← Browse all kits
│   ├── kit.html            ← Kit detail page
│   ├── search.html         ← Search page
│   ├── login.html          ← Login & Signup
│   ├── profile.html        ← User profile
│   ├── admin/
│   │   └── index.html      ← SECRET Admin Panel
│   └── assets/
│       ├── css/style.css
│       └── js/config.js
└── supabase/
    └── schema.sql          ← Paste into Supabase SQL editor
```

---

## AD SLOTS REFERENCE

| Slot Key       | Where it appears                     |
|----------------|--------------------------------------|
| `top_banner`   | Top of every page                    |
| `browse_grid`  | Every 6 kit cards in Browse page     |
| `sidebar`      | Sidebar on Homepage + Browse         |
| `kit_detail`   | Below kit info on kit detail page    |
| `interstitial` | Full-screen modal after 6 page clicks|

---

## USER ROLES

| Role         | Can do                                           |
|--------------|--------------------------------------------------|
| `subscriber` | Browse, search, rate kits, save to collection   |
| `admin`      | Full admin panel access, manage all content     |

Subscribers sign up freely via the website.
Admins are created ONLY via the Admin Panel → Admin Accounts page.

---

## FREE TIER LIMITS (no credit card needed)

| Service           | Free Limit                         |
|-------------------|------------------------------------|
| Supabase          | 500MB DB, 1GB storage, unlimited users, 50,000 monthly active users |
| Cloudflare Pages  | Unlimited requests, 500 builds/month |
| GitHub            | Unlimited public/private repos      |

This stack is **completely free** and handles tens of thousands of users with no upgrade needed.

---

## UPDATING KITS

Go to `https://yoursite.pages.dev/admin/` → **Kit Manager**:
- **Add Kit** → fill in the form, paste image URL, add affiliate link
- **Edit** → update any kit details
- **Toggle Published/Draft** → hide kits without deleting
- **Toggle Featured** → control what appears on homepage

---

## QUESTIONS?

Check Supabase docs: https://supabase.com/docs
Check Cloudflare Pages docs: https://developers.cloudflare.com/pages
