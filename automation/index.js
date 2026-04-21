require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// ==========================================
// CONFIGURATION
// ==========================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const IG_USERNAME = process.env.IG_USERNAME;
const IG_PASSWORD = process.env.IG_PASSWORD;

const DISPLAY_NAME = 'redflags.exe';
const HANDLE = '@redflags.exe';
const VERTICAL_PERCENT = 0.4; // Matches 40% in UI default
const W = 1080;
const H = 1920;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// ==========================================
// 1. CONTENT GENERATION (AI)
// ==========================================
async function generateQuote() {
  console.log("🤖 Generating new quote via Gemini...");

  const prompt = `You are the admin of a witty, edgy, borderline toxic Instagram account called @redflags.exe. 
Generate a short 3-to-4 line witty quote about modern dating, red flags, or being slightly toxic but relatable.
DO NOT include hashtags, emojis, or descriptions. Just output the exact text to be rendered.
Use line breaks appropriately.
Example:
If being sexy was a crime,
you'd be serving life...
and
I'd still volunteer as your cellmate.`;

  const fallbackModels = ['gemini-3.1-flash-lite',  // 15 RPM, 500 RPD
    'gemini-2.5-flash-lite',  // 10 RPM, 20 RPD
    'gemini-2.5-flash',       // 5 RPM, 20 RPD
    'gemini-3-flash'];
  let text = null;

  for (const modelName of fallbackModels) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      text = result.response.text().trim();
      console.log(`✅ Success with model: ${modelName}`);
      break;
    } catch (err) {
      console.warn(`⚡ Model ${modelName} failed/overloaded. Trying next model...`);
    }
  }

  if (!text) {
    throw new Error("All Gemini models are currently overloaded. Please try again later.");
  }

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

  // Register the newly downloaded fonts
  registerFont(path.join(__dirname, '../assets/Montserrat-Bold.ttf'), { family: 'Montserrat', weight: 'bold' });
  registerFont(path.join(__dirname, '../assets/Montserrat-Regular.ttf'), { family: 'Montserrat' });

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

  c.font = `bold ${NAME_FONT_SIZE}px Montserrat`;
  c.fillStyle = '#ffffff';
  c.textBaseline = 'middle';
  c.fillText(DISPLAY_NAME, nameX, nameY);

  const nameWidth = c.measureText(DISPLAY_NAME).width;
  drawVerifiedBadge(c, nameX + nameWidth + 8, nameY, 11);

  const handleY = avatarY + AVATAR_SIZE * 0.7;
  c.font = `${HANDLE_FONT_SIZE}px Montserrat`;
  c.fillStyle = '#71767b';
  c.textBaseline = 'middle';
  c.fillText(HANDLE, nameX, handleY);

  c.font = `${QUOTE_FONT_SIZE}px Montserrat`;
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
// 3. INSTAGRAM PUBLISHING (Puppeteer Headless)
// ==========================================
async function postToInstagramPuppeteer(imagePath, caption) {
  console.log("📱 Launching Invisible Browser (Puppeteer Chrome)...");

  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    headless: "new", // Back to invisible mode for Github Actions
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log("⏳ Navigating to Instagram Login...");
    await page.goto('https://www.instagram.com/accounts/login/', { waitUntil: 'networkidle2' });

    // Instagram has started hiding standard DOM names to block bots. 
    // We will generically grab ALL text boxes (Username & Password) 
    await page.waitForSelector('input', { timeout: 15000 });
    const inputs = await page.$$('input');
    
    if (inputs.length < 2) throw new Error("Could not find the standard 2 login inputs!");

    // Emulate human typing speed
    await inputs[0].type(IG_USERNAME, { delay: 65 });
    await inputs[1].type(IG_PASSWORD, { delay: 65 });

    console.log("👆 Clicking Login...");
    await page.click('button[type="submit"]');

    // Wait to clear the login wall
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Hard refresh back to homepage to bypass 
    // "Save Password" or "Turn on Notifications" modal popups
    console.log("🔄 Bypassing potential popups...");
    await page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
    console.log("✅ Logged in successfully!");

    // Click "Create" (The plus button)
    console.log("➕ Clicking Create Post...");

    // Using evaluate for robust text-based element targeting (bypasses random CSS classes)
    const createClicked = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span'));
      const createSpan = spans.find(el => el.innerText === 'Create');
      if (createSpan) {
        createSpan.click();
        return true;
      }
      return false;
    });

    if (!createClicked) {
      // Fallback to searching for the SVG icon
      const svgCreate = await page.$('svg[aria-label="New post"]');
      if (svgCreate) await svgCreate.click();
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log("📤 Pushing image into browser...");
    const fileInput = await page.$('input[type="file"]');
    if (!fileInput) throw new Error("Could not find file upload box in Instagram GUI.");
    await fileInput.uploadFile(path.resolve(__dirname, imagePath));

    // Helper to click localized text buttons (Next / Share)
    const clickButtonText = async (text) => {
      await new Promise(resolve => setTimeout(resolve, 3000));
      await page.evaluate((targetText) => {
        const btns = Array.from(document.querySelectorAll('div[role="button"]'));
        const target = btns.find(b => b.innerText && b.innerText.includes(targetText));
        if (target) target.click();
      }, text);
    };

    console.log("⏳ Bypassing crop screen...");
    await clickButtonText("Next");

    console.log("⏳ Bypassing filter screen...");
    await clickButtonText("Next");

    console.log("📝 Typing caption...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    const captionBox = await page.$('div[aria-label="Write a caption..."]');
    if (captionBox) {
      await captionBox.type(caption, { delay: 20 });
    } else {
      console.warn("Could not find caption box, posting without caption.");
    }

    console.log("🚀 Pressing Share!");
    await clickButtonText("Share");

    // Add extra time to ensure upload finishes fully before Chrome shuts down
    console.log("⏳ Waiting 15 seconds for upload animation to finish...");
    await new Promise(resolve => setTimeout(resolve, 15000));

    console.log("🎉 Successfully published via Automaton Chromium!");

  } catch (error) {
    console.error("❌ Puppeteer Error:", error.message);
    try {
        await page.screenshot({ path: 'puppeteer_error.png' });
        console.log("📸 Saved error screenshot to puppeteer_error.png");
    } catch(e) {}
    throw error;
  } finally {
    await browser.close();
  }
}

// ==========================================
// MASTER EXECUTION
// ==========================================
async function main() {
  try {
    if (!GEMINI_API_KEY || !IG_USERNAME || !IG_PASSWORD) {
      throw new Error("Missing required environment variables. Check your GitHub Secrets.");
    }

    // 1. Generate Quote
    const quote = await generateQuote();

    // 2. Render Image
    const imageBuffer = await generateImage(quote);

    // Save locally so Puppeteer can upload it
    fs.writeFileSync('temp_post.png', imageBuffer);
    console.log("💾 Saved image locally to temp_post.png");

    // 3. Publish directly to Instagram (Puppeteer Bot)
    const caption = `🚩\n\n#redflags #dating #toxic #relatable`;
    await postToInstagramPuppeteer('temp_post.png', caption);

    console.log("===========================");
    console.log("🥳 AUTOMATION COMPLETED!");
    console.log("===========================");

  } catch (error) {
    console.error("❌ ERROR EXECUTING AUTOMATION:", error.message);
    if (error.response && error.response.body) {
      console.error("Instagram API Error Details:", error.response.body);
    }
    process.exit(1);
  }
}

main();

