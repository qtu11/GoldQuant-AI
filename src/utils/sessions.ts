/**
 * Phân loại phiên giao dịch dựa trên giờ mở lệnh
 * @param timeStr Chuỗi thời gian định dạng YYYY.MM.DD HH:mm:ss hoặc ISO
 */
export function getTradingSession(timeStr: string): 'Asia' | 'Europe' | 'US' {
  try {
    let hour = 0;
    
    if (timeStr.includes('T')) {
      // Dạng ISOString: 2026-07-09T23:18:00.000Z
      const timePart = timeStr.split('T')[1];
      if (timePart) {
        hour = parseInt(timePart.split(':')[0], 10);
      } else {
        return 'Asia';
      }
    } else {
      // Dạng: 2026.07.09 23:18:00 hoặc tương tự
      const parts = timeStr.trim().split(/\s+/);
      const timePart = parts[1] || parts[0];
      if (timePart && timePart.includes(':')) {
        hour = parseInt(timePart.split(':')[0], 10);
      } else {
        return 'Asia';
      }
    }
    
    if (isNaN(hour)) return 'Asia';
    
    // Phân chia theo giờ Exness MT5 (thường là GMT+2/GMT+3)
    // Asia: 00:00 - 07:59
    // Europe: 08:00 - 14:59
    // US: 15:00 - 23:59
    if (hour >= 0 && hour < 8) {
      return 'Asia';
    } else if (hour >= 8 && hour < 15) {
      return 'Europe';
    } else {
      return 'US';
    }
  } catch (error) {
    console.error('Lỗi khi phân tích phiên giao dịch:', error);
    return 'Asia';
  }
}
