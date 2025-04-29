
// Cache için basit bir in-memory store
const priceCache = {
    eth: {
      price: null,
      lastUpdated: null,
      ttl: 60000, // 1 dakika cache süresi
    },
  };
  
  /**
   * Cache'in geçerli olup olmadığını kontrol eder
   * @param {string} key - Cache anahtarı
   * @returns {boolean} Cache geçerli mi?
   */
  const isCacheValid = (key) => {
    const cache = priceCache[key];
    if (!cache.lastUpdated) return false;
    
    const now = Date.now();
    return now - cache.lastUpdated < cache.ttl;
  };
  
  /**
   * CoinGecko API'sinden ETH fiyatını getirir
   * @returns {Promise<number>} ETH price
   */
  const getETHPriceFromCoinGecko = async () => {
    try {
      const response = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      
      if (!response.ok) {
        throw new Error("CoinGecko API hatası");
      }
      
      const data = await response.json();
      return data.ethereum.usd;
    } catch (error) {
      console.error("CoinGecko fiyat hatası:", error);
      throw error;
    }
  };
  
  /**
   * Coinbase API'sinden ETH fiyatını getirir
   * @returns {Promise<number>} ETH fiyatı (USD)
   */
  const getETHPriceFromCoinbase = async () => {
    try {
      const response = await fetch(
        "https://api.coinbase.com/v2/prices/ETH-USD/spot"
      );
      
      if (!response.ok) {
        throw new Error("Coinbase API hatası");
      }
      
      const data = await response.json();
      return parseFloat(data.data.amount);
    } catch (error) {
      console.error("Coinbase fiyat hatası:", error);
      throw error;
    }
  };
  
  /**
   * ETH fiyatını getirir (önce cache'den, geçersizse API'lerden)
   * @returns {Promise<number>} ETH fiyatı (USD)
   */
  export const getETHPrice = async () => {
    try {
      // Cache kontrolü
      if (isCacheValid("eth")) {
        return priceCache.eth.price;
      }
      
      // Her iki API'den paralel olarak fiyat al
      const [coinGeckoPrice, coinbasePrice] = await Promise.allSettled([
        getETHPriceFromCoinGecko(),
        getETHPriceFromCoinbase(),
      ]);
      
      let price = null;
      
      // CoinGecko başarılıysa onu kullan
      if (coinGeckoPrice.status === "fulfilled") {
        price = coinGeckoPrice.value;
      }
      // CoinGecko başarısız ama Coinbase başarılıysa onu kullan
      else if (coinbasePrice.status === "fulfilled") {
        price = coinbasePrice.value;
      }
      // Her iki API de başarısızsa hata fırlat
      else {
        throw new Error("Fiyat bilgisi alınamadı");
      }
      
      // Cache'i güncelle
      priceCache.eth = {
        price,
        lastUpdated: Date.now(),
        ttl: 60000,
      };
      
      return price;
    } catch (error) {
      console.error("ETH fiyat getirme hatası:", error);
      throw error;
    }
  };
  