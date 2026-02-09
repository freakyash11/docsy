import express from 'express';
import crypto from 'crypto';
import User from '../models/User.js';

const router = express.Router();

router.post('/clerk-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  console.log('=== WEBHOOK RECEIVED ===');
  
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!WEBHOOK_SECRET) {
    console.error('❌ Webhook secret missing');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  console.log('✅ Webhook secret found');

  const headers = req.headers;
  const payload = req.body;

  console.log('📦 Payload length:', payload?.length);

  const svix_id = headers['svix-id'];
  const svix_timestamp = headers['svix-timestamp'];
  const svix_signature = headers['svix-signature'];

  if (!svix_id || !svix_timestamp || !svix_signature) {
    console.log('❌ Missing Svix headers');
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  console.log('✅ Svix headers present');

  // Signature verification
  try {
    const body = payload.toString();
    const secret = WEBHOOK_SECRET.split('_')[1]; // Remove 'whsec_' prefix
    const secretBytes = Buffer.from(secret, 'base64');
    
    const signedPayload = `${svix_id}.${svix_timestamp}.${body}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedPayload)
      .digest('base64');

    const signatures = svix_signature.split(' ');
    let isValid = false;
    
    for (const sig of signatures) {
      const [version, signature] = sig.split(',');
      if (version === 'v1') {
        if (crypto.timingSafeEqual(
          Buffer.from(signature, 'base64'),
          Buffer.from(expectedSignature, 'base64')
        )) {
          isValid = true;
          console.log('✅ Signature verified successfully');
          break;
        }
      }
    }

    if (!isValid) {
      console.log('❌ Signature invalid');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (signatureError) {
    console.error('❌ Signature verification error:', signatureError);
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  // Parse payload
  let evt;
  try {
    const body = payload.toString();
    evt = JSON.parse(body);
    console.log('✅ Payload parsed - Event type:', evt.type);
    console.log('📋 Event data ID:', evt.data?.id);
  } catch (parseError) {
    console.error('❌ JSON parse error:', parseError.message);
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { type, data } = evt;

  // Process event
  try {
    console.log(`🔄 Processing event: ${type}`);
    
    switch (type) {
      case 'user.created':
        console.log('👤 Handling user.created...');
        await handleUserCreated(data);
        console.log('✅ User created successfully');
        break;
      
      case 'user.updated':
        console.log('👤 Handling user.updated...');
        await handleUserUpdated(data);
        console.log('✅ User updated successfully');
        break;
      
      case 'user.deleted':
        console.log('👤 Handling user.deleted...');
        await handleUserDeleted(data);
        console.log('✅ User deleted successfully');
        break;
      
      default:
        console.log(`ℹ️ Unhandled webhook type: ${type}`);
    }

    console.log('=== WEBHOOK PROCESSED SUCCESSFULLY ===');
    res.status(200).json({ received: true });
  } catch (processingError) {
    console.error('❌ WEBHOOK PROCESSING ERROR:', processingError);
    console.error('Error stack:', processingError.stack);
    console.error('Error details:', {
      name: processingError.name,
      message: processingError.message,
      code: processingError.code
    });
    res.status(500).json({ 
      error: 'Webhook processing failed',
      details: processingError.message 
    });
  }
});

// Handler functions with better error handling
async function handleUserCreated(userData) {
  try {
    const { id, email_addresses, first_name, last_name, external_accounts, image_url, family_name } = userData;
    
    console.log('📧 Processing user:', {
      id,
      email: email_addresses?.[0]?.email_address,
      firstName: first_name,
      lastName: last_name,
      familyName: family_name
    });

    const primaryEmail = email_addresses?.find(email => email.id === userData.primary_email_address_id);
    const googleAccount = external_accounts?.find(account => account.provider === 'google');

    const fullName = family_name ? family_name : `${first_name || ''} ${last_name || ''}`.trim() || 'Unknown User';

    console.log('💾 Attempting to save user to MongoDB...');

    // Upsert: Create or update user
    const user = await User.findOneAndUpdate(
      { clerkId: id },
      {
        clerkId: id,
        email: primaryEmail?.email_address,
        name: fullName,
        provider: googleAccount ? 'google' : 'email',
        googleId: googleAccount?.provider_user_id || null,
        profileImage: image_url,
        emailVerified: primaryEmail?.verification?.status === 'verified',
        preferences: { theme: 'system' } // Add default preferences
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ User saved to MongoDB:', {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      name: user.name
    });

    return user;
  } catch (error) {
    console.error('❌ handleUserCreated error:', error);
    throw error;
  }
}

async function handleUserUpdated(userData) {
  try {
    const { id, email_addresses, first_name, last_name, image_url, family_name } = userData;
    
    console.log('📧 Updating user:', id);

    const primaryEmail = email_addresses?.find(email => email.id === userData.primary_email_address_id);
    const fullName = family_name ? family_name : `${first_name || ''} ${last_name || ''}`.trim();

    const user = await User.findOneAndUpdate(
      { clerkId: id },
      {
        email: primaryEmail?.email_address,
        name: fullName,
        profileImage: image_url,
        emailVerified: primaryEmail?.verification?.status === 'verified'
      },
      { new: true }
    );

    if (!user) {
      console.warn('⚠️ User not found for update, creating instead');
      return await handleUserCreated(userData);
    }

    console.log('✅ User updated:', user.email);
    return user;
  } catch (error) {
    console.error('❌ handleUserUpdated error:', error);
    throw error;
  }
}

async function handleUserDeleted(userData) {
  try {
    const { id } = userData;
    
    console.log('🗑️ Deleting user:', id);
    
    const result = await User.findOneAndDelete({ clerkId: id });
    
    if (!result) {
      console.warn('⚠️ User not found for deletion');
    } else {
      console.log('✅ User deleted:', id);
    }
    
    return result;
  } catch (error) {
    console.error('❌ handleUserDeleted error:', error);
    throw error;
  }
}

export default router;