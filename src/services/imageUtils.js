/**
 * SDK ile doğrudan çalışmak için basitleştirilmiş image utilities
 */

import { storeToIPFS } from "./pinata";

/**
 * Görsel verisini IPFS'e yükle
 * @param {Blob|File} imageData Görsel dosyası
 * @returns {Promise<string>} IPFS URI (ipfs://...)
 */
export async function uploadImageToIPFS(imageData) {
  try {
    // Doğrudan IPFS'e yükleme
    const result = await storeToIPFS(imageData);
    
    if (!result || !result.url) {
      throw new Error("IPFS storage failed: No URL returned");
    }
    
    return result.url; // ipfs://... formatında URL döndürür
  } catch (error) {
    console.error("Error uploading image to IPFS:", error);
    throw error;
  }
}

/**
 * IPFS URI'yi HTTP URL'e dönüştürür
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
  
  // Zora uyumlu gateway kullan
  return `https://ipfs.io/ipfs/${hash}`;
}

/**
 * Validates and normalizes IPFS URIs to ensure proper format
 * @param {string} uri - URI to validate (could be IPFS URI or HTTP URL)
 * @returns {Object} Object containing validation result with properties: valid, message, and uri
 */
export function validateIpfsUri(uri) {
  if (!uri) {
    return {
      valid: false,
      message: "URI is required",
      uri: ""
    };
  }

  // If already in correct ipfs:// format, return as is
  if (uri.startsWith('ipfs://')) {
    return {
      valid: true,
      message: "URI validated",
      uri: uri
    };
  }

  // Extract IPFS hash from HTTP gateway URLs
  if (uri.includes('/ipfs/')) {
    const parts = uri.split('/ipfs/');
    if (parts.length >= 2) {
      const hash = parts[1].split('/')[0].split('?')[0];
      if (hash && hash.length > 0) {
        return {
          valid: true,
          message: "HTTP gateway URL converted to IPFS URI",
          uri: `ipfs://${hash}`
        };
      }
    }
  }

  // Handle pinata and other gateway direct links
  const uriParts = uri.split('/');
  const potentialHash = uriParts[uriParts.length - 1].split('?')[0];
  
  // Check if the last segment looks like an IPFS hash (reasonable length check)
  if (potentialHash && potentialHash.length > 20) {
    return {
      valid: true,
      message: "Direct gateway URL converted to IPFS URI",
      uri: `ipfs://${potentialHash}`
    };
  }

  // If we can't convert it, return the original URI with a warning
  console.warn(`Could not normalize URI to IPFS format: ${uri}`);
  return {
    valid: true, // Still valid but with warning
    message: "Could not convert to IPFS format, using original URI",
    uri: uri
  };
}

/**
 * Token metadata'sı oluştur ve IPFS'e yükle
 * @param {string} imageUrl Görsel URL'i (öncelikle IPFS URI olmalı)
 * @param {string} name Token adı
 * @param {string} symbol Token sembolü
 * @param {string} description Token açıklaması
 * @returns {Promise<{ipfsUrl: string, displayUrl: string}>} IPFS URI ve HTTP display URL
 */
export async function processImageAndUploadToIPFS(imageUrl, name, symbol, description) {
    try {
        // 1. Temel validasyon
        if (!imageUrl) throw new Error("Image URL is required");
        if (!name) throw new Error("Token name is required");
        if (!symbol) throw new Error("Token symbol is required");

        console.log("Processing image for IPFS upload:", { name, symbol });
        
        // 2. Basit metadata oluştur - Zora SDK formatına uygun
        const metadata = {
            name,
            symbol,
            description: description || `${name} (${symbol}) - A token created with 8BitMinter`,
            image: imageUrl
        };
        
        // 3. Metadata'yı JSON olarak IPFS'e yükle
        const metadataResult = await uploadJsonToIPFS(metadata);
        console.log("Metadata uploaded to IPFS:", metadataResult);
        
        if (!metadataResult.url) {
            throw new Error("Failed to upload metadata to IPFS");
        }
        
        // 4. IPFS URI ve HTTP URL döndür
        return {
            ipfsUrl: metadataResult.url, // ipfs:// formatında, blockchain için
            displayUrl: getIPFSDisplayUrl(imageUrl) // HTTP URL, görüntüleme için
        };
    } catch (error) {
        console.error("Failed to process image and upload to IPFS:", error);
        throw error;
    }
}

/**
 * JSON metadata'yı IPFS'e yükle
 * @param {Object} metadata Token metadata objesi
 * @returns {Promise<{url: string, hash: string}>} IPFS bilgileri
 */
export async function uploadJsonToIPFS(metadata) {
    try {
        console.log("Uploading JSON to IPFS:", metadata);
        
        // 1. JSON'ı Blob'a dönüştür
        const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], {
            type: "application/json"
        });
        
        // 2. IPFS'e yükle
        const result = await storeToIPFS(jsonBlob, `${metadata.name}_metadata.json`);
        console.log("JSON uploaded to IPFS:", result);
        
        if (!result || !result.url) {
            throw new Error("IPFS upload result is invalid");
        }
        
        return result;
    } catch (error) {
        console.error("JSON upload to IPFS failed:", error);
        throw error;
    }
}

/**
 * Together.ai'den gelen resmi işleyip, görünür URL ve IPFS-benzeri URI oluştur
 * @param {string} imageUrl - Together.ai API'den gelen resim URL'si
 * @param {string} [tokenName] - Token name
 * @param {string} [tokenSymbol] - Token symbol
 * @param {string} [tokenDescription] - Token description
 * @returns {Promise<{displayUrl: string, ipfsUri: string}>} - Görünür URL ve ipfs URI
 */
export async function processTtlgenHerImage(imageUrl, tokenName, tokenSymbol, tokenDescription) {
  try {
    console.log("Processing external image URL:", imageUrl);
    
    // URL kontrolü
    if (!imageUrl) {
      throw new Error("No image URL provided");
    }
    
    // Direkt Together.ai URL'sini displayUrl olarak kullan
    const displayUrl = imageUrl;
    
    // Metadata with actual token details (AI description is prioritized)
    const metadata = {
      name: tokenName || "Token", 
      description: tokenDescription || `${tokenName} token - Created with 8BitMinter`,
      symbol: tokenSymbol,
      image: imageUrl
    };
    
    console.log("Creating metadata with description:", tokenDescription);
    
    // Metadata JSON'ı oluştur
    const jsonBlob = new Blob([JSON.stringify(metadata)], { 
      type: 'application/json' 
    });
    
    // Direkt metadata'yı IPFS'e yükle - hiç yönlendirme olmadan
    const ipfsResult = await storeToIPFS(jsonBlob);
    
    if (!ipfsResult || !ipfsResult.url || !ipfsResult.url.startsWith('ipfs://')) {
      throw new Error("IPFS upload failed - invalid result");
      }
    
    console.log("Metadata uploaded to IPFS successfully:", ipfsResult.url);
    
    return {
      displayUrl: displayUrl,
      ipfsUri: ipfsResult.url // Doğrudan IPFS URI'yi kullan
    };
  } catch (error) {
    console.error("Error processing Together.ai image:", error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}