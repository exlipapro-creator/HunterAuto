import { readdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const localDesignsDir = resolve(projectRoot, 'node_modules', 'awesome-design-md', 'design-md');

const LABELS = {
  airbnb: 'Airbnb',
  airtable: 'Airtable',
  apple: 'Apple',
  binance: 'Binance',
  'bmw-m': 'BMW M',
  bmw: 'BMW',
  bugatti: 'Bugatti',
  cal: 'Cal.com',
  claude: 'Claude',
  clay: 'Clay',
  clickhouse: 'ClickHouse',
  cohere: 'Cohere',
  coinbase: 'Coinbase',
  composio: 'Composio',
  cursor: 'Cursor',
  'dell-1996': 'Dell (1996)',
  elevenlabs: 'ElevenLabs',
  expo: 'Expo',
  ferrari: 'Ferrari',
  figma: 'Figma',
  framer: 'Framer',
  hashicorp: 'HashiCorp',
  hp: 'HP',
  ibm: 'IBM',
  intercom: 'Intercom',
  kraken: 'Kraken',
  lamborghini: 'Lamborghini',
  'linear.app': 'Linear',
  lovable: 'Lovable',
  mastercard: 'Mastercard',
  meta: 'Meta',
  minimax: 'Minimax',
  mintlify: 'Mintlify',
  miro: 'Miro',
  'mistral.ai': 'Mistral AI',
  mongodb: 'MongoDB',
  nike: 'Nike',
  'nintendo-2001': 'Nintendo (2001)',
  notion: 'Notion',
  nvidia: 'NVIDIA',
  ollama: 'Ollama',
  'opencode.ai': 'OpenCode AI',
  pinterest: 'Pinterest',
  playstation: 'PlayStation',
  posthog: 'PostHog',
  raycast: 'Raycast',
  renault: 'Renault',
  replicate: 'Replicate',
  resend: 'Resend',
  revolut: 'Revolut',
  runwayml: 'RunwayML',
  sanity: 'Sanity',
  sentry: 'Sentry',
  shopify: 'Shopify',
  slack: 'Slack',
  spacex: 'SpaceX',
  spotify: 'Spotify',
  starbucks: 'Starbucks',
  stripe: 'Stripe',
  supabase: 'Supabase',
  superhuman: 'Superhuman',
  tesla: 'Tesla',
  theverge: 'The Verge',
  'together.ai': 'Together AI',
  uber: 'Uber',
  vercel: 'Vercel',
  vodafone: 'Vodafone',
  voltagent: 'VoltAgent',
  warp: 'Warp',
  webflow: 'Webflow',
  wired: 'WIRED',
  wise: 'Wise',
  'x.ai': 'xAI',
  zapier: 'Zapier',
};

export async function getAvailablePresets() {
  const presets = new Set();
  if (existsSync(localDesignsDir)) {
    const entries = await readdir(localDesignsDir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory()) {
        presets.add(ent.name);
      }
    }
  }
  for (const key of Object.keys(LABELS)) {
    presets.add(key);
  }
  return Array.from(presets).sort();
}

export async function applyPreset(name) {
  const targetPath = join(projectRoot, 'DESIGN.md');
  const localSrc = join(localDesignsDir, name, 'DESIGN.md');

  if (existsSync(localSrc)) {
    await copyFile(localSrc, targetPath);
    console.log(`Successfully applied ${LABELS[name] || name} to DESIGN.md`);
    return true;
  }

  // Fallback to fetch from VoltAgent repo
  console.log(`Local file not found for "${name}", fetching from GitHub...`);
  const url = `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/${name}/DESIGN.md`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download design for ${name}: HTTP ${res.status}`);
  }
  const text = await res.text();
  await writeFile(targetPath, text, 'utf-8');
  console.log(`Successfully downloaded and applied ${LABELS[name] || name} to DESIGN.md`);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  switch (command) {
    case 'list': {
      const presets = await getAvailablePresets();
      console.log(`Available design systems (${presets.length}):`);
      for (const p of presets) {
        console.log(`  - ${p.padEnd(20)} (${LABELS[p] || p})`);
      }
      break;
    }
    case 'use':
    case 'apply': {
      const target = args[1];
      if (!target) {
        console.error('Usage: npm run design use <name>');
        process.exit(1);
      }
      await applyPreset(target);
      break;
    }
    case 'current': {
      const p = join(projectRoot, 'DESIGN.md');
      if (!existsSync(p)) {
        console.log('No DESIGN.md currently installed in project root.');
      } else {
        const content = await readFile(p, 'utf-8');
        const lines = content.split('\n').slice(0, 20);
        console.log('Current DESIGN.md header:\n');
        console.log(lines.join('\n'));
      }
      break;
    }
    default: {
      console.log(`awesome-design-md manager
Commands:
  node scripts/design.mjs list            List all 70+ available design systems
  node scripts/design.mjs use <name>      Apply a design system to ./DESIGN.md
  node scripts/design.mjs current         Show current DESIGN.md info
`);
    }
  }
}

// Run CLI when invoked directly
if (process.argv[1] === __filename) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
