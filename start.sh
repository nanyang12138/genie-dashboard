#!/usr/bin/env bash
# 一键启动 Genie Dashboard / Codeman（开发或生产）
# 用法:
#   ./start.sh              开发模式，端口 3000
#   ./start.sh 4000         开发模式，端口 4000
#   ./start.sh --prod       生产模式（node dist），端口 3000
#   ./start.sh --prod 4000
#
# 环境: 自动带上 Pandora 的 g++、Python 3.11（node-gyp）、本地 Node。

set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

# ---- 工具链：与交互式终端一致，避免 npm 子进程找不到 g++ ----
if [[ -d /tool/pandora64/bin ]]; then
  export PATH="/tool/pandora64/bin:${PATH}"
fi
export PATH="${HOME}/.local/node/bin:${HOME}/.local/bin:${PATH}"

if [[ -x /usr/bin/python3.11 ]]; then
  export PYTHON=/usr/bin/python3.11
fi
# 注意: 勿全局设置 npm_config_build_from_source，否则 npx 会报警告

PORT=3000
MODE=dev
while [[ $# -gt 0 ]]; do
  case "$1" in
    --prod)
      MODE=prod
      ;;
    -h | --help)
      echo "Usage: ./start.sh [PORT] [--prod]"
      echo "  默认: 开发 (tsx)，http://localhost:3000"
      echo "  --prod: 使用编译产物 dist/（无则先 npm run build）"
      exit 0
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"
      else
        echo "未知参数: $1" >&2
        exit 1
      fi
      ;;
  esac
  shift
done

# 仅结束「在本端口监听」的进程，避免误杀连到 3000 端口的其它客户端进程
if command -v lsof >/dev/null 2>&1; then
  mapfile -t listen_pids < <(lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ ${#listen_pids[@]} -gt 0 ]]; then
    echo "[start] 停止在本机端口 ${PORT} 监听的进程: ${listen_pids[*]} ..."
    kill "${listen_pids[@]}" 2>/dev/null || true
    sleep 1
  fi
fi

if [[ ! -d node_modules ]]; then
  echo "[start] 首次安装依赖..."
  npm install
fi

if ! node -e "require('node-pty')" 2>/dev/null; then
  echo "[start] 编译 node-pty（首次或 Node 升级后）..."
  (
    export npm_config_build_from_source=true
    [[ -x /usr/bin/python3.11 ]] && export PYTHON=/usr/bin/python3.11
    npm rebuild node-pty
  )
fi

echo "[start] 模式: ${MODE}  端口: ${PORT}"
if [[ "$MODE" == prod ]]; then
  if [[ ! -f dist/index.js ]]; then
    echo "[start] 构建 dist/..."
    npm run build
  fi
  exec node dist/index.js web --port "${PORT}"
else
  exec npx tsx src/index.ts web --port "${PORT}"
fi
