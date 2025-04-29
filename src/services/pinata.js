import axios from 'axios';

// Pinata API anahtarı
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT;

// Güvenilir IPFS Gateway'leri - ipfs.io'yu öncelikten düşürdük çünkü zaman aşımı yaşanıyor
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://nftstorage.link/ipfs/',
  'https://ipfs.fleek.co/ipfs/',
  'https://dweb.link/ipfs/',
];

// Cache veri yapısı - IPFS yüklemelerini önbelleğe alarak tekrarlanan yüklemeleri önlemek için
const ipfsCache = {
  metadata: new Map(), // Metadata önbelleği
  images: new Map(),   // Görsel önbelleği
  uploads: new Map()   // Yükleme işlemleri önbelleği
};

// İyileştirilmiş gateway seçimi
export const getGatewayUrl = async (hash) => {
  // İlk olarak en güvenilir gateway'i varsayılan olarak ayarla
  let bestGateway = IPFS_GATEWAYS[0];
  let fastestResponseTime = Number.MAX_SAFE_INTEGER;
  
  // Promise.race kullanarak en hızlı yanıt veren gateway'i bul
  const gatewayPromises = IPFS_GATEWAYS.map(async (gateway) => {
    try {
      const startTime = Date.now();
      const response = await fetch(`${gateway}${hash}`, { 
        method: 'HEAD', 
        timeout: 5000,
        cache: 'no-store'
      });
      
      if (response.ok) {
        const responseTime = Date.now() - startTime;
        if (responseTime < fastestResponseTime) {
          fastestResponseTime = responseTime;
          bestGateway = gateway;
        }
        return { gateway, responseTime };
      }
    } catch {
      return null;
    }
  });
  
  try {
    // 6 saniye bekledikten sonra tüm sonuçları topla
    const results = await Promise.allSettled(gatewayPromises);
    const successfulGateways = results
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .sort((a, b) => a.responseTime - b.responseTime);
    
    // En hızlı gateway'i döndür
    return successfulGateways.length > 0 ? successfulGateways[0].gateway : bestGateway;
  } catch {
    // Hata durumunda Pinata'nın gateway'ini kullan
    return bestGateway;
  }
};

// Basit görsel optimizasyonu
const optimizeImage = async (imageFile) => {
  if (!imageFile || imageFile.size <= 768 * 768) return imageFile;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  return new Promise((resolve) => {
    img.onload = () => {
      const maxSize = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob((blob) => {
        resolve(new File([blob], imageFile.name, { type: 'image/webp' }));
      }, 'image/webp', 0.85);
    };
    img.src = URL.createObjectURL(imageFile);
  });
};

