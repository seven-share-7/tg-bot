/**
 * Cloudflare R2 存储服务
 * 用于上传和管理生成图片
 * 
 * @author seven
 * @since 2025-11-28
 */
import logger from '@/lib/logger';

/**
 * R2 存储配置
 */
interface R2Config {
  bucket: R2Bucket;
  prefix: string;
  publicUrl?: string; // R2 公共访问 URL（如果配置了自定义域名）
}

/**
 * 上传图片到 R2 存储
 * 
 * @param {R2Config} config - R2 配置
 * @param {Uint8Array} imageData - 图片数据
 * @param {string} filename - 文件名（可选，默认使用时间戳）
 * @return {Promise<string>} 文件在 R2 中的 key
 * @author seven
 * @since 2025-11-28
 */
export async function uploadImageToR2(
  config: R2Config,
  imageData: Uint8Array,
  filename?: string
): Promise<string> {
  try {
    // 生成文件名（如果未提供）
    if (!filename) {
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 9);
      filename = `${timestamp}-${random}.png`;
    }
    
    // 构建完整的 key（包含前缀）
    const key = config.prefix ? `${config.prefix}/${filename}` : filename;
    
    logger.info(`上传图片到 R2 - Key: ${key}, 大小: ${imageData.length} 字节`);
    
    // 上传到 R2
    await config.bucket.put(key, imageData, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000', // 缓存 1 年
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
      },
    });
    
    logger.info(`图片上传成功 - Key: ${key}`);
    return key;
  } catch (error) {
    logger.error(`上传图片到 R2 失败 - 错误: ${error}`);
    throw error;
  }
}

/**
 * 获取 R2 文件的公共访问 URL
 * 
 * @param {R2Config} config - R2 配置
 * @param {string} key - 文件 key
 * @return {string} 公共访问 URL
 * @author seven
 * @since 2025-11-28
 */
export function getR2PublicUrl(config: R2Config, key: string): string {
  // 如果配置了自定义域名，使用自定义域名
  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }
  
  // 否则使用 R2 的公共 URL（需要配置公共访问）
  // 格式：https://<account-id>.r2.cloudflarestorage.com/<bucket-name>/<key>
  // 注意：这需要 R2 配置了公共访问权限
  throw new Error('R2 公共 URL 未配置，请在 R2 配置中设置 publicUrl 或配置 R2 公共访问');
}

/**
 * 从 R2 获取图片数据
 * 
 * @param {R2Config} config - R2 配置
 * @param {string} key - 文件 key
 * @return {Promise<Uint8Array | null>} 图片数据，如果不存在返回 null
 * @author seven
 * @since 2025-11-28
 */
export async function getImageFromR2(
  config: R2Config,
  key: string
): Promise<Uint8Array | null> {
  try {
    logger.info(`从 R2 获取图片 - Key: ${key}`);
    
    const object = await config.bucket.get(key);
    
    if (!object) {
      logger.warn(`R2 中未找到文件 - Key: ${key}`);
      return null;
    }
    
    // 将 R2ObjectBody 转换为 Uint8Array
    const arrayBuffer = await object.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    logger.info(`从 R2 获取图片成功 - Key: ${key}, 大小: ${uint8Array.length} 字节`);
    return uint8Array;
  } catch (error) {
    logger.error(`从 R2 获取图片失败 - Key: ${key}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 删除 R2 中的文件
 * 
 * @param {R2Config} config - R2 配置
 * @param {string} key - 文件 key
 * @return {Promise<void>}
 * @author seven
 * @since 2025-11-28
 */
export async function deleteImageFromR2(
  config: R2Config,
  key: string
): Promise<void> {
  try {
    logger.info(`删除 R2 中的图片 - Key: ${key}`);
    
    await config.bucket.delete(key);
    
    logger.info(`删除 R2 中的图片成功 - Key: ${key}`);
  } catch (error) {
    logger.error(`删除 R2 中的图片失败 - Key: ${key}, 错误: ${error}`);
    throw error;
  }
}

