#!/bin/bash
set -e

# FinManager deployment script for Beget VPS
# Usage: bash deploy.sh

APP_DIR="$HOME/finmanager"
REPO_URL="https://github.com/asg67/FinManager.git"

echo "=== FinManager Deployment ==="

# ---- 1. Check prerequisites ----
echo ""
echo "[1/7] Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing via nvm..."
    if ! command -v nvm &> /dev/null; then
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    fi
    nvm install 20
    nvm use 20
    nvm alias default 20
fi

if ! command -v pm2 &> /dev/null; then
    echo "Installing PM2..."
    npm install -g pm2
fi

echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  PM2: $(pm2 --version)"
echo "  Python: $(python3 --version)"

# ---- 2. Clone or pull repo ----
echo ""
echo "[2/7] Getting latest code..."

if [ -d "$APP_DIR" ]; then
    cd "$APP_DIR"
    git pull origin master
else
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# ---- 3. Install dependencies ----
echo ""
echo "[3/7] Installing Node.js dependencies..."
npm install

# ---- 4. Setup Python PDF service ----
echo ""
echo "[4/7] Setting up PDF service..."

cd "$APP_DIR/pdf-service"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd "$APP_DIR"

# ---- 5. Setup environment ----
echo ""
echo "[5/7] Checking environment..."

if [ ! -f ".env" ]; then
    echo "  Creating .env from template..."
    cp .env.production .env
    echo ""
    echo "  !!!! IMPORTANT: Edit .env with your actual values !!!!"
    echo "  nano $APP_DIR/.env"
    echo ""
    echo "  Required changes:"
    echo "    - DATABASE_URL (your PostgreSQL credentials)"
    echo "    - JWT_SECRET (generate with: openssl rand -hex 32)"
    echo ""
    read -p "  Press Enter after editing .env to continue..."
fi

# ---- 6. Database + Build ----
echo ""
echo "[6/7] Database migrations & client build..."

npx prisma generate
npx prisma migrate deploy
npm run build:client

# ---- 7. Start services ----
echo ""
echo "[7/7] Starting services..."

mkdir -p logs

pm2 stop ecosystem.config.cjs 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo ""
echo "=== Deployment complete ==="
echo ""
echo "Services status:"
pm2 status
echo ""
echo "Health check:"
sleep 2
curl -s http://localhost:3000/api/health | head -c 200
echo ""
echo ""
echo "Next steps:"
echo "  1. Configure Nginx: sudo cp deploy/nginx.conf /etc/nginx/sites-available/finmanager"
echo "  2. Edit the config: replace YOUR_DOMAIN_OR_IP and YOUR_USER"
echo "  3. Enable site: sudo ln -s /etc/nginx/sites-available/finmanager /etc/nginx/sites-enabled/"
echo "  4. Test & reload: sudo nginx -t && sudo systemctl reload nginx"
echo "  5. (Optional) Setup SSL: sudo certbot --nginx -d YOUR_DOMAIN"
echo "  6. PM2 startup: pm2 startup && pm2 save"