// IPFS'e yükleme fonksiyonu - timeout artırıldı ve önbellek eklendi
const uploadToIPFS = async (data, options = {}) => {
  try {
    // Aynı veri için önceki yükleme işlemi varsa, onu kullan
    const cacheKey = typeof data === 'string' 
      ? data 
      : JSON.stringify(data);
    
    // Eğer bu veri daha önce yüklendiyse, cache'den döndür
    if (ipfsCache.uploads.has(cacheKey)) {
      console.log('IPFS cache hit - daha önce yüklenmiş içerik kullanılıyor');
      return ipfsCache.uploads.get(cacheKey);
    }
    
    // İşlemde olan yükleme varsa bekle
    const pendingUpload = ipfsCache.uploads.get(`pending_${cacheKey}`);
    if (pendingUpload) {
      console.log('Devam eden bir yükleme işlemi bekleniyor...');
      return pendingUpload;
    }
    
    // Yeni bir yükleme işlemi başlat ve cache'e kaydet
    const uploadPromise = new Promise((resolve, reject) => {
      // Async içindeki fonksiyonu normal function şeklinde tanımla
      const doUpload = async () => {
        try {
          console.log('IPFS yükleme işlemi başlatılıyor...');
          const response = await axios.post('https://api.pinata.cloud/pinning/pinJSONToIPFS', data, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${PINATA_JWT}`,
              ...options
            },
          });
          
          const hash = response.data.IpfsHash;
          // Başarılı sonucu cache'e kaydet
          ipfsCache.uploads.set(cacheKey, hash);
          // Pending işareti kaldır
          ipfsCache.uploads.delete(`pending_${cacheKey}`);
          
          console.log('IPFS yükleme başarılı:', hash);
          resolve(hash);
        } catch (error) {
          // Hata durumunda pending işareti kaldır
          ipfsCache.uploads.delete(`pending_${cacheKey}`);
          console.error('IPFS yükleme hatası:', error);
          reject(error);
        }
      };
      
      // Async fonksiyonu çağır
      doUpload();
    });
    
    // Pending işareti ekle
    ipfsCache.uploads.set(`pending_${cacheKey}`, uploadPromise);
    
    return uploadPromise;
  } catch (error) {
    console.error('IPFS yükleme hatası:', error);
    throw new Error('IPFS yükleme hatası');
  }
};

export const uploadImageToIPFS = async (imageFile) => {
  if (!imageFile) {
    throw new Error('Yüklenecek görsel bulunamadı');
  }
  
  try {
    // Görsel cache kontrolü - aynı görseli tekrar yüklemeyi önle
    const imageId = imageFile.name + '_' + imageFile.size;
    if (ipfsCache.images.has(imageId)) {
      console.log('Görsel cache hit - aynı görsel daha önce yüklenmiş');
      return ipfsCache.images.get(imageId);
    }
    
    const optimizedImage = await optimizeImage(imageFile);
    const formData = new FormData();
    formData.append('file', optimizedImage);
    
    const hash = await uploadToIPFS(formData, { 'Content-Type': 'multipart/form-data' });
    const imageUrl = `${IPFS_GATEWAYS[0]}${hash}`;
    
    // Cache'e kaydet
    ipfsCache.images.set(imageId, imageUrl);
    
    return imageUrl;
  } catch (error) {
    console.error('Görsel yükleme hatası:', error);
    throw new Error('Görsel yüklenemedi');
  }
};

// IPFS URL'yi ipfs:// formatına dönüştürür - Zora SDK uyumluluğu için
export const convertToIPFSFormat = (url) => {
  if (!url) return url;
  
  // Zaten ipfs:// formatındaysa değiştirme
  if (url.startsWith('ipfs://')) return url;
  
  // Gateway URL'lerinden hash'i çıkart
  let hash = '';
  if (url.includes('/ipfs/')) {
    hash = url.split('/ipfs/').pop();
  } else if (url.match(/https?:\/\/[^/]+\/[^/]+/)) {
    // gateway.domain.com/hash formatı
    hash = url.split('/').pop();
  }
  
  // Hash alınabildiyse ipfs:// formatına dönüştür
  if (hash) {
    return `ipfs://${hash}`;
  }
  
  // Dönüştürülemezse orijinal URL'yi döndür
  return url;
};

export const createAndUploadCoinMetadata = async (symbol, description, imageUrl) => {
  if (!symbol || !imageUrl) {
    throw new Error('Symbol ve image URL gereklidir');
  }

  try {
    // Improve cache key generation to be more reliable
    let cacheKeyImage = imageUrl;
    if (typeof imageUrl === 'object' && imageUrl instanceof File) {
      // For File objects, we use name and size as part of the key
      cacheKeyImage = `file:${imageUrl.name}:${imageUrl.size}`;
    }
    
    // Create a more robust cache key using all parameters
    const metadataKey = `metadata:${symbol}:${description}:${cacheKeyImage}`;
    console.log('Checking metadata cache with key:', metadataKey);
    
    // Check if we already have this metadata cached
    if (ipfsCache.metadata.has(metadataKey)) {
      console.log('Metadata cache hit - aynı metadata daha önce yüklenmiş');
      
      // Get the cached URL and ensure it's in ipfs:// format
      const cachedUrl = ipfsCache.metadata.get(metadataKey);
      const ipfsUrl = convertToIPFSFormat(cachedUrl);
      console.log('Önbellekteki metadata URL\'si kullanılıyor:', ipfsUrl);
      return ipfsUrl;
    }
    
    // If image is already in ipfs:// format, use it directly
    // Otherwise, convert HTTP URLs to ipfs:// format if possible
    let ipfsImageUrl;
    if (typeof imageUrl === 'string') {
      ipfsImageUrl = convertToIPFSFormat(imageUrl);
      console.log('Görsel URL\'si ipfs:// formatında kullanılıyor:', ipfsImageUrl);
    } else {
      // Handle File object upload - this would need separate implementation
      // For now, assume uploadImageToIPFS handles this and returns an ipfs:// URL
      console.log('Image is a File object, will be uploaded to IPFS');
      // Implementation would go here
    }
    
    // Create the metadata object
    const metadata = { 
      name: symbol, 
      description, 
      image: ipfsImageUrl || imageUrl // Use converted URL or original
    };
    
    // Upload to IPFS
    const hash = await uploadToIPFS(metadata);
    
    // Create proper ipfs:// URL
    const metadataUrl = `ipfs://${hash}`;
    
    // Store in cache - both ipfs:// format and HTTP gateway URL
    const httpUrl = `${IPFS_GATEWAYS[0]}${hash}`;
    ipfsCache.metadata.set(metadataKey, metadataUrl); // Store the ipfs:// URL directly
    
    console.log('Metadata yüklendi: ', { 
      hash, 
      metadataUrl, 
      httpUrl,
      metadata 
    });
    
    return metadataUrl;
  } catch (error) {
    console.error('Metadata yükleme hatası:', error);
    throw new Error('Metadata yüklenemedi');
  }
};

/**
 * Blob verisini IPFS'e yükler (Together API görsellerini işlemek için)
 * @param {Blob} blob - Yüklenecek blob verisi (görsel)
 * @returns {Promise<{url: string, hash: string}>} IPFS URL ve hash bilgisi
 */
export const storeToIPFS = async (blob) => {
  if (!blob || !(blob instanceof Blob)) {
    throw new Error('Geçerli bir blob verisi gerekmektedir');
  }
  
  try {
    // Blob verisini FormData olarak hazırla
    const formData = new FormData();
    const fileName = `image_${Date.now()}.${blob.type.split('/')[1] || 'png'}`;
    formData.append('file', new File([blob], fileName, { type: blob.type || 'image/png' }));
    
    console.log(`Blob verisini IPFS'e yüklüyorum (${blob.size} bytes)...`);
    
    // Pinata API'ye istek gönder
    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      maxBodyLength: Infinity,
      headers: {
        'Authorization': `Bearer ${PINATA_JWT}`,
      }
    });
    
    const hash = response.data.IpfsHash;
    console.log(`IPFS yükleme başarılı: ${hash}`);
    
    // IPFS URL'sini oluştur
    const url = `ipfs://${hash}`;
    
    return { url, hash };
  } catch (error) {
    console.error('IPFS blob yükleme hatası:', error);
    throw new Error(`Blob IPFS'e yüklenemedi: ${error.message}`);
  }
}; 