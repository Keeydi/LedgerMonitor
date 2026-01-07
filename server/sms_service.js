/**
 * PhilSMS Integration Service
 * 
 * Sends SMS messages using PhilSMS API
 * API Documentation: https://app.philsms.com/developers/documentation
 */

const PHILSMS_API_URL = 'https://dashboard.philsms.com/api/v3/sms/send';

// Get API token (hardcoded)
function getApiToken() {
  return '760|wDqbh5yw1qNGz8WXbZFenEfOSKof4NXkaniws35d10969904';
}

/**
 * Send SMS using PhilSMS API
 * @param {string} phoneNumber - Recipient phone number (Philippines format: 09XXXXXXXXX or +639XXXXXXXXX)
 * @param {string} message - SMS message content
 * @param {string} senderId - Sender ID (optional, defaults to 'PhilSMS')
 * @returns {Promise<Object>} - { success: boolean, status: string, messageId?: string, error?: string }
 */
export async function sendSMS(phoneNumber, message, senderId = null) {
  const apiToken = getApiToken();
  
  if (!apiToken || apiToken.trim() === '') {
    return {
      success: false,
      status: 'error',
      error: 'PHILSMS_API_TOKEN not configured',
      statusMessage: 'SMS service not configured'
    };
  }

  // Get sender ID
  if (!senderId) {
    senderId = process.env.PHILSMS_SENDER_ID || process.env.PHILSMS_SENDER_PHONE || 'PhilSMS';
  }

  // Normalize phone number format
  let normalizedPhone = phoneNumber.trim().replace(/[\s\-\(\)]/g, '');
  
  // Convert to local format (09XXXXXXXXX)
  if (normalizedPhone.startsWith('+63')) {
    normalizedPhone = '0' + normalizedPhone.substring(3);
  } else if (normalizedPhone.startsWith('63')) {
    normalizedPhone = '0' + normalizedPhone.substring(2);
  } else if (!normalizedPhone.startsWith('0')) {
    normalizedPhone = '0' + normalizedPhone;
  }

  // Validate Philippine phone number format
  if (!/^0\d{10}$/.test(normalizedPhone)) {
    return {
      success: false,
      status: 'error',
      error: `Invalid Philippine phone number format: ${phoneNumber}`
    };
  }

  // Convert to international format (639XXXXXXXXX)
  const internationalPhone = '63' + normalizedPhone.substring(1);

  try {
    const requestBody = {
      recipient: internationalPhone,
      sender_id: senderId,
      type: 'plain',
      message: message
    };

    const response = await fetch(PHILSMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiToken}`
      },
      body: JSON.stringify(requestBody)
    });

    let data;
    try {
      data = await response.json();
    } catch (parseError) {
      const text = await response.text();
      return {
        success: false,
        status: 'error',
        error: `Invalid API response: ${text.substring(0, 200)}`,
        statusMessage: 'Failed to parse API response'
      };
    }

    // Check for sender ID authorization error
    if (data.message && data.message.toLowerCase().includes('sender id') && 
        data.message.toLowerCase().includes('not authorized')) {
      return {
        success: false,
        status: 'error',
        error: data.message || 'Sender ID not authorized',
        statusMessage: `Sender ID "${senderId}" is not authorized`,
        responseData: data
      };
    }

    // Check for HTTP errors
    if (!response.ok) {
      return {
        success: false,
        status: 'error',
        error: data.message || data.error || `HTTP ${response.status}`,
        statusMessage: data.message || 'Failed to send SMS',
        responseData: data
      };
    }

    // Check if successful
    const apiStatus = data?.status || 'error';
    const isSuccess = apiStatus === 'success' || apiStatus === 'sent';
    
    if (isSuccess) {
      const messageId = data.data?.message_id || data.data?.id || data.message_id || data.id;
      return {
        success: true,
        status: apiStatus,
        messageId: messageId,
        statusMessage: data.message || 'SMS sent successfully',
        responseData: data
      };
    } else {
      return {
        success: false,
        status: apiStatus,
        error: data.message || data.error || 'SMS sending failed',
        statusMessage: data.message || 'SMS sending failed',
        responseData: data
      };
    }
  } catch (error) {
    console.error('SMS sending error:', error.message);
    return {
      success: false,
      status: 'error',
      error: error.message || 'Network error',
      statusMessage: 'Failed to send SMS due to network error'
    };
  }
}

/**
 * Format SMS message for illegal parking warning
 * @param {string} plateNumber - Vehicle plate number
 * @param {string} locationId - Camera location ID
 * @returns {string} - Formatted SMS message
 */
export function formatParkingWarningSMS(plateNumber, locationId) {
  return `VIOLATIONLEDGER ALERT: Your vehicle (${plateNumber}) is illegally parked at ${locationId}. Please move your vehicle immediately. You have 30 minutes grace period before a ticket is issued. Thank you for your cooperation.`;
}

/**
 * Check if SMS should be sent
 * Conditions: plate is visible AND vehicle is registered
 * @param {string} plateNumber - Vehicle plate number
 * @param {Object} db - Database instance
 * @returns {Object} - { shouldSend: boolean, vehicle?: Object, reason?: string, contactNumber?: string }
 */
export function shouldSendSMS(plateNumber, db) {
  // Check if plate is visible
  if (!plateNumber || plateNumber.toUpperCase() === 'NONE') {
    return {
      shouldSend: false,
      reason: 'Plate number is not visible or readable'
    };
  }

  // Check if vehicle is registered (case-insensitive search)
  let vehicle = db.prepare('SELECT * FROM vehicles WHERE plateNumber = ?').get(plateNumber);
  
  if (!vehicle) {
    const allVehicles = db.prepare('SELECT * FROM vehicles').all();
    vehicle = allVehicles.find(v => 
      v.plateNumber && v.plateNumber.toUpperCase().trim() === plateNumber.toUpperCase().trim()
    );
  }
  
  if (!vehicle) {
    return {
      shouldSend: false,
      reason: 'Vehicle is not registered in the system'
    };
  }

  // Check if vehicle has contact number
  if (!vehicle.contactNumber || vehicle.contactNumber.trim() === '') {
    return {
      shouldSend: false,
      reason: 'Vehicle owner contact number is missing'
    };
  }

  return {
    shouldSend: true,
    vehicle: vehicle,
    contactNumber: vehicle.contactNumber
  };
}
