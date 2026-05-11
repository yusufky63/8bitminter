import { GoogleGenAI } from '@google/genai';
import mime from 'mime';
import 'server-only';

/**
 * Generate an image via Gemini SDK (stream) and return a data URL.
 */
export async function generateGeminiImageStream(
  name: string,
  symbol: string,
  description?: string,
  category?: string,
  model: string = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
): Promise<string> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Pixel art style cryptocurrency token logo for "${name}" (${symbol}). ${
    category ? `Category: ${category}. ` : ''
  }${description ? `Theme: ${description}. ` : ''}8-bit retro style, arcade-inspired, pixelated, circular coin emblem, limited 4-8 color palette, chunky pixels, crisp edges, nearest-neighbor, no gradients.`;

  const config = {
    responseModalities: ['IMAGE', 'TEXT'],
  } as any;

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const stream = await ai.models.generateContentStream({ model, config, contents } as any);

  let firstImageData: { data: string; mimeType?: string } | null = null;
  for await (const chunk of stream as any) {
    const parts = chunk?.candidates?.[0]?.content?.parts;
    if (!parts || !Array.isArray(parts) || parts.length === 0) continue;

    const inline = parts.find((p: any) => p?.inlineData);
    if (inline?.inlineData?.data) {
      const mimeType: string | undefined = inline.inlineData.mimeType || 'image/png';
      firstImageData = { data: inline.inlineData.data, mimeType };
      break; // first image is enough
    }
  }

  if (!firstImageData) {
    throw new Error('Gemini returned no image data');
  }

  const ext = mime.getExtension(firstImageData.mimeType || 'image/png') || 'png';
  const dataUrl = `data:${firstImageData.mimeType || 'image/png'};base64,${firstImageData.data}`;
  // Optionally return filename if needed: `${name}_${symbol}.${ext}`
  return dataUrl;
}

