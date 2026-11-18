# 边缘本地控制台 · React 重构版
# 与旧 vue-cli 工程统一使用 node:18-alpine 之外的版本，改为 22 以支持 Vite 8
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 9101

# 开发态容器：与旧 Dockerfile 行为对齐（热更新 + 端口 9101）
CMD ["sh", "-c", "npm install && npm run dev -- --host 0.0.0.0"]
