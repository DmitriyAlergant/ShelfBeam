import { Router, Request, Response } from "express";
import QRCode from "qrcode";

const LANDING_QR_URL = process.env.LANDING_QR_URL ?? (() => { throw new Error("Missing required env LANDING_QR_URL"); })();

const router = Router();

// Cache the rendered HTML since the QR URL doesn't change at runtime
let cachedHTML: string | null = null;

router.get("/", async (_req: Request, res: Response) => {
  if (!cachedHTML) {
    const qrDataUrl = await QRCode.toDataURL(LANDING_QR_URL, {
      width: 280,
      margin: 2,
      color: { dark: "#2D2319", light: "#F5EDE3" },
    });
    cachedHTML = buildLandingHTML(qrDataUrl);
  }
  res.setHeader("Content-Type", "text/html");
  res.send(cachedHTML);
});

function buildLandingHTML(qrDataUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BookBeam — Discover Your Next Favorite Book</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Nunito', sans-serif;
      background: #FFF8F0;
      color: #2D2319;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      position: relative;
      overflow: hidden;
    }

    /* Subtle paper grain overlay */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      max-width: 440px;
      width: 100%;
    }

    .logo-area {
      position: relative;
      margin-bottom: 24px;
    }

    .book-icon {
      font-size: 72px;
      line-height: 1;
      filter: drop-shadow(0 4px 12px rgba(255, 210, 52, 0.4));
    }

    .beam-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 140px;
      height: 140px;
      background: radial-gradient(circle, rgba(255,210,52,0.35) 0%, rgba(255,210,52,0) 70%);
      border-radius: 50%;
      z-index: -1;
      animation: pulse 3s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
      50% { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
    }

    h1 {
      font-family: 'Fredoka', sans-serif;
      font-weight: 700;
      font-size: 2.5rem;
      color: #2D2319;
      margin-bottom: 8px;
      text-align: center;
    }

    .tagline {
      font-family: 'Nunito', sans-serif;
      font-size: 1.1rem;
      color: #7A6B5D;
      margin-bottom: 32px;
      text-align: center;
    }

    .card {
      background: #F5EDE3;
      border-radius: 24px;
      padding: 32px;
      box-shadow: 0 8px 32px rgba(45, 35, 25, 0.08), 0 2px 8px rgba(45, 35, 25, 0.04);
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 100%;
    }

    .card h2 {
      font-family: 'Fredoka', sans-serif;
      font-weight: 600;
      font-size: 1.25rem;
      color: #8B6914;
      margin-bottom: 20px;
    }

    .qr-img {
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(45, 35, 25, 0.1);
      width: 220px;
      height: 220px;
    }

    .instructions {
      margin-top: 20px;
      text-align: center;
      line-height: 1.6;
    }

    .instructions .step {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      font-size: 0.95rem;
      color: #2D2319;
    }

    .step-num {
      background: #FFD234;
      color: #2D2319;
      font-family: 'Fredoka', sans-serif;
      font-weight: 600;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .badge {
      display: inline-block;
      background: #FFD234;
      color: #2D2319;
      font-family: 'Fredoka', sans-serif;
      font-weight: 600;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      padding: 4px 12px;
      border-radius: 12px;
      margin-top: 20px;
    }

    .footer {
      margin-top: 32px;
      font-size: 0.8rem;
      color: #B8A99A;
      text-align: center;
    }

    .shelf {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 8px;
      background: linear-gradient(90deg, #8B6914, #A07A1A, #8B6914);
      z-index: 2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo-area">
      <div class="beam-glow"></div>
      <div class="book-icon">\u{1F4DA}</div>
    </div>

    <h1>BookBeam</h1>
    <p class="tagline">Snap a shelf. Discover your next favorite book.</p>

    <div class="card">
      <h2>Open in Expo Go</h2>
      <img class="qr-img" src="${qrDataUrl}" alt="QR Code to open BookBeam" />
      <div class="instructions">
        <div class="step">
          <span class="step-num">1</span>
          <span>Install <strong>Expo Go</strong> on your phone</span>
        </div>
        <div class="step">
          <span class="step-num">2</span>
          <span>Scan this QR code with your camera</span>
        </div>
        <div class="step">
          <span class="step-num">3</span>
          <span>Start discovering books!</span>
        </div>
      </div>
      <span class="badge">Hackathon Demo</span>
    </div>

    <p class="footer">Built with care for young readers</p>
  </div>

  <div class="shelf"></div>
</body>
</html>`;
}

export default router;
