/**
 * Together API'dan görsel indirme ve IPFS'e yükleme için yardımcı fonksiyonlar
 */

import { storeToIPFS } from "./pinata";

// Helper function to get the base URL
const getBaseUrl = () => {
  return typeof window !== 'undefined' 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
};

/**
 * Together API'dan gelen görseli indirir ve IPFS'e yükler
 * @param {string} originalUrl Together API'dan alınan orijinal görsel URL'si
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function downloadImageAndUploadToIPFS(originalUrl) {
  try {
    console.log("Görsel indiriliyor:", originalUrl);

    // 1. Together API URL'sini kendi API endpoint'imiz üzerinden yönlendir
    const baseUrl = getBaseUrl();
    const proxyUrl = `${baseUrl}/api/together?url=${encodeURIComponent(originalUrl)}`;

    // 2. Proxy üzerinden görsel indir (CORS sorunu olmadan)
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Görsel indirme hatası:", errorData);
      throw new Error(`Görsel indirme hatası: ${response.status}`);
    }

    // 3. Blob olarak al
    const imageBlob = await response.blob();
    console.log("Görsel indirildi, boyut:", imageBlob.size);

    if (imageBlob.size === 0) {
      throw new Error("İndirilen görsel verisi boş");
    }

    // 4. IPFS'e yükle
    const ipfsResult = await storeToIPFS(imageBlob);
    console.log("IPFS yükleme başarılı:", ipfsResult);

    // 5. IPFS URI kontrolü ve döndürme
    if (!ipfsResult || !ipfsResult.url) {
      throw new Error("IPFS yükleme sonucu geçersiz: URL bulunamadı");
    }

    // ipfs:// formatını kontrol et
    const ipfsUri = ipfsResult.url;
    if (!ipfsUri.startsWith("ipfs://")) {
      console.warn("IPFS URI ipfs:// ile başlamıyor, düzeltiliyor:", ipfsUri);
      const hash = ipfsResult.hash || ipfsUri.split("/").pop();
      return `ipfs://${hash}`;
    }

    return ipfsUri; // ipfs://...
  } catch (error) {
    console.error("Görsel indirme ve IPFS yükleme hatası:", error);

    // Hata durumunda, orijinal URL'yi IPFS formatında döndürmeye çalış
    if (originalUrl) {
      // URL bir IPFS hash'i içeriyorsa onu kullan
      if (originalUrl.includes("/ipfs/")) {
        const hash = originalUrl.split("/ipfs/").pop();
        console.log("Hata durumunda IPFS hash extract edildi:", hash);
        return `ipfs://${hash}`;
      }

      // Direkt olarak görsel URL'sini döndür (fallback)
      console.log("Hata durumunda orijinal URL kullanılıyor");
      return originalUrl;
    }

    throw error;
  }
}

/**
 * Together API'dan metin tamamlama isteği yapar
 * @param {string} prompt İstek metni
 * @param {string} model Kullanılacak model (varsayılan: togethercomputer/llama-2-70b)
 * @returns {Promise<object>} Together API yanıtı
 */
export async function generateTextWithTogether(
  prompt,
  model = "togethercomputer/llama-2-70b"
) {
  try {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/together`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Text generation failed");
    }

    return await response.json();
  } catch (error) {
    console.error("Together API text generation error:", error);
    throw error;
  }
}

/**
 * Together API ile görsel oluşturur ve IPFS'e yükler
 * @param {string} prompt Görsel oluşturma promptu
 * @param {string} model Kullanılacak model (varsayılan: black-forest-labs/FLUX.1-schnell-Free)
 * @returns {Promise<string>} IPFS URI
 */
export async function generateAndUploadImage(
  prompt,
  model = "black-forest-labs/FLUX.1-schnell-Free"
) {
  try {
    // 1. Together API'dan görsel oluştur
    const baseUrl = getBaseUrl();
    const imageResponse = await fetch(`${baseUrl}/api/together`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        model,
        width: 768,
        height: 768,
        n: 1,
        response_format: "url",
        output_format: "png",
        negative_prompt:
          "logo, corporate design, text, letters, numbers, watermark, signature, blurry, low quality, oversaturated colors",
      }),
    });

    if (!imageResponse.ok) {
      const errorData = await imageResponse.json();
      throw new Error(errorData.error || "Image generation failed");
    }

    const data = await imageResponse.json();
    const originalImageUrl = data.data?.[0]?.url; // Updated to match expected response format

    if (!originalImageUrl) {
      throw new Error("No image URL returned from API");
    }

    // 2. Görseli indir ve IPFS'e yükle
    return await downloadImageAndUploadToIPFS(originalImageUrl);
  } catch (error) {
    console.error("Görsel oluşturma ve yükleme hatası:", error);
    throw error;
  }
}

/**
 * IPFS hash'ini görüntülenebilir bir URL'ye dönüştürür
 * @param {string} ipfsUri IPFS URI (ipfs://...)
 * @returns {string} HTTP URL
 */
export function getIPFSDisplayUrl(ipfsUri) {
  if (!ipfsUri) return '';
  
  // İpfs formatı değilse olduğu gibi döndür
  if (!ipfsUri.startsWith('ipfs://')) {
    return ipfsUri;
  }
  
  // "ipfs://" kısmını ayır ve hash'i al
  const hash = ipfsUri.slice(7);
  
  // Güvenilir ve hızlı bir gateway kullan
  return `https://gateway.pinata.cloud/ipfs/${hash}`;
}

/**
 * Download images from Together API and upload to IPFS
 * @param {string} originalUrl Together API'dan alınan orijinal görsel URL'si
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function processTtlgenHerImage(originalUrl) {
  try {
    // 1. Image URL validation
    if (!originalUrl || typeof originalUrl !== "string") {
      throw new Error("Invalid image URL");
    }

    // Detect Together API, Amazon S3 or similar temporary URLs
    if (originalUrl.includes("together.xyz") || 
        originalUrl.includes("replicate.delivery") || 
        originalUrl.includes("amazonaws.com") ||
        originalUrl.includes("blob:")) {
      try {
        // Download image through proxy and upload to IPFS
        const ipfsResult = await downloadImageAndUploadToIPFS(originalUrl);

        if (ipfsResult && ipfsResult.startsWith("ipfs://")) {
          console.log("Image successfully uploaded to IPFS:", ipfsResult);
          
          // IPFS URL'yi HTTP formatına dönüştür ve döndür, böylece browserda görüntülenebilir
          const httpUrl = getIPFSDisplayUrl(ipfsResult);
          console.log("HTTP gateway URL for display:", httpUrl);
          
          return ipfsResult; // ipfs:// formatını döndür, CoinCreator içinde gösterilecek
        } else {
          console.error("IPFS conversion failed, result:", ipfsResult);
          throw new Error("IPFS conversion returned invalid URI");
        }
      } catch (downloadError) {
        console.error("Image download or IPFS upload error:", downloadError);
        throw downloadError;
      }
    }

    // For other image types use existing process (don't change if already ipfs://)
    if (originalUrl.startsWith("ipfs://")) {
      return originalUrl;
    }

    // Upload standard URLs to IPFS as well
    console.log(
      "Standard image URL detected, will upload to IPFS:",
      originalUrl
    );
    return await downloadImageAndUploadToIPFS(originalUrl);
  } catch (error) {
    console.error("Together image processing error:", error);
    throw error; // Propagate error up
  }
}
