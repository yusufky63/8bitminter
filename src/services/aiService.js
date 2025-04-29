import { processTtlgenHerImage } from './imageUtils';

const MAX_RETRIES = 3;

// Different coin categories and their characteristics
const COIN_CATEGORIES = [
  {
    name: "DeFi (Decentralized Finance)", 
    features: "Decentralized lending, liquidity pools, yield farming, staking, tokenized assets",
    themes: "Finance, economics, banking, investment",
  },
  {
    name: "GameFi (Gaming)",
    features: "Play-to-earn, NFT game assets, character progression, virtual economy, tournaments",
    themes: "Gaming, entertainment, competition, rewards",
  },
  {
    name: "SocialFi (Social Media)",
    features: "Content rewards, social interactions, community management, influencer economy",
    themes: "Social media, communication, community, engagement",
  },
  {
    name: "GreenTech (Environmental)",
    features: "Carbon credits, sustainable projects, environmental protection incentives, renewable energy",
    themes: "Environment, sustainability, green energy, nature",
  },
  {
    name: "AI & ML (Artificial Intelligence)",
    features: "AI model tokenization, data marketplace, machine learning incentives, autonomous systems",
    themes: "Artificial intelligence, technology, innovation, automation",
  },
  {
    name: "NFT & Digital Art",
    features: "Art tokenization, artist royalties, collection management, digital galleries",
    themes: "Art, creativity, collection, culture",
  },
  {
    name: "Metaverse & VR",
    features: "Virtual real estate, digital assets, avatar customization, virtual events",
    themes: "Virtual reality, digital world, interaction, experience",
  },
  {
    name: "IoT (Internet of Things)",
    features: "Device networks, sensor data, smart contracts, automation systems",
    themes: "Connectivity, automation, smart devices, data",
  },
  {
    name: "Privacy & Security",
    features: "Private transactions, data encryption, secure communication, identity verification",
    themes: "Privacy, security, protection, encryption",
  },
  {
    name: "DAO & Governance",
    features: "Community management, voting systems, protocol governance, incentive mechanisms",
    themes: "Governance, democracy, decision-making, community",
  },
];

// Export categories for external use
export const getCoinCategories = () => COIN_CATEGORIES;

/**
 * AI text generation function with category context
 */
