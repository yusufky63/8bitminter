import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Request gövdesini parse et
    const body = await req.json();
    console.log('Webhook event received:', body);

    // Olayı işle
    if (body.event === 'frame_added') {
      console.log('Frame added event received with notification token:', body.notificationDetails?.token);
      // TODO: Token'ı veritabanına kaydet
    } else if (body.event === 'frame_removed') {
      console.log('Frame removed event received');
      // TODO: Token'ı sil veya devre dışı bırak
    } else if (body.event === 'notifications_enabled') {
      console.log('Notifications enabled event received with token:', body.notificationDetails?.token);
      // TODO: Bildirim token'ını etkinleştir
    } else if (body.event === 'notifications_disabled') {
      console.log('Notifications disabled event received');
      // TODO: Bildirim token'ını devre dışı bırak
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in webhook endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// HEAD request handling for webhook validation
export async function HEAD() {
  return new Response(null, {
    status: 200,
  });
}
