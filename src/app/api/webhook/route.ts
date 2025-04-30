import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Log the webhook event
    console.log('Received Farcaster webhook:', body);
    
    // Handle different event types
    if (body.event === 'frame_added') {
      // User added your Mini App
      console.log('User added the Mini App', body.notificationDetails);
      // Store the notification token in your database
    }
    else if (body.event === 'frame_removed') {
      // User removed your Mini App
      console.log('User removed the Mini App');
      // Remove notification tokens for this user
    }
    else if (body.event === 'notifications_enabled') {
      // User enabled notifications
      console.log('User enabled notifications', body.notificationDetails);
      // Store/update the notification token
    }
    else if (body.event === 'notifications_disabled') {
      // User disabled notifications
      console.log('User disabled notifications');
      // Mark tokens as invalid in your database
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// HEAD request handling for webhook validation
export async function HEAD() {
  return new Response(null, {
    status: 200,
  });
}
