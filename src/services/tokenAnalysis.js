const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const analyzeTokenWithAI = async (tokenData, userQuestion, onchainData = null) => {
  let retries = 0;
  const maxRetries = 3;
  let lastError = null;
  const models = [
    "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
    "mistralai/Mixtral-8x7B-Instruct-v0.1",
  ];

  while (retries < maxRetries) {
    try {
      const model = models[Math.min(retries, models.length - 1)];

      const formatDate = (dateString) => {
        if (!dateString) return "Unknown";
        try {
          return new Date(dateString).toLocaleDateString();
        } catch {
          return dateString;
        }
      };

      const formatNumber = (num) => {
        if (num === undefined || num === null) return "Unknown";
        const value = typeof num === "string" ? parseFloat(num) : num;
        return Number.isFinite(value) ? value.toLocaleString() : "Unknown";
      };

      const calculatePrice = () => {
        if (!tokenData.marketCap || !tokenData.totalSupply) return "Unknown";
        const marketCap = parseFloat(tokenData.marketCap);
        const supply = parseFloat(tokenData.totalSupply);
        return Number.isFinite(marketCap) && Number.isFinite(supply) && supply > 0
          ? (marketCap / supply).toFixed(8)
          : "Unknown";
      };

      const calculate24hChange = () => {
        if (!tokenData.marketCapDelta24h || !tokenData.marketCap) return "Unknown";
        const currentMC = parseFloat(tokenData.marketCap);
        const delta = parseFloat(tokenData.marketCapDelta24h);
        const previousMC = currentMC - delta;
        if (!Number.isFinite(previousMC) || previousMC <= 0) return "0%";
        return `${((delta / previousMC) * 100).toFixed(2)}%`;
      };

      const tokenSummary = {
        name: tokenData.name || "Unknown",
        symbol: tokenData.symbol || "???",
        price: calculatePrice(),
        marketCap: formatNumber(tokenData.marketCap),
        marketCap24hChange: calculate24hChange(),
        holders: formatNumber(tokenData.uniqueHolders),
        totalSupply: formatNumber(tokenData.totalSupply),
        volume24h: formatNumber(tokenData.volume24h),
        totalVolume: formatNumber(tokenData.totalVolume),
        transfers: formatNumber(tokenData.transfers?.count),
        comments: formatNumber(tokenData.zoraComments?.count),
        created: formatDate(tokenData.createdAt),
        age: tokenData.createdAt
          ? `${Math.floor((Date.now() - new Date(tokenData.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days`
          : "Unknown",
      };

      const onchainSummary = onchainData && Object.keys(onchainData).length > 0
        ? `
Onchain Data:
- Liquidity: ${onchainData.liquidity?.formatted || onchainData.liquidityUSD || "Unknown"}
- Pool Address: ${onchainData.pool || "Unknown"}
`
        : "";

      const isInvestmentQuestion =
        userQuestion?.toLowerCase?.().includes("invest") ||
        userQuestion?.toLowerCase?.().includes("good investment") ||
        userQuestion?.toLowerCase?.().includes("worth") ||
        userQuestion?.toLowerCase?.().includes("potential") ||
        userQuestion?.toLowerCase?.().includes("buy");

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

      prompt += isInvestmentQuestion
        ? `\n\nINVESTMENT ANSWER: Start with ONE of these exact options: "Yes", "No", "Maybe", "It depends", "Unlikely", or "Insufficient data". Then provide 2-3 sentences explaining your evaluation based on the metrics above.`
        : `\n\nANSWER: Provide a direct and detailed answer to the user's specific question, referencing the relevant metrics above. Keep the response under 250 words.`;

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
        throw new Error(errorData.error?.message || errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      const generatedText = data?.choices?.[0]?.text?.trim();
      if (!generatedText) {
        retries++;
        await wait(2000);
        continue;
      }

      return {
        analysis: generatedText,
        model: data.model,
        usage: data.usage,
        created: data.created,
        id: data.id,
      };
    } catch (error) {
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
