import { DesignPreset } from '../types';

export const DESIGN_PRESETS: DesignPreset[] = [
  // Developer Tools
  {
    id: 'linear.app',
    name: 'Linear',
    category: 'Developer Tools',
    accentColor: '#5e6ad2',
    canvasType: 'dark',
    description: 'Near-black product-focused canvas (#08090a), ultra-thin borders, and signature indigo-violet accent.',
    tags: ['Dark Mode', 'Engineered', 'Precision']
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'Developer Tools',
    accentColor: '#0070f3',
    canvasType: 'dark',
    description: 'High-contrast monochrome foundations, razor-sharp geometric lines, and iconic triangle minimalism.',
    tags: ['Monochrome', 'Geist', 'Next.js']
  },
  {
    id: 'supabase',
    name: 'Supabase',
    category: 'Developer Tools',
    accentColor: '#3ecf8e',
    canvasType: 'dark',
    description: 'Deep slate darkness with high-energy emerald green accents, developer-focused technical density.',
    tags: ['Emerald Green', 'Database', 'Technical']
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'Developer Tools',
    accentColor: '#ffffff',
    canvasType: 'dark',
    description: 'Minimal dark canvas, subtle monospace accents, whisper-quiet luminance hierarchy.',
    tags: ['Minimalist', 'Monospace', 'Developer API']
  },
  {
    id: 'mintlify',
    name: 'Mintlify',
    category: 'Developer Tools',
    accentColor: '#0c8f5c',
    canvasType: 'dark',
    description: 'Documentation platform style with clean green accents, reader-optimized hierarchy.',
    tags: ['Docs', 'Legibility', 'Green']
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'Developer Tools',
    accentColor: '#7a52f4',
    canvasType: 'dark',
    description: 'Observability aesthetic with vibrant purple brand cues, diagnostic tables, and status indicators.',
    tags: ['Monitoring', 'Purple', 'Data Dense']
  },
  {
    id: 'posthog',
    name: 'PostHog',
    category: 'Developer Tools',
    accentColor: '#f54e00',
    canvasType: 'dark',
    description: 'Playful yet authoritative developer analytics with signature warm hedge-orange accent.',
    tags: ['Analytics', 'Orange', 'Quirky Dev']
  },
  {
    id: 'raycast',
    name: 'Raycast',
    category: 'Developer Tools',
    accentColor: '#ff6363',
    canvasType: 'dark',
    description: 'Command palette precision, hotkey badges, compact padding, and poppy coral-red.',
    tags: ['Launcher', 'Fast', 'Command Line']
  },

  // AI & LLM Platforms
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    category: 'AI & LLM',
    accentColor: '#d97706',
    canvasType: 'light',
    description: 'Warm terracotta tones, humanistic serif headings, serene editorial readability.',
    tags: ['Warm Paper', 'Serif', 'Humanist']
  },
  {
    id: 'cursor',
    name: 'Cursor',
    category: 'AI & LLM',
    accentColor: '#7c3aed',
    canvasType: 'dark',
    description: 'Code-editor glow, deep obsidian surfaces, and AI generation status tokens.',
    tags: ['Code Editor', 'AI Coding', 'Violet']
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    category: 'AI & LLM',
    accentColor: '#000000',
    canvasType: 'light',
    description: 'High-contrast monochrome typography, waveform visualizers, clean studio surfaces.',
    tags: ['Voice AI', 'Audio', 'Studio']
  },
  {
    id: 'mistral.ai',
    name: 'Mistral AI',
    category: 'AI & LLM',
    accentColor: '#ff7000',
    canvasType: 'dark',
    description: 'Retro pixelated aesthetics blended with French modernism and energetic warm flame-orange.',
    tags: ['Orange', 'Pixel Accents', 'Frontier AI']
  },
  {
    id: 'replicate',
    name: 'Replicate',
    category: 'AI & LLM',
    accentColor: '#000000',
    canvasType: 'light',
    description: 'Raw developer terminal feel, monospaced prompts, high-contrast API run logs.',
    tags: ['Terminal', 'Monochrome', 'Cloud API']
  },
  {
    id: 'runwayml',
    name: 'Runway',
    category: 'AI & LLM',
    accentColor: '#10b981',
    canvasType: 'dark',
    description: 'Cinematic video canvas, dark gallery containers, and glowing render timelines.',
    tags: ['Video AI', 'Cinematic', 'Creative']
  },
  {
    id: 'x.ai',
    name: 'xAI (Grok)',
    category: 'AI & LLM',
    accentColor: '#ffffff',
    canvasType: 'dark',
    description: 'Stark black-and-white minimalist canvas, raw typography, cosmic science aesthetic.',
    tags: ['Cosmic', 'Stark', 'High Contrast']
  },

  // Fintech & Crypto
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'Fintech & Crypto',
    accentColor: '#635bff',
    canvasType: 'light',
    description: 'The golden standard of fintech design: weight-300 elegance, subtle purple hues, pristine cards.',
    tags: ['Fintech Icon', 'Weight 300', 'Polished']
  },
  {
    id: 'wise',
    name: 'Wise',
    category: 'Fintech & Crypto',
    accentColor: '#2ed06e',
    canvasType: 'light',
    description: 'Electric lime green confidence, bold sans-serif numbers, hyper-transparent currency tables.',
    tags: ['Lime Green', 'Currency', 'High Contrast']
  },
  {
    id: 'revolut',
    name: 'Revolut',
    category: 'Fintech & Crypto',
    accentColor: '#0075eb',
    canvasType: 'dark',
    description: 'Neobank dark mode, neon gradient payment cards, ultra-smooth financial metrics.',
    tags: ['Neobank', 'Electric Blue', 'Glass Touch']
  },
  {
    id: 'coinbase',
    name: 'Coinbase',
    category: 'Fintech & Crypto',
    accentColor: '#0052ff',
    canvasType: 'light',
    description: 'Institutional trust blue, spacious financial charts, clear regulatory clarity.',
    tags: ['Trust Blue', 'Exchange', 'Clean']
  },

  // Design & Productivity
  {
    id: 'figma',
    name: 'Figma',
    category: 'Design & Productivity',
    accentColor: '#0d99ff',
    canvasType: 'light',
    description: 'Vibrant multi-accent palette, vector bounding boxes, playful yet structured canvas.',
    tags: ['Vector', 'Multi-color', 'Collaborative']
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'Design & Productivity',
    accentColor: '#2f3437',
    canvasType: 'light',
    description: 'Warm off-white paper canvas, serif display headings, quiet dividers, thoughtful minimalism.',
    tags: ['Warm Paper', 'Serif', 'Workspace']
  },
  {
    id: 'framer',
    name: 'Framer',
    category: 'Design & Productivity',
    accentColor: '#0055ff',
    canvasType: 'dark',
    description: 'Motion-first layout, rich dark glass surfaces, bold electric blue actions.',
    tags: ['Motion', 'Electric Blue', 'Web Design']
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'Design & Productivity',
    accentColor: '#fcb400',
    canvasType: 'light',
    description: 'Database color categorization, cheerful pills, accessible table rows.',
    tags: ['Tables', 'Color Badges', 'Productivity']
  },
  {
    id: 'cal',
    name: 'Cal.com',
    category: 'Design & Productivity',
    accentColor: '#111827',
    canvasType: 'light',
    description: 'Clean scheduling calendar grid, soft card borders, minimalist booking flows.',
    tags: ['Scheduling', 'Clean Grid', 'Modern']
  },

  // Consumer & Media
  {
    id: 'apple',
    name: 'Apple',
    category: 'Consumer & Media',
    accentColor: '#0071e3',
    canvasType: 'light',
    description: 'Expansive negative space, SF Pro typography, cinematic hardware showcases, deliberate luxury.',
    tags: ['Negative Space', 'SF Pro', 'Editorial']
  },
  {
    id: 'airbnb',
    name: 'Airbnb',
    category: 'Consumer & Media',
    accentColor: '#ff385c',
    canvasType: 'light',
    description: 'Warm coral accent, rounded pill search bars, friendly travel hospitality aesthetic.',
    tags: ['Coral', 'Pill Buttons', 'Hospitality']
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'Consumer & Media',
    accentColor: '#1ed760',
    canvasType: 'dark',
    description: 'True black canvas (#121212), radioactive green playback controls, album tile grids.',
    tags: ['Music', 'Spotify Green', 'Card Tiles']
  },
  {
    id: 'theverge',
    name: 'The Verge',
    category: 'Consumer & Media',
    accentColor: '#e0fe00',
    canvasType: 'dark',
    description: 'Cyberpunk acid yellow and hyper-violet, heavy display type, magazine editorial layout.',
    tags: ['Acid Lime', 'Editorial', 'Bold Display']
  },
  {
    id: 'tesla',
    name: 'Tesla',
    category: 'Consumer & Media',
    accentColor: '#e82127',
    canvasType: 'dark',
    description: 'Radical reductionism, ultra-wide viewport layouts, crisp automotive typography.',
    tags: ['Minimalist', 'Full Bleed', 'Automotive Tech']
  },

  // Retro & Nostalgia
  {
    id: 'dell-1996',
    name: 'Dell (1996)',
    category: 'Retro & Nostalgia',
    accentColor: '#000080',
    canvasType: 'light',
    description: 'Classic catalog web: navy banner, beveled ribbon cards, Times Roman and Helvetica.',
    tags: ['90s Web', 'Bevels', 'Vintage']
  },
  {
    id: 'nintendo-2001',
    name: 'Nintendo (2001)',
    category: 'Retro & Nostalgia',
    accentColor: '#e60012',
    canvasType: 'dark',
    description: 'Y2K console chrome, brushed periwinkle panels, glowing amber circuit boards.',
    tags: ['Y2K', 'Chrome', 'Retro Gaming']
  }
];
