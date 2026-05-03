#!/bin/bash
# Production Deployment Script for ChatVibe AI
# This script prepares and deploys the app to Vercel

set -e

echo "🚀 ChatVibe AI - Production Deployment"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo "📋 Step 1: Checking prerequisites..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

if ! command -v vercel &> /dev/null; then
    echo -e "${YELLOW}⚠️  Vercel CLI not found. Installing...${NC}"
    npm install -g vercel
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"
echo ""

# Step 2: Install dependencies
echo "📦 Step 2: Installing dependencies..."
npm install
echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# Step 3: Generate Prisma client
echo "🗄️  Step 3: Generating Prisma client..."
npx prisma generate
echo -e "${GREEN}✅ Prisma client generated${NC}"
echo ""

# Step 4: Run linting
echo "🔍 Step 4: Running linter..."
if npm run lint; then
    echo -e "${GREEN}✅ Linting passed${NC}"
else
    echo -e "${YELLOW}⚠️  Linting warnings (non-blocking)${NC}"
fi
echo ""

# Step 5: Run tests
echo "🧪 Step 5: Running tests..."
if npm test -- --passWithNoTests; then
    echo -e "${GREEN}✅ Tests passed${NC}"
else
    echo -e "${YELLOW}⚠️  Some tests failed (check output above)${NC}"
fi
echo ""

# Step 6: Build production bundle
echo "🏗️  Step 6: Building production bundle..."
if npm run build; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi
echo ""

# Step 7: Check environment variables
echo "🔐 Step 7: Checking environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "REDIS_URL"
    "GEMINI_API_KEY"
    "JWT_SECRET"
    "REFRESH_TOKEN_SECRET"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "FRONTEND_ORIGIN"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo -e "${YELLOW}⚠️  Make sure to set these in Vercel dashboard before deploying${NC}"
else
    echo -e "${GREEN}✅ All required environment variables are set${NC}"
fi
echo ""

# Step 8: Deploy to Vercel
echo "🚀 Step 8: Deploying to Vercel..."
echo ""
echo -e "${YELLOW}⚠️  Make sure you are logged in to Vercel:${NC}"
echo "   Run: vercel login"
echo ""
read -p "Press Enter to continue with deployment, or Ctrl+C to cancel..."

if vercel --prod; then
    echo ""
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Verify deployment in Vercel dashboard"
    echo "   2. Check health endpoint: https://your-domain.com/api/health"
    echo "   3. Test authentication flow"
    echo "   4. Test upload and analysis flow"
    echo "   5. Test billing flow"
    echo "   6. Configure Stripe webhooks"
    echo ""
else
    echo -e "${RED}❌ Deployment failed${NC}"
    exit 1
fi





























