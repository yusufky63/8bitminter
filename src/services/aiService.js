import { processTtlgenHerImage } from "./imageUtils";

// =============================================================================
// CONSTANTS & CONFIGURATION
// =============================================================================

const MAX_RETRIES = 3;

const API_ENDPOINTS = {
  TOGETHER_TEXT: "https://api.together.xyz/v1/completions",
  TOGETHER_IMAGE: "https://api.together.xyz/v1/images/generations",
  STABILITY_AI: "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image",
  REPLICATE: "https://api.replicate.com/v1/predictions",
};

const MODELS = {
  TEXT: {
    PRIMARY: "mistralai/Mixtral-8x7B-Instruct-v0.1",
    FALLBACK: "meta-llama/Llama-3.1-8B-Instruct-Turbo-Free",
    ANALYSIS: [
      "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
    ],
  },
  IMAGE: {
    TOGETHER: "black-forest-labs/FLUX.1-schnell-Free",
    REPLICATE: "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
  },
};

// Updated coin categories to match the retro 8-bit theme
const COIN_CATEGORIES = [
  {
    name: "8-Bit Gaming",
    features: "Retro gaming, pixel characters, arcade experiences, game collectibles, nostalgia",
    themes: "Arcade, classic games, pixel art, chiptune, high scores",
  },
  {
    name: "Pixel Art Collectibles",
    features: "Limited edition digital art, pixel collections, retro aesthetics, digital galleries",
    themes: "Pixel art, color palettes, sprites, dithering, visual expression",
  },
  {
    name: "CryptoVoxel Worlds",
    features: "Virtual land, voxel buildings, metaverse events, digital avatars, retro environments",
    themes: "Virtual worlds, voxels, digital landscapes, virtual real estate, community spaces",
  },
  {
    name: "Retro Music & Chiptunes",
    features: "Digital music ownership, chiptune collections, artist support, music events",
    themes: "8-bit music, synthesizers, chiptunes, sound chips, nostalgic melodies",
  },
  {
    name: "Arcade Economy",
    features: "Play-to-earn, retro games tournaments, high score rewards, arcade economy",
    themes: "Arcade tokens, leaderboards, game rewards, competition, community challenges",
  },
  {
    name: "Digital Retro Fashion",
    features: "Pixel wearables, retro-styled avatars, digital fashion items, nostalgic accessories",
    themes: "80s/90s fashion, pixel clothing, digital accessories, avatar customization",
  },
  {
    name: "8-Bit DeFi",
    features: "Simplified finance, retro banking interfaces, pixel-styled investments, farming",
    themes: "Financial pixels, retro banking, simplified economics, accessible finance",
  },
  {
    name: "Retro Social Clubs",
    features: "Community membership, retro chat rooms, digital hangouts, pixel avatars",
    themes: "BBS nostalgia, pixel forums, digital clubhouses, community governance",
  },
  {
    name: "Pixel Pets & Companions",
    features: "Digital pets, creature training, pixel evolution, companion collection",
    themes: "Tamagotchi-inspired, creature care, evolution, collecting, companions",
  },
  {
    name: "Retro Tech & Gadgets",
    features: "Digital gadget collections, retro hardware tributes, tech memorabilia",
    themes: "Vintage computers, game consoles, pixel gadgets, tech nostalgia",
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get API key from environment variables
 */
const getApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
  if (!apiKey) {
    console.error("Together API key is missing from environment variables");
    throw new Error(
      "API key is required. Please set NEXT_PUBLIC_TOGETHER_API_KEY in your environment variables."
    );
  }
  return apiKey;
};

/**
 * Clean text to avoid NSFW detection
 */
const sanitizeText = (text) => {
  if (!text) return "";
  return text.replace(/beauty|sexy|hot|attractive|babe|gorgeous/gi, "lovely");
};

/**
 * Generic retry mechanism
 */
const retryOperation = async (operation, context, handleError, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`${context} attempt ${i + 1}/${retries} failed:`, error);

      if (i === retries - 1) {
        handleError(error, context);
        throw error;
      }

      if (error.message?.includes("user rejected")) {
        handleError(error, context);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

/**
 * Wait utility
 */
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// =============================================================================
// IMAGE GENERATION PROVIDERS
// =============================================================================

/**
 * Stability AI Image Generation
 */
const generateImageWithStabilityAI = async (name, symbol, description) => {
  const STABILITY_API_KEY = process.env.NEXT_PUBLIC_STABILITY_API_KEY;
  if (!STABILITY_API_KEY) {
    throw new Error("Stability AI API key not configured");
  }

  const safeName = sanitizeText(name);
  const safeDescription = sanitizeText(description);
  
  const prompt = `Pixel art style cryptocurrency token logo for "${safeName}" (${symbol}). ${
    safeDescription ? `Theme: ${safeDescription}. ` : ""
  }8-bit retro style, arcade-inspired, pixelated, nostalgic game art, limited color palette, chunky pixels, clean edges, resembling old video games from the 80s and 90s, circular coin design`;

  const requestBody = {
    text_prompts: [
      { text: prompt, weight: 1 },
      {
        text: "realistic, photorealistic, 3D rendering, smooth gradients, high detail, soft edges, modern graphics, blur",
        weight: -0.9,
      },
    ],
    cfg_scale: 15,
    height: 512,
    width: 512,
    samples: 1,
    steps: 40,
    style_preset: "pixel-art",
    sampler: "K_EULER",
  };

  const response = await fetch(API_ENDPOINTS.STABILITY_AI, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STABILITY_API_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Stability AI error: ${error.message || response.status}`);
  }

  const data = await response.json();
  const base64Image = data.artifacts[0].base64;
  const imageBlob = await fetch(`data:image/png;base64,${base64Image}`).then(
    (r) => r.blob()
  );
  return URL.createObjectURL(imageBlob);
};

/**
 * Replicate Image Generation
 */
const generateImageWithReplicate = async (name, symbol, description) => {
  const REPLICATE_API_KEY = process.env.NEXT_PUBLIC_REPLICATE_API_KEY;
  if (!REPLICATE_API_KEY) {
    throw new Error("Replicate API key not configured");
  }

  const safeName = sanitizeText(name);
  const safeDescription = sanitizeText(description);
  
  const prompt = `Professional pixel art cryptocurrency token logo, circular coin design for "${safeName}" token (${symbol}). ${
    safeDescription ? `Theme: ${safeDescription}. ` : ""
  }Retro 8-bit video game style, arcade-inspired geometric design, crisp pixelated artwork, nostalgic gaming graphics, limited color palette with bold contrasts, chunky square pixels, clean sharp edges, flat geometric shapes, resembling classic arcade games from the 1980s and 1990s, centered logo composition, vibrant colors, digital token emblem, coin-like appearance`;
  
  const negative_prompt = "nsfw, adult content, inappropriate, suggestive, sexy, erotic, nudity, revealing, provocative, seductive, text, words, letters, numbers, typography, realistic, photorealistic, 3D rendering, smooth gradients, anti-aliasing, blur, soft edges, detailed shading, complex lighting, modern graphics, high resolution details, noise, artifacts, distorted, ugly, deformed, extra elements, backgrounds, people, faces, bodies, human figures, blurry, low quality";

  const response = await fetch(API_ENDPOINTS.REPLICATE, {
    method: "POST",
    headers: {
      Authorization: `Token ${REPLICATE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: MODELS.IMAGE.REPLICATE,
      input: {
        prompt,
        negative_prompt,
        width: 1024,
        height: 1024,
        num_outputs: 1,
        scheduler: "K_EULER",
        num_inference_steps: 50,
        guidance_scale: 7.5,
        seed: Math.floor(Math.random() * 1000000),
        apply_watermark: false,
        high_noise_fraction: 0.8,
        refiner: "expert_ensemble_refiner",
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`Replicate API error: ${error.detail || response.status}`);
  }

  const prediction = await response.json();
  
  // Poll for completion
  let result = prediction;
  while (result.status === "starting" || result.status === "processing") {
    await wait(1000);
    
    const pollResponse = await fetch(
      `${API_ENDPOINTS.REPLICATE}/${result.id}`,
      {
        headers: { Authorization: `Token ${REPLICATE_API_KEY}` },
      }
    );
    
    result = await pollResponse.json();
  }

  if (result.status === "failed") {
    throw new Error(`Replicate generation failed: ${result.error}`);
  }

  return result.output[0];
};

/**
 * Together.ai Image Generation
 */
const generateImageWithTogetherAI = async (name, symbol, description, categoryContext) => {
  const TOGETHER_API_KEY = getApiKey();
  const category = categoryContext ? categoryContext.name : "token";
  
  const prompt = `Pixel art style cryptocurrency token logo for "${name}" (${symbol}). Category: ${category}. ${
    description ? `Theme: ${description}` : ""
  }. 8-bit retro style, arcade-inspired, pixelated, nostalgic game art, limited color palette, chunky pixels, clean edges, resembling old video games from the 80s and 90s.`;

  const response = await fetch(API_ENDPOINTS.TOGETHER_IMAGE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOGETHER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODELS.IMAGE.TOGETHER,
      prompt,
      width: 512,
      height: 512,
      n: 1,
      response_format: "url",
      negative_prompt: "text, words, letters, numbers, low quality, blurry, realistic, photorealistic, 3D rendering, shading, high resolution details, smooth gradients",
    }),
  });

  if (!response.ok) {
    const statusCode = response.status;
    let errorText = "";
    
    try {
      const errorJson = await response.json();
      errorText = JSON.stringify(errorJson);
      console.error(`Together.ai API Error (${statusCode}):`, errorJson);
    } catch (e) {
      errorText = await response.text();
      console.error(`Together.ai API Error (${statusCode}):`, errorText);
    }
    
    if (statusCode === 401 || statusCode === 403) {
      throw new Error("API key is invalid or expired. Please check your API key.");
    } else if (statusCode === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else if (statusCode >= 500) {
      throw new Error("Together API server error. Please try again later.");
    }
    
    throw new Error(errorText || `HTTP Error: ${statusCode}`);
  }
  
  const data = await response.json();
  if (!data.data || !data.data[0] || !data.data[0].url) {
    throw new Error("Invalid API response format");
  }
  
  return data.data[0].url;
};

// =============================================================================
// MAIN API FUNCTIONS
// =============================================================================

/**
 * AI text generation function with category context
 */
export const generateTextWithAI = async (selectedCategory = null, userDescription = "") => {
  console.log("Starting text generation with inputs:", {
    selectedCategory,
    userDescription,
  });
  
  if (generateTextWithAI.isRunning) {
    console.warn("Text generation is already running - preventing recursive call");
    throw new Error("Text generation service is busy. Please try again later.");
  }
  
  generateTextWithAI.isRunning = true;
  
  try {
    let retries = 0;
    const maxRetries = 3;
    let lastError = null;
    const models = [MODELS.TEXT.PRIMARY, MODELS.TEXT.FALLBACK];
    const TOGETHER_API_KEY = getApiKey();

    while (retries < maxRetries) {
      try {
        const category = selectedCategory
          ? COIN_CATEGORIES.find((cat) => cat.name === selectedCategory)
          : COIN_CATEGORIES[Math.floor(Math.random() * COIN_CATEGORIES.length)];

        if (!category) {
          throw new Error("Category not found");
        }

        const modelIndex = Math.min(retries, models.length - 1);
        const model = models[modelIndex];
        console.log(`AI Text Generation - Attempt ${retries + 1}/${maxRetries}, Model: ${model}`);

        const prompt = `Design a cryptocurrency for category "${category.name}" with description: "${userDescription}".
Return only valid JSON with name, symbol (3-4 letters), and description (exactly 20 words, no more).
Format: {"name":"coin name","symbol":"SYM","description":"A brief description...","category":"${category.name}"}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        
        try {
          const response = await fetch(API_ENDPOINTS.TOGETHER_TEXT, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${TOGETHER_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              prompt,
              max_tokens: 300,
              temperature: 0.7,
              top_p: 0.9,
              frequency_penalty: 0.0,
              presence_penalty: 0.0,
            }),
            signal: controller.signal,
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const statusCode = response.status;
            
            console.error(`API Error (${statusCode}):`, errorData);
            
            if (statusCode === 401 || statusCode === 403) {
              throw new Error("API key is invalid or expired. Please check your API key.");
            } else if (statusCode === 429) {
              throw new Error("Rate limit exceeded. Please try again later.");
            } else if (statusCode >= 500) {
              throw new Error("Together API server error. Please try again later.");
            }
            
            throw new Error(errorData.error?.message || `API Error: ${response.status} - ${response.statusText}`);
          }

          const data = await response.json();
          console.log("API Response received");

          if (!data.choices || !data.choices.length || !data.choices[0].text || data.choices[0].text.trim() === "") {
            console.warn("Empty API response, retrying...");
            retries++;
            await wait(2000);
            continue;
          }

          let generatedText = data.choices[0].text.trim();
          console.log("Generated text length:", generatedText.length);

          try {
            const jsonMatch = generatedText.match(/\{.*\}/s);
            if (jsonMatch) {
              generatedText = jsonMatch[0];
            }
            
            const result = JSON.parse(generatedText);
            
            if (!result.name || !result.symbol || !result.description) {
              throw new Error("Missing required fields in generated content");
            }
            
            const words = result.description.split(/\s+/);
            const limitedDescription = words.slice(0, 20).join(" ");
            
            return {
              name: result.name,
              symbol: result.symbol.toUpperCase(),
              description: limitedDescription,
              category: category.name,
              features: category.features,
            };
          } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
            retries++;
            await wait(2000);
            continue;
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === "AbortError") {
            console.error("Request timed out");
            throw new Error("API request timed out after 20 seconds");
          }
          
          throw fetchError;
        }
      } catch (error) {
        console.error("AI text generation error:", error);
        lastError = error;
        retries++;
        await wait(2000);
      }
    }

    console.error("All AI text generation attempts failed:", lastError);
    throw new Error(`Text generation failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
  } finally {
    generateTextWithAI.isRunning = false;
  }
};

/**
 * Enhanced AI image generation with multiple fallback APIs
 */
export const generateImageWithAI = async (name, symbol, description, categoryContext = null) => {
  console.log("Starting AI image generation...");
  console.log("Inputs:", { name, symbol, description });
  
  const apiProviders = [
    {
      name: "Stability AI",
      generator: () => generateImageWithStabilityAI(name, symbol, description),
    },
    {
      name: "Together.ai",
      generator: () => generateImageWithTogetherAI(name, symbol, description, categoryContext),
    },
    
    {
      name: "Replicate",
      generator: () => generateImageWithReplicate(name, symbol, description),
    },
  ];

  let lastError = null;
  
  for (const provider of apiProviders) {
    try {
      console.log(`Attempting image generation with ${provider.name}...`);
      const imageUrl = await provider.generator();
      
      if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://") || imageUrl.startsWith("blob:"))) {
        console.log(`✅ Image generated successfully with ${provider.name}`);
        return imageUrl;
      } else {
        throw new Error("Generated URL is invalid");
      }
    } catch (error) {
      lastError = error;
      console.error(`❌ ${provider.name} failed:`, error.message);
      
      if (error.message.includes("not configured")) {
        console.log(`⏭️ Skipping ${provider.name} - API key not configured`);
        continue;
      }
      
      if (provider.name === "Together.ai" && error.message.includes("Rate limit")) {
        console.log(`⏭️ Together.ai rate limited, trying next provider...`);
        continue;
      }
      
      await wait(1000);
    }
  }
  
  throw new Error(`Failed to generate image with all providers. Last error: ${lastError?.message || "Unknown error"}`);
};

/**
 * AI token analysis function
 */
export const analyzeTokenWithAI = async (tokenData, userQuestion, onchainData = null) => {
  let retries = 0;
  const maxRetries = 3;
  let lastError = null;
  const models = MODELS.TEXT.ANALYSIS;

  while (retries < maxRetries) {
    try {
      const modelIndex = Math.min(retries, models.length - 1);
      const model = models[modelIndex];
      console.log(`AI Token Analysis - Attempt ${retries + 1}/${maxRetries}, Model: ${model}`);

      // Helper functions for data formatting
      const formatDate = (dateString) => {
        if (!dateString) return "Unknown";
        try {
          return new Date(dateString).toLocaleDateString();
        } catch (e) {
          return dateString;
        }
      };
      
      const formatNumber = (num) => {
        if (num === undefined || num === null) return "Unknown";
        if (typeof num === "string") num = parseFloat(num);
        return num.toLocaleString();
      };
      
      const calculatePrice = () => {
        if (tokenData.marketCap && tokenData.totalSupply) {
          try {
            const price = parseFloat(tokenData.marketCap) / parseFloat(tokenData.totalSupply);
            return price.toFixed(8);
          } catch (e) {
            return "Unknown";
          }
        }
        return "Unknown";
      };
      
      const calculateEngagement = () => {
        if (tokenData.transfers?.count && tokenData.uniqueHolders) {
          try {
            const txPerHolder = parseFloat(tokenData.transfers.count) / parseFloat(tokenData.uniqueHolders);
            return txPerHolder.toFixed(2);
          } catch (e) {
            return "Unknown";
          }
        }
        return "Unknown";
      };
      
      const calculate24hChange = () => {
        if (tokenData.marketCapDelta24h && tokenData.marketCap) {
          try {
            const currentMC = parseFloat(tokenData.marketCap);
            const delta = parseFloat(tokenData.marketCapDelta24h);
            const previousMC = currentMC - delta;
            if (previousMC <= 0) return "0%";
            const changePercent = (delta / previousMC) * 100;
            return changePercent.toFixed(2) + "%";
          } catch (e) {
            return "Unknown";
          }
        }
        return "Unknown";
      };

      // Prepare token summary
      const tokenSummary = {
        name: tokenData.name || "Unknown",
        symbol: tokenData.symbol || "???",
        description: tokenData.description
          ? tokenData.description.length > 200
            ? tokenData.description.substring(0, 200) + "..."
            : tokenData.description
          : "No description",
        price: calculatePrice(),
        marketCap: formatNumber(tokenData.marketCap) || "Unknown",
        marketCap24hChange: calculate24hChange(),
        holders: formatNumber(tokenData.uniqueHolders) || "Unknown",
        totalSupply: formatNumber(tokenData.totalSupply) || "Unknown",
        volume24h: formatNumber(tokenData.volume24h) || "Unknown",
        totalVolume: formatNumber(tokenData.totalVolume) || "Unknown",
        transfers: formatNumber(tokenData.transfers?.count) || "Unknown",
        txPerHolder: calculateEngagement(),
        comments: formatNumber(tokenData.zoraComments?.count) || "Unknown",
        created: formatDate(tokenData.createdAt),
        age: tokenData.createdAt
          ? Math.floor((new Date() - new Date(tokenData.createdAt)) / (1000 * 60 * 60 * 24)) + " days"
          : "Unknown",
      };

      // Onchain data formatting
      let onchainSummary = "";
      if (onchainData && Object.keys(onchainData).length > 0) {
        const formatValue = (value) => {
          if (!value) return "Unknown";
          if (value.formatted) return value.formatted;
          if (typeof value === "bigint") return value.toString();
          return String(value);
        };
        
        onchainSummary = `
Onchain Data:
- Liquidity: ${formatValue(onchainData.liquidity)} (USD: ${formatValue(
          onchainData.liquidity?.usdcDecimal || onchainData.liquidityUSD || 0
        )})
- Total Supply: ${formatValue(onchainData.totalSupply)}
- Unique Holders: ${onchainData.owners?.length || 0}
- Pool Address: ${onchainData.pool || "Unknown"}
`;
      }

      // Check if investment question
      const isInvestmentQuestion =
        userQuestion.toLowerCase().includes("invest") ||
        userQuestion.toLowerCase().includes("good investment") ||
        userQuestion.toLowerCase().includes("worth") ||
        userQuestion.toLowerCase().includes("potential") ||
        userQuestion.toLowerCase().includes("buy");
      
      // Create analysis prompt
      let prompt = `Analyze this cryptocurrency token based on these metrics: 
Token: ${tokenSummary.name} (${tokenSummary.symbol})
Description: ${tokenData.description || "No description"}
Price: $${tokenSummary.price}
Market Cap: $${tokenSummary.marketCap}
24h Change: ${tokenSummary.marketCap24hChange}
Holders: ${tokenSummary.holders}
Total Supply: ${tokenSummary.totalSupply}
Volume 24h: $${tokenSummary.volume24h}
Total Volume: $${tokenSummary.totalVolume}
Creation Date: ${tokenSummary.created} (${tokenSummary.age} old)
Total Transfers: ${tokenSummary.transfers}
TX Per Holder: ${tokenSummary.txPerHolder}
Comments Count: ${tokenSummary.comments}
${onchainSummary}

User question: "${userQuestion || "What is this token about?"}"

Your response MUST be structured in exactly this format:

OVERVIEW: In 2-3 sentences, provide key facts about what this token is and its purpose.

METRICS ANALYSIS: 
- Analyze the token's market cap, volume trends, and holder activity
- Comment on market interest based on transfers and comments
- Identify any red flags or positive indicators from the metrics

STRENGTHS AND WEAKNESSES:
- List the main strengths of this token (2-3 points)
- List the main weaknesses or risks (2-3 points)`;

      if (isInvestmentQuestion) {
        prompt += `\n\nINVESTMENT ANSWER: Start with ONE of these exact options: "Yes", "No", "Maybe", "It depends", "Unlikely", or "Insufficient data". Then provide 2-3 sentences explaining your evaluation based on the metrics above.

IMPORTANT: Your analysis should focus on the token's fundamental metrics, holder activity, community engagement, and price action. Avoid speculation about future price movements, but evaluate the current state of the token based on available data only.`;
      } else {
        prompt += `\n\nANSWER: Provide a direct and detailed answer to the user's specific question, referencing the relevant metrics above.

IMPORTANT: Your entire response must be under 250 words. Focus on the data while being educational and informative. Only use the data that is provided - do not make up or assume data that isn't present.`;
      }

      console.log("Sending prompt with length:", prompt.length);

      const response = await fetch("/api/together", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          max_tokens: 400,
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API Error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API Response:", data);

      if (!data.choices || !data.choices.length || !data.choices[0].text || data.choices[0].text.trim() === "") {
        console.warn("Empty API response, retrying...");
        retries++;
        await wait(2000);
        continue;
      }

      const generatedText = data.choices[0].text.trim();
      console.log("Generated Analysis:", generatedText);

      return {
        analysis: generatedText,
        model: data.model,
        usage: data.usage,
        created: data.created,
        id: data.id,
      };
    } catch (error) {
      console.error(`Token analysis error (attempt ${retries + 1}/${maxRetries}):`, error);
      lastError = error;
      retries++;
      
      if (retries < maxRetries) {
        await wait(2000 * retries);
        continue;
      }
      
      throw new Error(`AI token analysis error: ${error.message}`);
    }
  }
  
  throw lastError || new Error("Unknown error in AI token analysis");
};

// =============================================================================
// EXPORTS
// =============================================================================

export const getCoinCategories = () => COIN_CATEGORIES;

export { retryOperation };
