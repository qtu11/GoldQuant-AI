import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 16;

/**
 * Mã hóa mật khẩu tài khoản MT5 bằng thuật toán AES-256-GCM
 * @param plainText Mật khẩu rõ cần mã hóa
 * @param secretKey Khóa bảo mật hệ thống (lấy từ env)
 * @returns Chuỗi mã hóa dạng hex (salt:iv:encryptedText:tag)
 */
export function encryptPassword(plainText: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('System secret key is required for encryption');
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  // Tạo key bảo mật 32-bytes từ secretKey và salt thông qua PBKDF2
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`;
}

/**
 * Giải mã mật khẩu MT5
 * @param cipherText Chuỗi hex đã mã hóa
 * @param secretKey Khóa bảo mật hệ thống (lấy từ env)
 * @returns Mật khẩu giải mã dạng rõ
 */
export function decryptPassword(cipherText: string, secretKey: string): string {
  if (!secretKey) {
    throw new Error('System secret key is required for decryption');
  }

  const parts = cipherText.split(':');
  if (parts.length !== 4) {
    throw new Error('Invalid ciphertext format. Expected salt:iv:encrypted:tag');
  }
  
  const salt = Buffer.from(parts[0], 'hex');
  const iv = Buffer.from(parts[1], 'hex');
  const encrypted = Buffer.from(parts[2], 'hex');
  const tag = Buffer.from(parts[3], 'hex');
  
  // Tạo key tương ứng
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
