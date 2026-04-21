require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// ==========================================
// CONFIGURATION
// ==========================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IMGBB_API_KEY = process.env.IMGBB_API_KEY;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

const DISPLAY_NAME = 'redflags.exe';
const HANDLE = '@redflags.exe';
const VERTICAL_PERCENT = 0.65; // Matches 65% in UI default
const W = 1080;
const H = 1920;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ==========================================
// 1. CONTENT GENERATION (AI)
// ==========================================
async function generateQuote() {
  console.log("🤖 Generating new quote via Gemini...");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `You are the admin of a witty, edgy, borderline toxic Instagram account called @redflags.exe. 
Generate a short 3-to-4 line witty quote about modern dating, red flags, or being slightly toxic but relatable.
DO NOT include hashtags, emojis, or descriptions. Just output the exact text to be rendered.
Use line breaks appropriately.
Example:
If being sexy was a crime,
you'd be serving life...
and
I'd still volunteer as your cellmate.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  console.log("\n--- Generated Quote ---");
  console.log(text);
  console.log("-----------------------\n");
  return text;
}

// ==========================================
// 2. IMAGE GENERATION (Node Canvas)
// ==========================================
function drawVerifiedBadge(c, x, y, r) {
  // Same logic as web UI
  c.save();
  c.beginPath();
  const spikes = 12;
  const outerR = r;
  const innerR = r * 0.85;
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI * 2 * i) / (spikes * 2) - Math.PI / 2;
    const rad = i % 2 === 0 ? outerR : innerR;
    const px = x + Math.cos(angle) * rad;
    const py = y + Math.sin(angle) * rad;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
  c.fillStyle = '#1d9bf0';
  c.fill();

  c.beginPath();
  c.moveTo(x - r * 0.3, y + r * 0.1);
  c.lineTo(x - r * 0.05, y + r * 0.4);
  c.lineTo(x + r * 0.4, y - r * 0.3);
  c.strokeStyle = '#ffffff';
  c.lineWidth = r * 0.3;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.stroke();
  c.restore();
}

function wrapText(context, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const width = context.measureText(currentLine + word + ' ').width;
    if (width < maxWidth && i > 0) {
      currentLine += word + ' ';
    } else {
      if (i > 0) lines.push(currentLine);
      currentLine = word + ' ';
    }
  }
  lines.push(currentLine);
  return lines;
}

async function generateImage(quoteText) {
  console.log("🎨 Rendering image on Canvas...");
  const canvas = createCanvas(W, H);
  const c = canvas.getContext('2d');
  
  // Background
  c.fillStyle = '#000000';
  c.fillRect(0, 0, W, H);

  // Constants at 1080 resolution
  const PADDING_LEFT = 100;
  const AVATAR_SIZE = 150;
  const AVATAR_GAP = 24;
  const NAME_FONT_SIZE = 38;
  const HANDLE_FONT_SIZE = 28;
  const QUOTE_FONT_SIZE = 32;

  const baseY = H * VERTICAL_PERCENT;
  const avatarX = PADDING_LEFT;
  const avatarY = baseY;

  // Load Profile Image
  const profilePath = path.join(__dirname, '../assets/profile.png');
  try {
    const profileImage = await loadImage(profilePath);
    c.save();
    c.beginPath();
    c.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    c.closePath();
    c.clip();
    c.drawImage(profileImage, avatarX, avatarY, AVATAR_SIZE, AVATAR_SIZE);
    c.restore();
  } catch (err) {
    console.log("Profile image not found, drawing fallback circle.");
    c.beginPath();
    c.arc(avatarX + AVATAR_SIZE / 2, avatarY + AVATAR_SIZE / 2, AVATAR_SIZE / 2, 0, Math.PI * 2);
    c.fillStyle = '#333';
    c.fill();
  }

  const nameX = avatarX + AVATAR_SIZE + AVATAR_GAP;
  const nameY = avatarY + AVATAR_SIZE * 0.35;

  c.font = `bold ${NAME_FONT_SIZE}px sans-serif`;
  c.fillStyle = '#ffffff';
  c.textBaseline = 'middle';
  c.fillText(DISPLAY_NAME, nameX, nameY);

  const nameWidth = c.measureText(DISPLAY_NAME).width;
  drawVerifiedBadge(c, nameX + nameWidth + 8, nameY, 11);

  const handleY = avatarY + AVATAR_SIZE * 0.7;
  c.font = `${HANDLE_FONT_SIZE}px sans-serif`;
  c.fillStyle = '#71767b';
  c.textBaseline = 'middle';
  c.fillText(HANDLE, nameX, handleY);

  c.font = `${QUOTE_FONT_SIZE}px sans-serif`;
  c.fillStyle = '#e7e9ea';
  c.textBaseline = 'top';

  const quoteStartY = avatarY + AVATAR_SIZE + 36;
  const maxWidth = W - PADDING_LEFT * 2;
  const lineHeight = QUOTE_FONT_SIZE * 1.65;

  const paragraphs = quoteText.split('\n');
  let currentY = quoteStartY;

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      currentY += lineHeight * 0.5;
      continue;
    }
    const wrappedLines = wrapText(c, paragraph, maxWidth);
    for (const line of wrappedLines) {
      c.fillText(line, PADDING_LEFT, currentY);
      currentY += lineHeight;
    }
  }

  return canvas.toBuffer('image/png');
}

// ==========================================
// 3. IMAGE HOSTING (ImgBB)
// ==========================================
async function uploadToImgBB(buffer) {
  console.log("☁️ Uploading image to ImgBB...");
  const form = new FormData();
  form.append('image', buffer.toString('base64'));
  
  const response = await axios.post(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, form, {
    headers: form.getHeaders()
  });

  if (response.data && response.data.data && response.data.data.url) {
    const url = response.data.data.url;
    console.log(`✅ Uploaded to: ${url}`);
    return url;
  }
  throw new Error("Failed to upload to ImgBB");
}

// ==========================================
// 4. MAKE.COM WEBHOOK (Bypasses Meta Developer)
// ==========================================
async function sendToMakeWebhook(imageUrl, caption) {
  console.log("📱 Sending to Make.com Webhook for Publishing...");
  
  const response = await axios.post(MAKE_WEBHOOK_URL, {
    imageUrl: imageUrl,
    caption: caption
  });

  console.log(`🎉 Successfully sent to Make! Response: ${response.statusText}`);
  return response.data;
}

// ==========================================
// MASTER EXECUTION
// ==========================================
async function main() {
  try {
    if (!GEMINI_API_KEY || !IMGBB_API_KEY || !MAKE_WEBHOOK_URL) {
      throw new Error("Missing required environment variables (GEMINI, IMGBB, or MAKE_WEBHOOK). Check GitHub Secrets.");
    }
    
    // 1. Generate Quote
    const quote = await generateQuote();
    
    // 2. Render Image
    const imageBuffer = await generateImage(quote);
    
    // 3. Upload to ImgBB
    const publicUrl = await uploadToImgBB(imageBuffer);
    
    // 4. Send to Make.com
    const caption = `🚩\n\n#redflags #dating #toxic #relatable`;
    await sendToMakeWebhook(publicUrl, caption);
    
    console.log("===========================");
    console.log("🥳 AUTOMATION COMPLETED!");
    console.log("===========================");
    
  } catch (error) {
    console.error("❌ ERROR EXECUTING AUTOMATION:", error.message);
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
