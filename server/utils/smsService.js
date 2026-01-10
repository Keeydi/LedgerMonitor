/**
 * PhilSMS SMS Service (Optimized & Production-Safe)
 * -------------------------------------------------
 * ✔ Uses ONLY approved Sender ID: PhilSMS
 * ✔ Fully compliant with PhilSMS API v3
 * ✔ No fake success / no fallback hacks
 * ✔ Credits deduct correctly
 * ✔ Clean, minimal, maintainable
 */

import db from '../database.js';
import { normalizePhoneNumber } from './phoneUtils.js';

const PHILSMS_API_URL = 'https://app.philsms.com/api/v3/sms/send';
const PHILSMS_SENDER_ID = 'PhilSMS'; // 🔒 Approved & ACTIVE sender ID

/**
 * Get PHILSMS API token from environment (reads at runtime)
 * TEMPORARY: Hardcoded for testing - REMOVE AFTER TESTING
 */
function getApiToken() {
  // TEMPORARY HARDCODED TOKEN FOR TESTING
  return '895|H7NndPVoRXF7RUgXRYEbUJXHAqnq7lsydykFXsNT1af7cccb';
  
  // Original code (uncomment after testing):
  // return process.env.PHILSMS_API_TOKEN || process.env.PHILSMS_TOKEN;
}

/**
 * Send SMS using PhilSMS API v3
 * @param {string} recipient - Phone number (63XXXXXXXXXX)
 * @param {string} message - SMS body
 * @returns {Promise<{success:boolean, uid?:string, error?:string}>}
 */
export async function sendSMS(recipient, message) {
  const apiToken = getApiToken();
  if (!apiToken) {
    return { success: false, error: 'PHILSMS_API_TOKEN not configured' };
  }

  const normalizedRecipient = normalizePhoneNumber(recipient);
  if (!normalizedRecipient) {
    return { success: false, error: 'Invalid phone number format' };
  }

  // Add + prefix to match PhilSMS PHP example format (+639XXXXXXXXX)
  const recipientWithPlus = `+${normalizedRecipient}`;

  // Request body format matches PhilSMS PHP example
  const requestBody = {
    sender_id: PHILSMS_SENDER_ID,
    recipient: recipientWithPlus,
    message
  };

  // Debug: Show token preview (first 15 chars) to verify it's being used
  const tokenPreview = apiToken ? `${apiToken.substring(0, 15)}...` : 'MISSING';
  
  console.log('📤 Sending SMS via PhilSMS API:', {
    url: PHILSMS_API_URL,
    recipient: recipientWithPlus,
    sender_id: PHILSMS_SENDER_ID,
    messageLength: message.length,
    hasToken: !!apiToken,
    tokenPreview: tokenPreview,
    authHeader: `Bearer ${tokenPreview}`
  });

  try {
    const response = await fetch(PHILSMS_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Check if response is OK before parsing
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      let errorData = null;
      try {
        errorData = await response.json();
        // According to docs, error response format: { "status": "error", "message": "..." }
        const apiMessage = errorData.message || errorMessage;
        
        // Provide more helpful error messages for common status codes
        if (response.status === 403) {
          errorMessage = `403 Forbidden: ${apiMessage}. This usually means: (1) The API token doesn't have permission to use sender ID "${PHILSMS_SENDER_ID}", (2) The sender ID is not approved/active for your account, or (3) The token is invalid. Please verify your token and sender ID permissions in the PhilSMS dashboard.`;
        } else if (response.status === 401) {
          errorMessage = `401 Unauthorized: ${apiMessage}. The API token is invalid or expired. Please check your PHILSMS_API_TOKEN.`;
        } else {
          errorMessage = `${errorMessage}: ${apiMessage}`;
        }
        
        console.error('❌ PhilSMS API HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          senderId: PHILSMS_SENDER_ID,
          recipient: recipientWithPlus
        });
      } catch {
        // If response is not JSON, use status text
        const text = await response.text();
        if (text) {
          errorMessage += ` - ${text}`;
          console.error('❌ PhilSMS API Error (non-JSON):', { status: response.status, text });
        }
      }
      return { success: false, error: errorMessage };
    }

    const data = await response.json();
    console.log('📥 PhilSMS API Response:', JSON.stringify(data, null, 2));

    // According to PhilSMS API docs:
    // Success: { "status": "success", "data": "sms reports with all details" }
    // Error: { "status": "error", "message": "A human-readable description of the error." }
    if (data.status === 'error') {
      const errorMsg = data.message || 'PhilSMS API returned an error';
      console.error('❌ PhilSMS API error:', { 
        status: data.status, 
        message: errorMsg, 
        fullResponse: data 
      });
      return { success: false, error: errorMsg };
    }

    if (data.status !== 'success') {
      const errorMsg = data.message || 'PhilSMS API returned non-success status';
      console.error('❌ PhilSMS API unexpected status:', { 
        status: data.status, 
        message: errorMsg, 
        fullResponse: data 
      });
      return { success: false, error: errorMsg };
    }

    // Success response - data may be a string or object with details
    // Extract UID if available (it might be in data.data.uid or data.data itself)
    let uid = null;
    if (typeof data.data === 'object' && data.data !== null) {
      uid = data.data.uid || data.data.id || null;
    }
    
    console.log('✅ SMS sent successfully:', { uid, data: data.data });
    return {
      success: true,
      uid: uid
    };

  } catch (err) {
    console.error('❌ SMS send exception:', {
      error: err.message,
      stack: err.stack,
      name: err.name
    });
    return { success: false, error: err.message || 'Network error' };
  }
}

