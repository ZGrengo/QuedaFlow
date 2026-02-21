// Script to set environment variables from .env file
// Usage: node scripts/set-env.js
// This creates a temporary environment file that Angular can use

const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
} else if (fs.existsSync(envExamplePath)) {
  console.warn('⚠️  .env file not found, using .env.example');
  envContent = fs.readFileSync(envExamplePath, 'utf8');
} else {
  console.warn('⚠️  No .env file found. Using empty values.');
  console.warn('   Please create a .env file with your Supabase credentials.');
  console.warn('   See .env.example for reference.');
}

// Parse .env file
const envVars = {};
envContent.split('\n').forEach(line => {
  line = line.trim();
  if (line && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      envVars[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
});

// Generate environment.ts file
const envTsContent = `// Auto-generated from .env file
// Do not edit manually - run 'node scripts/set-env.js' to regenerate

export const environment = {
  production: false,
  supabaseUrl: '${envVars.NG_APP_SUPABASE_URL || ''}',
  supabaseAnonKey: '${envVars.NG_APP_SUPABASE_ANON_KEY || ''}'
};
`;

const outputPath = path.join(__dirname, '..', 'src', 'environments', 'environment.ts');
fs.writeFileSync(outputPath, envTsContent, 'utf8');

console.log('✅ Environment file generated successfully!');
console.log(`   Supabase URL: ${envVars.NG_APP_SUPABASE_URL ? '✓ Set' : '✗ Missing'}`);
console.log(`   Supabase Key: ${envVars.NG_APP_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}`);

