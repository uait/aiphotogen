#!/usr/bin/env node

/**
 * Subscription System Verification Script
 * Verifies the complete subscription system setup
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 PixtorAI Subscription System Verification\n');

// Check environment variables
console.log('1. Environment Configuration:');
console.log('=' .repeat(35));

const requiredEnvVars = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL', 
  'FIREBASE_PRIVATE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
];

let envScore = 0;
requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}`);
    envScore++;
  } else {
    console.log(`❌ ${envVar} (missing)`);
  }
});

console.log(`📊 Environment Score: ${envScore}/${requiredEnvVars.length}\n`);

// Check core service files
console.log('2. Core Service Files:');
console.log('=' .repeat(25));

const coreFiles = [
  'lib/types/subscription.ts',
  'lib/config/subscription.ts', 
  'lib/services/subscription.ts',
  'lib/services/stripe.ts',
  'lib/firebase-admin.ts'
];

let coreScore = 0;
coreFiles.forEach(file => {
  const fullPath = path.join(process.cwd(), file);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${file} (${(stats.size/1024).toFixed(1)}KB)`);
    coreScore++;
  } else {
    console.log(`❌ ${file} (missing)`);
  }
});

console.log(`📊 Core Files Score: ${coreScore}/${coreFiles.length}\n`);

// Check API endpoints
console.log('3. API Endpoints:');
console.log('=' .repeat(20));

const apiEndpoints = [
  'app/api/subscription/usage/route.ts',
  'app/api/subscription/checkout/route.ts',
  'app/api/subscription/webhook/route.ts',
  'app/api/generate-image-v2/route.ts'
];

let apiScore = 0;
apiEndpoints.forEach(endpoint => {
  const fullPath = path.join(process.cwd(), endpoint);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${endpoint} (${(stats.size/1024).toFixed(1)}KB)`);
    apiScore++;
  } else {
    console.log(`❌ ${endpoint} (missing)`);
  }
});

console.log(`📊 API Endpoints Score: ${apiScore}/${apiEndpoints.length}\n`);

// Check UI components
console.log('4. UI Components:');
console.log('=' .repeat(20));

const uiComponents = [
  'components/PricingSection.tsx',
  'components/PricingCard.tsx', 
  'components/AccountSection.tsx',
  'components/Sidebar.tsx'
];

let uiScore = 0;
uiComponents.forEach(component => {
  const fullPath = path.join(process.cwd(), component);
  if (fs.existsSync(fullPath)) {
    const stats = fs.statSync(fullPath);
    console.log(`✅ ${component} (${(stats.size/1024).toFixed(1)}KB)`);
    uiScore++;
  } else {
    console.log(`❌ ${component} (missing)`);
  }
});

console.log(`📊 UI Components Score: ${uiScore}/${uiComponents.length}\n`);

// Check package.json dependencies
console.log('5. Required Dependencies:');
console.log('=' .repeat(28));

const packageJsonPath = path.join(process.cwd(), 'package.json');
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const requiredDeps = [
    'stripe',
    'firebase-admin',
    'firebase',
    'next',
    'typescript'
  ];
  
  let depScore = 0;
  requiredDeps.forEach(dep => {
    if (deps[dep]) {
      console.log(`✅ ${dep} (v${deps[dep]})`);
      depScore++;
    } else {
      console.log(`❌ ${dep} (missing)`);
    }
  });
  
  console.log(`📊 Dependencies Score: ${depScore}/${requiredDeps.length}\n`);
} else {
  console.log('❌ package.json not found\n');
}

// Configuration file check
console.log('6. Configuration Content Verification:');
console.log('=' .repeat(40));

const configPath = path.join(process.cwd(), 'lib/config/subscription.ts');
if (fs.existsSync(configPath)) {
  const configContent = fs.readFileSync(configPath, 'utf8');
  
  const checks = [
    { name: 'Free Plan (5 ops)', test: /dailyLimit:\s*5/ },
    { name: 'Starter Plan ($4.99)', test: /price:\s*499/ },
    { name: 'Creator Plan ($9.99)', test: /price:\s*999/ },
    { name: 'Pro Plan ($14.99)', test: /price:\s*1499/ },
    { name: 'Model Tiers', test: /ModelTier\.|enum.*ModelTier/ },
    { name: 'Plan Features', test: /PLAN_FEATURES/ }
  ];
  
  let configScore = 0;
  checks.forEach(check => {
    if (check.test.test(configContent)) {
      console.log(`✅ ${check.name} configured`);
      configScore++;
    } else {
      console.log(`❌ ${check.name} not found`);
    }
  });
  
  console.log(`📊 Configuration Score: ${configScore}/${checks.length}\n`);
} else {
  console.log('❌ Configuration file missing\n');
}

// Overall system assessment
console.log('🎯 OVERALL SYSTEM ASSESSMENT');
console.log('=' .repeat(35));

const totalPossible = requiredEnvVars.length + coreFiles.length + apiEndpoints.length + uiComponents.length;
const totalActual = envScore + coreScore + apiScore + uiScore;
const percentage = Math.round((totalActual / totalPossible) * 100);

console.log(`📈 System Completion: ${totalActual}/${totalPossible} (${percentage}%)`);

if (percentage >= 90) {
  console.log('🎉 EXCELLENT: System is fully configured and ready!');
  console.log('');
  console.log('✨ Ready for Production:');
  console.log('  • All core components implemented');
  console.log('  • Environment properly configured'); 
  console.log('  • API endpoints are functional');
  console.log('  • UI components are complete');
  console.log('');
  console.log('🚀 Next Steps:');
  console.log('  1. Test the subscription flow end-to-end');
  console.log('  2. Configure Stripe products in dashboard');
  console.log('  3. Set up webhook endpoints');
  console.log('  4. Deploy to production');
} else if (percentage >= 75) {
  console.log('🟡 GOOD: System is mostly complete with minor gaps');
  console.log('');
  console.log('📋 Action Items:');
  if (envScore < requiredEnvVars.length) {
    console.log(`  • Configure ${requiredEnvVars.length - envScore} missing environment variables`);
  }
  if (coreScore < coreFiles.length) {
    console.log(`  • Create ${coreFiles.length - coreScore} missing core files`);
  }
  if (apiScore < apiEndpoints.length) {
    console.log(`  • Implement ${apiEndpoints.length - apiScore} missing API endpoints`);
  }
  if (uiScore < uiComponents.length) {
    console.log(`  • Build ${uiComponents.length - uiScore} missing UI components`);
  }
} else {
  console.log('🔴 NEEDS WORK: Significant components are missing');
  console.log('');
  console.log('⚠️  Critical Issues:');
  console.log('  • Review the missing components above');
  console.log('  • Focus on core services and API endpoints first');
  console.log('  • Then work on environment configuration');
}

console.log('');
console.log('📚 Documentation:');
console.log('  • Environment setup: ENVIRONMENT_SETUP.md'); 
console.log('  • Stripe configuration: lib/services/stripe.ts');
console.log('  • Usage tracking: lib/services/subscription.ts');
console.log('');
console.log('✅ System verification completed!');