FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG LANDING_IOS_QR_URL
ARG LANDING_ANDROID_QR_URL
ENV LANDING_IOS_QR_URL=$LANDING_IOS_QR_URL
ENV LANDING_ANDROID_QR_URL=$LANDING_ANDROID_QR_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
EXPOSE 4321
CMD ["npx", "astro", "preview", "--host", "0.0.0.0", "--port", "4321"]
