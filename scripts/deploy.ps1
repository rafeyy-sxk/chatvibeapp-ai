# Production Deployment Script for ChatVibe AI (Windows PowerShell)
# This script prepares and deploys the app to Vercel

$ErrorActionPreference = "Stop"

Write-Host "🚀 ChatVibe AI - Production Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check prerequisites
Write-Host "📋 Step 1: Checking prerequisites..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js is not installed" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ npm is not installed" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "⚠️  Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

Write-Host "✅ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Step 2: Install dependencies
Write-Host "📦 Step 2: Installing dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Generate Prisma client
Write-Host "🗄️  Step 3: Generating Prisma client..." -ForegroundColor Yellow
npx prisma generate
Write-Host "✅ Prisma client generated" -ForegroundColor Green
Write-Host ""

# Step 4: Run linting
Write-Host "🔍 Step 4: Running linter..." -ForegroundColor Yellow
try {
    npm run lint
    Write-Host "✅ Linting passed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Linting warnings (non-blocking)" -ForegroundColor Yellow
}
Write-Host ""

# Step 5: Build production bundle
Write-Host "🏗️  Step 6: Building production bundle..." -ForegroundColor Yellow
try {
    npm run build
    Write-Host "✅ Build successful" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 6: Check environment variables
Write-Host "🔐 Step 7: Checking environment variables..." -ForegroundColor Yellow
$requiredVars = @(
    "DATABASE_URL",
    "REDIS_URL",
    "GEMINI_API_KEY",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "FRONTEND_ORIGIN"
)

$missingVars = @()
foreach ($var in $requiredVars) {
    if (-not [Environment]::GetEnvironmentVariable($var)) {
        $missingVars += $var
    }
}

if ($missingVars.Count -gt 0) {
    Write-Host "⚠️  Missing environment variables:" -ForegroundColor Yellow
    foreach ($var in $missingVars) {
        Write-Host "   - $var" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "⚠️  Make sure to set these in Vercel dashboard before deploying" -ForegroundColor Yellow
} else {
    Write-Host "✅ All required environment variables are set" -ForegroundColor Green
}
Write-Host ""

# Step 7: Deploy to Vercel
Write-Host "🚀 Step 8: Deploying to Vercel..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  Make sure you are logged in to Vercel:" -ForegroundColor Yellow
Write-Host "   Run: vercel login" -ForegroundColor Yellow
Write-Host ""
$response = Read-Host "Press Enter to continue with deployment, or Ctrl+C to cancel"

try {
    vercel --prod
    Write-Host ""
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Verify deployment in Vercel dashboard"
    Write-Host "   2. Check health endpoint: https://your-domain.com/api/health"
    Write-Host "   3. Test authentication flow"
    Write-Host "   4. Test upload and analysis flow"
    Write-Host "   5. Test billing flow"
    Write-Host "   6. Configure Stripe webhooks"
    Write-Host ""
} catch {
    Write-Host "❌ Deployment failed" -ForegroundColor Red
    exit 1
}





























