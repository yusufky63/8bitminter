import { ImageResponse } from "next/og";

export const alt = process.env.NEXT_PUBLIC_FRAME_NAME || "VisionZ Coin Creator";
export const size = {
  width: 600,
  height: 400,
};

export const contentType = "image/png";

// dynamically generated OG image for frame preview
export default async function Image() {
  return new ImageResponse(
    (
      <div tw="h-full w-full flex flex-col justify-center items-center relative bg-gradient-to-br from-blue-600 to-indigo-900">
        <div tw="flex flex-col items-center justify-center">
          <div tw="text-white font-bold text-6xl mb-4">VisionZ</div>
          <div tw="text-blue-200 text-3xl mb-6">AI Coin Creator</div>
          <div tw="bg-white text-blue-600 px-6 py-3 rounded-full font-medium text-xl">
            Create your custom coin on Zora
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