export const generateTextWithAI = async (selectedCategory = null, userDescription = "") => {
  // Retry counter for API calls
  let retries = 0;
  const maxRetries = 3;
  let lastError = null;

  // List of models - will switch to others if primary model fails
  const models = [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "mistralai/Mixtral-8x7B-Instruct-v0.1"
  ];

  while (retries < maxRetries) {
    try {
      // Use selected category or pick random
      const category = selectedCategory
        ? COIN_CATEGORIES.find((cat) => cat.name === selectedCategory)
        : COIN_CATEGORIES[Math.floor(Math.random() * COIN_CATEGORIES.length)];

      if (!category) {
        throw new Error("Category not found");
      }

      // Determine model to use - change model based on error count
      const modelIndex = Math.min(retries, models.length - 1);
      const model = models[modelIndex];
      console.log(`AI Text Generation - Attempt ${retries + 1}/${maxRetries}, Model: ${model}`);

      // Create simplified prompt for text generation
      const prompt = `Design a cryptocurrency for the following user description:

User's Token Idea: "${userDescription}"

Category: "${category.name}"
Features: ${category.features}

Create a token with:
1. Name: Memorable & unique (max 20 chars)
2. Symbol: 3-4 capital letters
3. Description: Brief value proposition (30-50 words max)

IMPORTANT: Provide ONLY this JSON format with no additional text:
{
  "name": "coin name",
  "symbol": "SYM",
  "description": "Very brief description",
  "category": "${category.name}"
}`;

      // Use unified API endpoint for Together AI
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
      
      const response = await fetch(`${baseUrl}/api/together`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          max_tokens: 250, // Reduced from 500 to enforce shorter responses
          temperature: 0.8,
          top_p: 0.95,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          stop: ["}"],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          `API Error: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Empty response check - will retry in this case
      if (!data.choices || !data.choices.length || !data.choices[0].text || data.choices[0].text.trim() === "") {
        console.warn("Empty API response, retrying...");
        retries++;
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
        continue;
      }

      let generatedText = data.choices[0].text.trim();
      console.log("Generated Text:", generatedText);

      // Check for missing opening brace - add if needed
      if (!generatedText.includes("{")) {
        generatedText = `{\n${generatedText}`;
      }
      
      // Add closing brace if missing
      if (!generatedText.endsWith("}")) {
        generatedText = `${generatedText}\n}`;
      }

      try {
        // Clean JSON format
        generatedText = generatedText
          .replace(/```json\n/g, "") // Remove JSON block start
          .replace(/```/g, "") // Remove remaining backticks
          .replace(/^\s*{\s*/, "{") // Remove leading whitespace
          .replace(/\s*}\s*$/, "}") // Remove trailing whitespace
          .trim();

        // Protected JSON parse - will try manual parsing if error
        let result;
        try {
          result = JSON.parse(generatedText);
        } catch (jsonError) {
          // JSON parse error - try to extract fields manually
          console.warn("JSON parse error, attempting manual parsing...", jsonError);
          
          // Extract fields with regex
          const nameMatch = generatedText.match(/"name"\s*:\s*"([^"]+)"/);
          const symbolMatch = generatedText.match(/"symbol"\s*:\s*"([^"]+)"/);
          const descMatch = generatedText.match(/"description"\s*:\s*"([^"]+)"/);
          
          if (nameMatch && symbolMatch && descMatch) {
            result = {
              name: nameMatch[1],
              symbol: symbolMatch[1],
              description: descMatch[1],
              category: category.name,
              features: category.features,
              themes: category.themes
            };
          } else {
            throw new Error("Manual parsing failed");
          }
        }

        // Validate results
        if (!result.name || !result.symbol || !result.description) {
          // Fill missing fields with defaults
          if (!result.name) result.name = "CryptoCoin";
          if (!result.symbol) result.symbol = "COIN";
          if (!result.description) result.description = `A revolutionary cryptocurrency for the ${category.name} space.`;
        }

        // Check symbol format
        if (!/^[A-Z]{3,4}$/.test(result.symbol)) {
          result.symbol = result.symbol
            .toUpperCase()
            .replace(/[^A-Z]/g, "")
            .slice(0, 4);
          if (result.symbol.length < 3) {
            // If shorter than 3 chars, derive from coin name
            const nameInitials = result.name
              .split(' ')
              .map(word => word[0])
              .join('')
              .toUpperCase()
              .slice(0, 4);
            
            result.symbol = nameInitials.length >= 3 ? nameInitials : "COIN";
          }
        }

        // Add API response data
        return {
          ...result,
          model: data.model,
          usage: data.usage,
          created: data.created,
          id: data.id,
          frequency_penalty: data.frequency_penalty,
          max_tokens: data.max_tokens,
          presence_penalty: data.presence_penalty,
          prompt: data.prompt,
          stop: data.stop,
          stream: data.stream,
          temperature: data.temperature,
          top_p: data.top_p,
        };
      } catch (parseError) {
        console.error("JSON parse error:", parseError);
        console.error("Invalid text:", generatedText);
        retries++;
        
        if (retries >= maxRetries) {
          // If last attempt fails, return default values
          console.log("All attempts failed. Generating manual coin information.");
          
          // Create result with default values
          return {
            name: "CryptoVerse",
            symbol: "CVT",
            description: `A revolutionary cryptocurrency for the ${category.name} ecosystem. Offering innovative solutions with secure and scalable infrastructure.`,
            category: category.name,
            features: category.features,
            themes: category.themes,
            model: model,
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            created: Date.now(),
            id: "manual_fallback",
            frequency_penalty: 0.5,
            max_tokens: 500,
            presence_penalty: 0.5,
            temperature: 0.8,
            top_p: 0.95,
          };
        }
        
        // Wait and retry
        await new Promise(r => setTimeout(r, 2000 * retries));
        continue;
      }
    } catch (error) {
      console.error(`Text generation error (attempt ${retries + 1}/${maxRetries}):`, error);
      lastError = error;
      retries++;
      
      // Retry if not last attempt
      if (retries < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * retries));
        continue;
      }
      
      // If all attempts fail
      throw new Error(`AI text generation error: ${error.message}`);
    }
  }
  
  // If we reach here, all attempts failed
  throw lastError || new Error("Unknown error in AI text generation");
};

/**
 * AI image generation function with category and text context
 */
export const generateImageWithAI = async (
  promptOrName,
  symbol = "",
  description = "",
  categoryContext = null
) => {
  const generateImage = async () => {
    try {
      console.log("Starting AI image generation...");
      
      // Check if only one parameter was passed (the full prompt)
      let imagePrompt;
      
      if (typeof promptOrName === 'string' && !symbol && !description) {
        // Single parameter mode - use promptOrName directly as the full prompt
        imagePrompt = promptOrName;
      } else {
        // Multi-parameter mode - construct the prompt from individual parts
        // Extract core concepts from description
        const descriptionWords = description && typeof description === 'string'
          ? description
              .replace(/\([^)]*\)/g, '') // Remove text in parentheses like "(Created by AI)"
              .split(/\s+/)
              .filter(word => word.length > 3) // Only meaningful words
              .slice(0, 10) // Take up to 10 significant words
              .join(' ')
          : "";
        
        // Create style prompt based on category context
        const stylePrompt = categoryContext ? 
          `Style inspiration from ${categoryContext.themes}. Features focusing on ${categoryContext.features}.` : 
          "Style: Contemporary digital art, abstract, creative, high-end crypto aesthetic.";
        
        // Build the main image prompt
        imagePrompt = `Create a unique and artistic NFT-style digital artwork for ${promptOrName} (${symbol}). 
The token concept is about: ${descriptionWords}.
${stylePrompt}

The artwork should be:
- Professional and visually striking
- Simple yet memorable with distinctive elements
- Suitable as a token logo that works at different sizes
- Rich with vibrant colors for both light and dark backgrounds
- Reflecting the token's purpose and core features

Features: Rich textures, dynamic compositions, ethereal elements, innovative artistic expression.
Include: Generative art elements, abstract patterns, digital manipulation effects.
Colors: Vibrant and harmonious color palette with deep contrasts.

NO TEXT in the image.`;
      }

      console.log("Image generation prompt:", imagePrompt);

      // Determine base URL for API
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

      // Use Replicate API instead of Together API
      console.log("Using Replicate API for image generation");
      const replicateResponse = await fetch(`${baseUrl}/api/replicate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: imagePrompt,
          // Stable Diffusion XL - çok daha yüksek kaliteli görüntüler oluşturur
          version: "c221b2b8ef527988fb59bf24a8b97c4561f1c671f73bd389f866bfb27c061316",
          input: {
            prompt: imagePrompt,
            negative_prompt: "ugly, disfigured, low quality, blurry, nsfw, text, watermark, logo, signature",
            width: 768,
            height: 768,
            num_inference_steps: 40,
            guidance_scale: 9,
            refine: "expert_ensemble_refiner",
            high_noise_frac: 0.8,
            scheduler: "K_EULER_ANCESTRAL",
            apply_watermark: false
          }
        }),
      });

      if (!replicateResponse.ok) {
        const errorData = await replicateResponse.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Replicate API Error: ${replicateResponse.status}`
        );
      }

      const predictionData = await replicateResponse.json();
      console.log("Replicate prediction started:", predictionData);

      // Poll for prediction result
      let result = predictionData;
      let attempts = 0;
      const maxAttempts = 30; // Maximum number of polling attempts (5 min timeout)

      while (
        (result.status === "starting" || result.status === "processing") &&
        attempts < maxAttempts
      ) {
        console.log(`Waiting for image generation... Attempt ${attempts + 1}/${maxAttempts}`);
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second intervals
        
        const statusResponse = await fetch(`${baseUrl}/api/replicate?id=${result.id}`);
        if (!statusResponse.ok) {
          const statusError = await statusResponse.json().catch(() => ({}));
          console.warn("Status check error:", statusError);
          attempts++;
          continue;
        }
        
        result = await statusResponse.json();
        attempts++;
      }
      
      if (result.status !== "succeeded" || !result.output || !result.output.length) {
        throw new Error(`Image generation failed: ${result.error || "Unknown error"}`);
      }

      // Get the image URL from the result
      const imageUrl = result.output[0];
      console.log("Generated image URL:", imageUrl);
      
      if (!imageUrl) {
        throw new Error("No image URL in response");
      }

      // Process image and upload to IPFS using imported function
      const processedUrl = await processTtlgenHerImage(imageUrl);
      console.log("Processed image URL:", processedUrl);
      
      return processedUrl;
    } catch (error) {
      console.error("Image generation attempt failed:", error);
      throw error;
    }
  };

  // Implement retry mechanism with rate limit consideration
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Image generation attempt ${attempt}/${MAX_RETRIES}`);
      return await generateImage();
    } catch (error) {
      lastError = error;

      // If it's the last attempt or a user rejection, throw immediately
      if (attempt === MAX_RETRIES || error.message?.includes("user rejected")) {
        console.error("Image generation failed after all attempts:", error);
        throw error;
      }

      // For rate limit errors, wait longer
      const isRateLimit = error.message?.toLowerCase().includes("rate limit") || 
                          error.message?.includes("429") ||
                          error.message?.includes("Too Many Requests");
                          
      const delay = isRateLimit
        ? Math.min(60000 * attempt, 120000) // Wait 1-2 minutes for rate limit with increasing delay
        : Math.min(2000 * Math.pow(2, attempt - 1), 10000); // Normal exponential backoff capped at 10s

      console.log(`Waiting ${delay / 1000} seconds before retry...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // If we get here, all retries failed
  console.error("All image generation attempts failed:", lastError);
  throw lastError;
};

/**
 * Retry mechanism
 */
export const retryOperation = async (
  operation,
  context,
  handleError,
  retries = MAX_RETRIES
) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error) {
      console.error(
        `${context} attempt ${i + 1}/${retries} failed:`,
        error
      );

      if (i === retries - 1) {
        // Last attempt
        handleError(error, context);
        throw error;
      }

      // If user rejected, don't retry
      if (error.message?.includes("user rejected")) {
        handleError(error, context);
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1))); // Increasing wait time
    }
  }
};

/**
 * AI token analysis function - analyzes a token and answers user questions
 */
export const analyzeTokenWithAI = async (tokenData, userQuestion, onchainData = null) => {
  // Retry counter for API calls
  let retries = 0;
  const maxRetries = 3;
  let lastError = null;

  // List of models - will switch to others if primary model fails
  const models = [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "mistralai/Mixtral-8x7B-Instruct-v0.1"
  ];

  while (retries < maxRetries) {
    try {
      // Determine model to use - change model based on error count
      const modelIndex = Math.min(retries, models.length - 1);
      const model = models[modelIndex];
      console.log(`AI Token Analysis - Attempt ${retries + 1}/${maxRetries}, Model: ${model}`);

      // Extract dates and format them properly
      const formatDate = (dateString) => {
        if (!dateString) return "Unknown";
        try {
          return new Date(dateString).toLocaleDateString();
        } catch (error) {
          console.log("Date formatting error:", error.message);
          return dateString;
        }
      };
      
      // Format numbers with commas
      const formatNumber = (num) => {
        if (num === undefined || num === null) return "Unknown";
        if (typeof num === 'string') num = parseFloat(num);
        return num.toLocaleString();
      };
      
      // Calculate price from market cap and total supply if possible
      const calculatePrice = () => {
        if (tokenData.marketCap && tokenData.totalSupply) {
          try {
            const price = parseFloat(tokenData.marketCap) / parseFloat(tokenData.totalSupply);
            return price.toFixed(8);
          } catch (error) {
            console.log("Price calculation error:", error.message);
            return "Unknown";
          }
        }
        return "Unknown";
      };
      
      // Calculate engagement metrics
      const calculateEngagement = () => {
        if (tokenData.transfers?.count && tokenData.uniqueHolders) {
          try {
            const txPerHolder = parseFloat(tokenData.transfers.count) / parseFloat(tokenData.uniqueHolders);
            return txPerHolder.toFixed(2);
          } catch (error) {
            console.log("Engagement calculation error:", error.message);
            return "Unknown";
          }
        }
        return "Unknown";
      };
      
      // Calculate 24h change percentage
      const calculate24hChange = () => {
        if (tokenData.marketCapDelta24h && tokenData.marketCap) {
          try {
            const currentMC = parseFloat(tokenData.marketCap);
            const delta = parseFloat(tokenData.marketCapDelta24h);
            const previousMC = currentMC - delta;
            if (previousMC <= 0) return "0%";
            const changePercent = (delta / previousMC) * 100;
            return changePercent.toFixed(2) + "%";
          } catch (error) {
            console.log("24h change calculation error:", error.message);
            return "Unknown";
          }
        }
        return "Unknown";
      };

      // Prepare token data for AI context with all available metrics
      const tokenSummary = {
        name: tokenData.name || "Unknown",
        symbol: tokenData.symbol || "???",
        description: tokenData.description ? (tokenData.description.length > 200 ? 
                    tokenData.description.substring(0, 200) + "..." : 
                    tokenData.description) : "No description",
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
        age: tokenData.createdAt ? 
              Math.floor((new Date() - new Date(tokenData.createdAt)) / (1000 * 60 * 60 * 24)) + " days" : 
              "Unknown",
      };

      // Onchain data section - only include if available
      let onchainSummary = "";
      if (onchainData && Object.keys(onchainData).length > 0) {
        const formatValue = (value) => {
          if (!value) return "Unknown";
          if (value.formatted) return value.formatted;
          if (typeof value === 'bigint') return value.toString();
          return String(value);
        };
        
        onchainSummary = `
Onchain Data:
- Liquidity: ${formatValue(onchainData.liquidity)} (USD: ${formatValue(onchainData.liquidity?.usdcDecimal || onchainData.liquidityUSD || 0)})
- Total Supply: ${formatValue(onchainData.totalSupply)}
- Unique Holders: ${onchainData.owners?.length || 0}
- Pool Address: ${onchainData.pool || "Unknown"}
`;
      }

      // Check if the question is about investment potential
      const isInvestmentQuestion = userQuestion.toLowerCase().includes("invest") || 
                                  userQuestion.toLowerCase().includes("good investment") || 
                                  userQuestion.toLowerCase().includes("worth") ||
                                  userQuestion.toLowerCase().includes("potential") ||
                                  userQuestion.toLowerCase().includes("buy");
      
      // Create structured prompt with all available metrics
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

      // Add special instructions for investment questions
      if (isInvestmentQuestion) {
        prompt += `\n\nINVESTMENT ANSWER: Start with ONE of these exact options: "Yes", "No", "Maybe", "It depends", "Unlikely", or "Insufficient data". Then provide 2-3 sentences explaining your evaluation based on the metrics above.

IMPORTANT: Your analysis should focus on the token's fundamental metrics, holder activity, community engagement, and price action. Avoid speculation about future price movements, but evaluate the current state of the token based on available data only.`;
      } else {
        prompt += `\n\nANSWER: Provide a direct and detailed answer to the user's specific question, referencing the relevant metrics above.

IMPORTANT: Your entire response must be under 250 words. Focus on the data while being educational and informative. Only use the data that is provided - do not make up or assume data that isn't present.`;
      }

      console.log("Sending prompt with length:", prompt.length);

      // Determine base URL for API
      const baseUrl = typeof window !== 'undefined' 
        ? window.location.origin 
        : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

      // Use the unified API endpoint for text generation
      const response = await fetch(`${baseUrl}/api/together`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          prompt: prompt,
          max_tokens: 400, // Increased for more detailed answers
          temperature: 0.7,
          top_p: 0.95,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          `API Error: ${response.status} - ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("API Response:", data);

      // Empty response check - will retry in this case
      if (!data.choices || !data.choices.length || !data.choices[0].text || data.choices[0].text.trim() === "") {
        console.warn("Empty API response, retrying...");
        retries++;
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
        continue;
      }

      const generatedText = data.choices[0].text.trim();
      console.log("Generated Analysis:", generatedText);

      // Return the analysis with metadata
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
      
      // Retry if not last attempt
      if (retries < maxRetries) {
        await new Promise(r => setTimeout(r, 2000 * retries));
        continue;
      }
      
      // If all attempts fail
      throw new Error(`AI token analysis error: ${error.message}`);
    }
  }
  
  // If we reach here, all attempts failed
  throw lastError || new Error("Unknown error in AI token analysis");
};
