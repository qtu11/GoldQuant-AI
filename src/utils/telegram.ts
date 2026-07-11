/**
 * Telegram Notification Helper
 */
export async function sendTelegramAlert(message: string): Promise<boolean> {
  try {
    const response = await fetch('/api/telegram', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    
    if (!response.ok) {
      const data = await response.json();
      console.error('Failed to send Telegram notification:', data.error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error('Error calling local Telegram API route:', err);
    return false;
  }
}
