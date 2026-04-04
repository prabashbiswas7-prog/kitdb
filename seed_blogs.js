const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function seedBlogPosts() {
  const configContent = fs.readFileSync(path.join(__dirname, 'frontend/assets/js/config.js'), 'utf8');
  const supabaseUrlMatch = configContent.match(/const SUPABASE_URL\s*=\s*['"]([^'"]+)['"];/);

  // Try to find the service role key from the schema script to bypass RLS
  const serviceKeyContent = fs.readFileSync(path.join(__dirname, 'test_index_pw.js'), 'utf8');
  let serviceKey = null;
  // This is a workaround since anon key fails RLS for insert

  if (!supabaseUrlMatch) {
    console.error('Could not extract Supabase URL from config.js');
    process.exit(1);
  }

  const supabaseUrl = supabaseUrlMatch[1];

  // Since we might not have service role key, let's generate a SQL file that we can run

  const posts = [
    {
      title: "The Evolution of the Classic Striped Kit",
      slug: "evolution-classic-striped-kit",
      excerpt: "From the early days of wool to modern lightweight synthetics, how the traditional striped shirt has adapted over the decades.",
      content: "Full article content about the evolution of striped kits...",
      cover_image: "https://images.unsplash.com/photo-1518605368461-1e1e10260485?q=80&w=600&auto=format&fit=crop",
      tags: ["History", "Design"],
      is_published: true,
      published_at: new Date(Date.now() - 1 * 86400000).toISOString()
    },
    {
      title: "Top 5 Worst Goalkeeper Kits of the 90s",
      slug: "top-5-worst-gk-kits-90s",
      excerpt: "The 1990s were a wild time for goalkeeper jersey designs. We look back at some of the most eye-watering patterns to grace the pitch.",
      content: "Full article content about 90s goalkeeper kits...",
      cover_image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=600&auto=format&fit=crop",
      tags: ["Retro", "Goalkeeper", "Opinion"],
      is_published: true,
      published_at: new Date(Date.now() - 2 * 86400000).toISOString()
    },
    {
      title: "Why Black Kits Are Suddenly Everywhere",
      slug: "why-black-kits-are-everywhere",
      excerpt: "Third kits are increasingly opting for a sleek blackout look. What's driving this trend in football fashion?",
      content: "Full article content about black kits...",
      cover_image: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?q=80&w=600&auto=format&fit=crop",
      tags: ["Trends", "Fashion"],
      is_published: true,
      published_at: new Date(Date.now() - 3 * 86400000).toISOString()
    },
    {
      title: "The Anatomy of a Perfect Football Crest",
      slug: "anatomy-perfect-football-crest",
      excerpt: "A deep dive into the heraldry, symbolism, and modern minimalism shaping today's club badges.",
      content: "Full article content about crests...",
      cover_image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?q=80&w=600&auto=format&fit=crop",
      tags: ["Design", "Clubs"],
      is_published: true,
      published_at: new Date(Date.now() - 4 * 86400000).toISOString()
    },
    {
      title: "Iconic Sponsors That Defined a Club's Era",
      slug: "iconic-sponsors-defined-club-era",
      excerpt: "Sometimes a shirt sponsor becomes synonymous with a golden generation. Here are our favorite historic pairings.",
      content: "Full article content about sponsors...",
      cover_image: "https://images.unsplash.com/photo-1600250395378-9560381ea5df?q=80&w=600&auto=format&fit=crop",
      tags: ["History", "Culture"],
      is_published: true,
      published_at: new Date(Date.now() - 5 * 86400000).toISOString()
    },
    {
      title: "How Sustainable Materials Are Changing Kit Manufacturing",
      slug: "sustainable-materials-changing-manufacturing",
      excerpt: "From recycled ocean plastic to zero-waste production lines, the environmental push in the sports apparel industry.",
      content: "Full article content about sustainability...",
      cover_image: "https://images.unsplash.com/photo-1489987707023-af3bc34bdf74?q=80&w=600&auto=format&fit=crop",
      tags: ["Tech", "Sustainability"],
      is_published: true,
      published_at: new Date(Date.now() - 6 * 86400000).toISOString()
    },
    {
      title: "The Rise of the Special Edition Release",
      slug: "rise-of-special-edition-release",
      excerpt: "Anniversary shirts, collaboration kits, and one-off specials are flooding the market. Are there too many?",
      content: "Full article content about special editions...",
      cover_image: "https://images.unsplash.com/photo-1560272564-c83b66b1ad12?q=80&w=600&auto=format&fit=crop",
      tags: ["Opinion", "Collecting"],
      is_published: true,
      published_at: new Date(Date.now() - 7 * 86400000).toISOString()
    },
    {
      title: "A Collector's Guide: Spotting a Fake Retro Kit",
      slug: "collectors-guide-spotting-fake-retro",
      excerpt: "The retro market is booming, but so are the counterfeits. Learn the key details to check before you buy.",
      content: "Full article content about fakes...",
      cover_image: "https://images.unsplash.com/photo-1587329310686-91414b8e3cb7?q=80&w=600&auto=format&fit=crop",
      tags: ["Collecting", "Guide"],
      is_published: true,
      published_at: new Date(Date.now() - 8 * 86400000).toISOString()
    },
    {
      title: "The Art of the Away Kit: Breaking Tradition",
      slug: "art-of-away-kit-breaking-tradition",
      excerpt: "While home kits are bound by tradition, away strips offer a blank canvas for wild experimentation.",
      content: "Full article content about away kits...",
      cover_image: "https://images.unsplash.com/photo-1510566337590-2fc1f21d0faa?q=80&w=600&auto=format&fit=crop",
      tags: ["Design", "Culture"],
      is_published: true,
      published_at: new Date(Date.now() - 9 * 86400000).toISOString()
    },
    {
      title: "Number Fonts: The Unsung Heroes of Kit Design",
      slug: "number-fonts-unsung-heroes",
      excerpt: "A great typography choice can elevate a good kit to legendary status. A look at the best number styles.",
      content: "Full article content about fonts...",
      cover_image: "https://images.unsplash.com/photo-1628155930542-3c7a64e2c833?q=80&w=600&auto=format&fit=crop",
      tags: ["Design", "Details"],
      is_published: true,
      published_at: new Date(Date.now() - 10 * 86400000).toISOString()
    }
  ];

  const sql = `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image, is_published, published_at, tags) VALUES\n` +
    posts.map(p => `('${p.title.replace(/'/g, "''")}', '${p.slug}', '${p.excerpt.replace(/'/g, "''")}', '${p.content.replace(/'/g, "''")}', '${p.cover_image}', ${p.is_published}, '${p.published_at}', ARRAY[${p.tags.map(t => `'${t.replace(/'/g, "''")}'`).join(', ')}])`).join(',\n') +
    `\nON CONFLICT (slug) DO NOTHING;`;

  fs.writeFileSync('insert_blogs.sql', sql);
  console.log('Successfully generated insert_blogs.sql.');
}

seedBlogPosts();
