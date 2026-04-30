FROM node:22-alpine
WORKDIR /workspace
COPY package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY infra/package.json infra/package.json
COPY benchmark/package.json benchmark/package.json
RUN npm install --workspace @memorag-mvp/api --include-workspace-root=false
COPY apps/api apps/api
WORKDIR /workspace/apps/api
EXPOSE 8787
CMD ["npm", "run", "dev"]
