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
RUN npm install -g serve
WORKDIR /app
COPY --from=build /app/dist ./dist
EXPOSE 4321
CMD ["serve", "dist", "-l", "4321"]
