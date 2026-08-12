#!/usr/bin/env bash
# 重新部署 GitHub Pages：构建并把 dist/ 推到 gh-pages 分支。
# 背景：当前 gh token 无 workflow scope，不能用 Actions 自动部署；
# 改用"构建产物推 gh-pages 分支 + Pages 从该分支发布"的经典路径。
# 用法：bash scripts/deploy-pages.sh
set -euo pipefail

npm run build

TMP_INDEX=.git/tmp-deploy-index
rm -f "$TMP_INDEX"
# 用临时 index 打包 dist 内容，不动当前工作区与暂存区
GIT_INDEX_FILE=$TMP_INDEX git read-tree --empty
GIT_INDEX_FILE=$TMP_INDEX git --work-tree=dist add -f -A
TREE=$(GIT_INDEX_FILE=$TMP_INDEX git write-tree)
CMT=$(git commit-tree "$TREE" -m "deploy: $(date '+%Y-%m-%d %H:%M')")
git update-ref refs/heads/gh-pages "$CMT"
rm -f "$TMP_INDEX"

git push origin gh-pages
echo "已推送到 gh-pages 分支，Pages 几分钟后更新：https://davidchen99.github.io/wobble-badminton/"