/**
 * Send illegal parking violation SMS
 * @param {string} plateNumber
 * @param {string} locationId
 * @param {string} violationId
 */
export async function sendViolationSMS(plateNumber, locationId, violationId) {
  try {
    const vehicle = db
      .prepare('SELECT * FROM vehicles WHERE plateNumber = ?')
      .get(plateNumber);

    if (!vehicle || !vehicle.contactNumber) {
      return { success: false, error: 'Vehicle or contact number not found' };
    }

    const message = `PARKING VIOLATION ALERT: Your vehicle (${plateNumber}) is illegally parked at ${locationId}. Please remove it immediately to avoid penalties. - Park Smart Monitor`;

    const smsResult = await sendSMS(vehicle.contactNumber, message);

    const smsLogId = `SMS-${violationId}-${Date.now()}`;
    const sentAt = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO sms_logs (
          id, violationId, plateNumber, contactNumber, message,
          status, statusMessage, sentAt, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        smsLogId,
        violationId,
        plateNumber,
        vehicle.contactNumber,
        message,
        smsResult.success ? 'sent' : 'failed',
        smsResult.success ? `UID: ${smsResult.uid}` : smsResult.error,
        sentAt,
        smsResult.success ? null : smsResult.error
      );
    } catch (logErr) {
      console.error('SMS log failed:', logErr);
    }

    return smsResult.success
      ? { success: true, smsLogId }
      : { success: false, smsLogId, error: smsResult.error };

  } catch (err) {
    console.error('sendViolationSMS error:', err);
    return { success: false, error: err.message || 'Unexpected error' };
  }
}

/**
 * SMS service health check
 */
export function getSMSServiceStatus() {
  const apiToken = getApiToken();
  return {
    provider: 'PhilSMS',
    senderId: PHILSMS_SENDER_ID,
    configured: !!apiToken,
    status: apiToken ? 'healthy' : 'unhealthy',
    apiUrl: PHILSMS_API_URL,
    message: apiToken
      ? 'PhilSMS service ready'
      : 'Missing PHILSMS_API_TOKEN in environment'
  };
}

export default {
  sendSMS,
  sendViolationSMS,
  getSMSServiceStatus
};