import { defineConfig } from 'vite';

// 相对 base：构建产物可托管在任意子路径（GitHub Pages），本地 dev/preview 不受影响（M12）
export default defineConfig({
  base: './',
});
