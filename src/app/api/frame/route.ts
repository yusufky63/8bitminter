import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Request gövdesini parse et
    const body = await req.json();
    console.log('Frame API request received:', body);

    // Basit bir frame yanıtı döndür
    return NextResponse.json({
      image: `${process.env.NEXT_PUBLIC_URL || 'https://8bitminter.vercel.app'}/opengraph-image.png`,
      buttons: [
        {
          label: 'Create Vision',
          action: 'post'
        }
      ]
    });
  } catch (error) {
    console.error('Error in frame endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
} 