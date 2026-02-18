#!/bin/bash
set -e
exec > /tmp/deploy.log 2>&1

echo "=== Deploy started ==="
cd /root/finmanager

echo "--- Git pull ---"
git pull origin master

echo "--- NPM install ---"
npm install --legacy-peer-deps

echo "--- Build ---"
npm run build

echo "--- Prisma migrate ---"
npx prisma migrate deploy

echo "--- PM2 restart ---"
pm2 restart finmanager-api

echo "--- Clean database ---"
npx prisma db execute --schema prisma/schema.prisma --stdin <<SQL
DELETE FROM "DdsOperation";
DELETE FROM "DdsTemplate";
DELETE FROM "BankTransaction";
DELETE FROM "ExpenseArticle";
DELETE FROM "ExpenseType";
DELETE FROM "Account";
DELETE FROM "Entity";
DELETE FROM "Notification";
DELETE FROM "Invite";
DELETE FROM "Permission";
DELETE FROM "User";
DELETE FROM "Company";
SQL

echo "=== Deploy completed ==="
