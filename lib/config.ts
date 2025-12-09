/**
 * 配置管理（适配 Cloudflare Workers）
 * 
 * Cloudflare Workers 通过环境变量绑定获取配置，不需要 dotenv
 * 本地开发时配置从 .dev.vars 文件读取
 * 
 * @author seven
 * @since 2025-11-28
 */

/**
 * 应用配置
 * 从环境变量中读取配置
 * 
 * @author seven
 * @since 2025-11-28
 */
export const config = {
  // Telegram Bot 配置
  botToken: process.env.BOT_TOKEN || '',
  
  // 数据库配置
  databaseUrl: process.env.DATABASE_URL || 'file:./data/bot.db',
  
  // 支付配置
  alipay: {
    appId: process.env.ALIPAY_APP_ID || '',
    privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
    publicKey: process.env.ALIPAY_PUBLIC_KEY || '',
    notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
  },
  
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    mchId: process.env.WECHAT_MCH_ID || '',
    apiKey: process.env.WECHAT_API_KEY || '',
    notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
  },
  
  usdt: {
    apiKey: process.env.USTD_API_KEY || '',
    notifyUrl: process.env.USTD_NOTIFY_URL || '',
  },
  
  // 官方频道配置
  officialChannelId: process.env.OFFICIAL_CHANNEL_ID || '',
  
  // 客服配置
  customerService: {
    wechatUsername: process.env.CUSTOMER_SERVICE_WECHAT || '@telddavc',
  },
  
  // 分享配置
  referral: {
    videoUrl: process.env.REFERRAL_VIDEO_URL || '',
    imageUrl: process.env.REFERRAL_IMAGE_URL || '',
  },
  
  // 功能配置
  features: {
    // 建议上传内容（可配置）
    uploadSuggestion: process.env.UPLOAD_SUGGESTION || '站立，单人，无遮挡，主体人物清晰的照片无奇怪动作姿势',
    // 官方频道名称（用于显示）
    officialChannelName: process.env.OFFICIAL_CHANNEL_NAME || '【NSFW】官方功能更新频道',
  },
  
  // 图像生成API配置
  imageGeneration: {
    apiUrl: process.env.IMAGE_GENERATION_API_URL || '',
    apiKey: process.env.IMAGE_GENERATION_API_KEY || '',
  },
  
  // RunPod API 配置
  runpod: {
    apiKey: process.env.RUNPOD_API_KEY || '',
    endpointId: process.env.RUNPOD_ENDPOINT_ID || '',
  },
  
  // 视频生成API配置
  videoGeneration: {
    apiUrl: process.env.VIDEO_GENERATION_API_URL || '',
    apiKey: process.env.VIDEO_GENERATION_API_KEY || '',
  },
  
  // 日志配置
  logLevel: process.env.LOG_LEVEL || 'INFO',
  
  // Webhook 配置
  webhookUrl: process.env.WEBHOOK_URL || '',
  webhookSecret: process.env.WEBHOOK_SECRET || '',
  
  // 代理配置（用于访问 Telegram API）
  proxy: process.env.PROXY_URL || undefined,
  
  // 环境信息
  nodeEnv: process.env.NODE_ENV || 'production',
};

/**
 * 验证必要的配置项
 * 
 * @throws {Error} 当必要配置缺失时抛出错误
 * @author seven
 * @since 2025-11-28
 */
export function validateConfig(): void {
  console.log('验证配置...');
  
  if (!config.botToken) {
    const errorMsg = 'BOT_TOKEN 环境变量未设置，请在环境变量中配置';
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  console.log('配置验证通过');
  console.log(`环境: ${config.nodeEnv}`);
  console.log(`日志级别: ${config.logLevel}`);
}

