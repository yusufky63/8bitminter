/**
 * Persist Together.ai-generated images to IPFS, then build metadata JSON on IPFS.
 */

import { storeToIPFS } from "./pinata";

function ipfsToGateway(url) {
  if (!url) return "";
  if (!url.startsWith("ipfs://")) return url;
  const hash = url.slice(7);
  return `https://ipfs.io/ipfs/${hash}`;
}

/**
 * Downloads the Together image, uploads the bytes to IPFS, then uploads metadata JSON to IPFS.
 * Returns displayUrl (gateway) and ipfsUri (metadata JSON ipfs://...)
 */
export async function processTogetherImageToIPFS(imageUrl, tokenName, tokenSymbol, tokenDescription) {
  try {
    if (!imageUrl) throw new Error("No image URL provided");

    // 1) Fetch image & upload to IPFS
    let imageIpfsUrl = null;
    try {
      const resp = await fetch(imageUrl, { mode: 'cors' });
      if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
      const blob = await resp.blob();
      const uploaded = await storeToIPFS(blob, `${tokenName || 'token'}_${tokenSymbol || ''}.png`);
      if (!uploaded?.url?.startsWith('ipfs://')) throw new Error('IPFS image upload failed');
      imageIpfsUrl = uploaded.url;
    } catch (e) {
      console.warn('Image IPFS upload failed, using original URL in metadata', e);
      imageIpfsUrl = imageUrl;
    }

    // 2) Build metadata using IPFS image when available
    const metadata = {
      name: tokenName || 'Token',
      description: tokenDescription || `${tokenName} token - Created with 8BitCoiner`,
      symbol: tokenSymbol,
      image: imageIpfsUrl,
    };
    const jsonBlob = new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' });
    const metaRes = await storeToIPFS(jsonBlob, `${metadata.name}_metadata.json`);
    if (!metaRes?.url?.startsWith('ipfs://')) throw new Error('IPFS metadata upload failed');

    // 3) Prefer IPFS image for display
    const displayUrl = imageIpfsUrl.startsWith('ipfs://') ? ipfsToGateway(imageIpfsUrl) : imageUrl;
    return { displayUrl, ipfsUri: metaRes.url };
  } catch (error) {
    console.error('Error processing Together.ai image:', error);
    throw new Error(`Failed to process image: ${error.message}`);
  }
}

