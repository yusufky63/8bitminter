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

// Ortam değişkeninden API key'ini alır, yoksa hata döndürür
const getApiKey = () => {
  const apiKey = process.env.NEXT_PUBLIC_TOGETHER_API_KEY;
  if (!apiKey) {
    console.error("Together API key is missing from environment variables");
    throw new Error("API key is required. Please set NEXT_PUBLIC_TOGETHER_API_KEY in your environment variables.");
  }
  return apiKey;
};

/**
 * AI text generation function with category context
 */
export const generateTextWithAI = async (selectedCategory = null, userDescription = "") => {
  console.log("Starting text generation with inputs:", { selectedCategory, userDescription });
  
  // Add a static flag to prevent recursive/looping calls 
  if (generateTextWithAI.isRunning) {
    console.warn("Text generation is already running - preventing recursive call");
    throw new Error("Text generation service is busy. Please try again later.");
  }
  
  generateTextWithAI.isRunning = true;
  
  try {
    // Retry counter for API calls
    let retries = 0;
    const maxRetries = 3;
    let lastError = null;

    // List of models - will switch to others if primary model fails
    const models = [
      "meta-llama/Llama-3.1-8B-Instruct-Turbo-Free", // Using smaller model to start
      "mistralai/Mixtral-8x7B-Instruct-v0.1"
    ];
    
    // Validate API key
    const TOGETHER_API_KEY = getApiKey();

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

        // Create a shorter prompt for more reliability
        const prompt = `Design a cryptocurrency for category "${category.name}" with description: "${userDescription}".
Return only valid JSON with name, symbol (3-4 letters), and description (exactly 20 words, no more).
Format: {"name":"coin name","symbol":"SYM","description":"A brief description...","category":"${category.name}"}`;

        // Use direct fetch to external API instead of proxy
        const apiUrl = "https://api.together.xyz/v1/completions";
        
        console.log("Sending request to external API directly");
        
        // Timeout kontrolü ekle
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 saniye timeout
        
        try {
          const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TOGETHER_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: model,
              prompt: prompt,
              max_tokens: 300,
              temperature: 0.7,
              top_p: 0.9,
              frequency_penalty: 0.0,
              presence_penalty: 0.0,
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const statusCode = response.status;
            
            // Log API errors
            console.error(`API Error (${statusCode}):`, errorData);
            
            // Özel hata mesajları
            if (statusCode === 401 || statusCode === 403) {
              throw new Error("API key is invalid or expired. Please check your API key.");
            } else if (statusCode === 429) {
              throw new Error("Rate limit exceeded. Please try again later.");
            } else if (statusCode >= 500) {
              throw new Error("Together API server error. Please try again later.");
            }
            
            throw new Error(
              errorData.error?.message || 
              `API Error: ${response.status} - ${response.statusText}`
            );
          }

          const data = await response.json();
          console.log("API Response received");

          // Empty response check - will retry in this case
          if (!data.choices || !data.choices.length || !data.choices[0].text || data.choices[0].text.trim() === "") {
            console.warn("Empty API response, retrying...");
            retries++;
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
            continue;
          }

          let generatedText = data.choices[0].text.trim();
          console.log("Generated text length:", generatedText.length);

          try {
            // Attempt to extract JSON from the response
            const jsonMatch = generatedText.match(/\{.*\}/s);
            if (jsonMatch) {
              generatedText = jsonMatch[0];
            }
            
            // Parse the JSON
            const result = JSON.parse(generatedText);
            
            // Basic validation
            if (!result.name || !result.symbol || !result.description) {
              throw new Error("Missing required fields in generated content");
            }
            
            // Limit description to exactly 20 words
            const words = result.description.split(/\s+/);
            const limitedDescription = words.slice(0, 20).join(' ');
            
            // Return successful result
            return {
              name: result.name,
              symbol: result.symbol.toUpperCase(),
              description: limitedDescription,
              category: category.name,
              features: category.features
            };
          } catch (parseError) {
            console.error("Error parsing AI response:", parseError);
            retries++;
            await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
            continue;
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === 'AbortError') {
            console.error("Request timed out");
            throw new Error("API request timed out after 20 seconds");
          }
          
          throw fetchError;
        }
      } catch (error) {
        console.error("AI text generation error:", error);
        lastError = error;
        retries++;
        await new Promise(r => setTimeout(r, 2000)); // Wait 2 seconds
      }
    }

    // All retries failed - throw error instead of returning fallback data
    console.error("All AI text generation attempts failed:", lastError);
    throw new Error(`Text generation failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
  } finally {
    // Always make sure to reset the running flag when done
    generateTextWithAI.isRunning = false;
  }
}

/**
 * AI image generation with real API integration only
 */
export const generateImageWithAI = async (
  name,
  symbol,
  description,
  categoryContext = null
) => {
  console.log("Starting AI image generation...");
  console.log("Inputs:", { name, symbol, description });
  
  // Add a static flag to prevent recursive/looping calls 
  if (generateImageWithAI.isRunning) {
    console.warn("Image generation is already running - preventing recursive call");
    throw new Error("Image generation service is busy. Please try again later.");
  }
  
  generateImageWithAI.isRunning = true;
  
  try {
    // Validate API key
    const TOGETHER_API_KEY = getApiKey();
    
    // Extract category information or use defaults
    const category = categoryContext ? categoryContext.name : "token";
    
    // Build a prompt that emphasizes pixel art style
    const prompt = `Pixel art style cryptocurrency token logo for "${name}" (${symbol}). Category: ${category}. ${description ? `Theme: ${description}` : ""}. 8-bit retro style, arcade-inspired, pixelated, nostalgic game art, limited color palette, chunky pixels, clean edges, resembling old video games from the 80s and 90s.`;
    
    console.log("Image generation prompt (pixel art style):", prompt);
    
    // Implement retry logic for image generation
    const maxAttempts = 2; // Reduce retries to avoid excessive API calls
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`Image generation attempt ${attempt}/${maxAttempts}`);
        
        // Timeout kontrolü ekle
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 saniye timeout (görsel için daha uzun)
        
        try {
          const response = await fetch("https://api.together.xyz/v1/images/generations", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${TOGETHER_API_KEY}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              model: "black-forest-labs/FLUX.1-schnell-Free", // Use SDXL for better pixel art
              prompt: prompt,
              width: 512,
              height: 512,
              n: 1,
              response_format: "url",
              negative_prompt: "text, words, letters, numbers, low quality, blurry, realistic, photorealistic, 3D rendering, shading, high resolution details, smooth gradients",
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            const statusCode = response.status;
            let errorText = "";
            
            try {
              const errorJson = await response.json();
              errorText = JSON.stringify(errorJson);
              console.error(`Image API Error (${statusCode}):`, errorJson);
            } catch (e) {
              errorText = await response.text();
              console.error(`Image API Error (${statusCode}):`, errorText);
            }
            
            // Özel hata mesajları
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
          console.log("Image API response received", data);
          
          // Validate the API response data
          if (!data.data || !data.data[0] || !data.data[0].url) {
            throw new Error("Invalid API response format");
          }
          
          const imageUrl = data.data[0].url;
          
          // Success - check that it's a valid URL
          if (imageUrl && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
            return imageUrl;
          } else {
            throw new Error("Generated URL is invalid");
          }
        } catch (fetchError) {
          clearTimeout(timeoutId);
          
          if (fetchError.name === 'AbortError') {
            console.error("Image request timed out");
            throw new Error("Image API request timed out after 30 seconds");
          }
          
          throw fetchError;
        }
      } catch (error) {
        lastError = error;
        console.error(`Image generation attempt ${attempt}/${maxAttempts} failed:`, error);
        
        if (attempt < maxAttempts) {
          // Wait before retry
          console.log(`Waiting 3 seconds before retry...`);
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }
    
    // All attempts failed - throw an error
    throw new Error(`Failed to generate image: ${lastError?.message || "Unknown error"}`);
  } finally {
    // Always ensure the running flag is reset
    generateImageWithAI.isRunning = false;
  }
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
        } catch (e) {
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
          } catch (e) {
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
          } catch (e) {
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
          } catch (e) {
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

      // Use the unified API endpoint for text generation
      const response = await fetch("/api/together", {
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
