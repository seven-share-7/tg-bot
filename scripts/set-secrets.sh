#!/bin/bash
# 设置 Cloudflare Workers Secrets 脚本
# 
# 使用方法：
# chmod +x scripts/set-secrets.sh
# ./scripts/set-secrets.sh
#
# 或者直接使用 wrangler secret put 命令

echo "设置 Cloudflare Workers Secrets"
echo "================================"

# 设置 RUNPOD_API_KEY
echo "请输入 RUNPOD_API_KEY："
read -s RUNPOD_API_KEY
wrangler secret put RUNPOD_API_KEY <<< "$RUNPOD_API_KEY"

# 设置 RUNPOD_ENDPOINT_ID
echo "请输入 RUNPOD_ENDPOINT_ID："
read -s RUNPOD_ENDPOINT_ID
wrangler secret put RUNPOD_ENDPOINT_ID <<< "$RUNPOD_ENDPOINT_ID"

echo "================================"
echo "Secrets 设置完成！"

