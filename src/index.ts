/**
 * Cloudflare Workers 入口文件
 * Telegram Bot Webhook 处理
 * 
 * @author seven
 * @since 2025-11-28
 */
import { initDatabase } from '../lib/prisma';
import { DISCLAIMER_MESSAGE, getMainMenuKeyboard } from '../lib/menu';

/**
 * Cloudflare Workers 环境变量类型定义
 */
export interface Env {
  // D1 数据库绑定
  DB: D1Database;
  
  // 环境变量
  BOT_TOKEN: string;
  DATABASE_URL?: string;
  
  // 支付配置
  ALIPAY_APP_ID?: string;
  ALIPAY_PRIVATE_KEY?: string;
  ALIPAY_PUBLIC_KEY?: string;
  ALIPAY_NOTIFY_URL?: string;
  
  WECHAT_APP_ID?: string;
  WECHAT_MCH_ID?: string;
  WECHAT_API_KEY?: string;
  WECHAT_NOTIFY_URL?: string;
  
  USTD_API_KEY?: string;
  USTD_NOTIFY_URL?: string;
  
  // 其他配置
  OFFICIAL_CHANNEL_ID?: string;
  IMAGE_GENERATION_API_URL?: string;
  IMAGE_GENERATION_API_KEY?: string;
  VIDEO_GENERATION_API_URL?: string;
  VIDEO_GENERATION_API_KEY?: string;
  WEBHOOK_URL?: string;
  PROXY_URL?: string;
  LOG_LEVEL?: string;
  NODE_ENV?: string;
}

/**
 * Telegram Bot API 辅助类
 * 使用 Fetch API 直接调用 Telegram API，兼容 Cloudflare Workers
 */
class TelegramBot {
  private token: string;
  private apiUrl: string;

  constructor(token: string) {
    this.token = token;
    this.apiUrl = `https://api.telegram.org/bot${token}`;
  }

  /**
   * 调用 Telegram Bot API
   */
  async callApi(method: string, params: any = {}): Promise<any> {
    const url = `${this.apiUrl}/${method}`;
    console.log(`调用 Telegram API: ${method}`, params);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      const data: any = await response.json();
      
      if (!data.ok) {
        console.error(`Telegram API 错误: ${method}`, data);
        throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
      }

      return data.result;
    } catch (error) {
      console.error(`调用 Telegram API 失败: ${method}`, error);
      throw error;
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(chatId: number | string, text: string, options: any = {}): Promise<any> {
    return this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      ...options,
    });
  }

  /**
   * 编辑消息文本
   */
  async editMessageText(text: string, options: any = {}): Promise<any> {
    return this.callApi('editMessageText', {
      text,
      ...options,
    });
  }

  /**
   * 回答回调查询
   */
  async answerCallbackQuery(callbackQueryId: string, options: any = {}): Promise<any> {
    return this.callApi('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...options,
    });
  }

  /**
   * 获取 Bot 信息
   */
  async getMe(): Promise<any> {
    return this.callApi('getMe');
  }

  /**
   * 获取聊天成员信息
   */
  async getChatMember(chatId: string | number, userId: number): Promise<any> {
    return this.callApi('getChatMember', {
      chat_id: chatId,
      user_id: userId,
    });
  }

  /**
   * 发送照片
   */
  async sendPhoto(chatId: number | string, photo: string, options: any = {}): Promise<any> {
    return this.callApi('sendPhoto', {
      chat_id: chatId,
      photo,
      ...options,
    });
  }

  /**
   * 发送视频
   */
  async sendVideo(chatId: number | string, video: string, options: any = {}): Promise<any> {
    return this.callApi('sendVideo', {
      chat_id: chatId,
      video,
      ...options,
    });
  }
}

/**
 * 处理 Telegram Webhook 更新
 * 
 * @param {TelegramBot} bot - Bot 实例
 * @param {any} update - Telegram 更新对象
 * @author seven
 * @since 2025-11-28
 */
async function handleTelegramUpdate(bot: TelegramBot, update: any): Promise<void> {
  console.log('收到 Telegram 更新:', JSON.stringify(update, null, 2));
  
  try {
    // 处理消息
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const userId = msg.from?.id;
      
      console.log(`处理消息 - 用户ID: ${userId}, 聊天ID: ${chatId}`);
      
      // 处理 /start 命令
      if (msg.text?.startsWith('/start')) {
        console.log('处理 /start 命令');
        
        // 发送免责声明和完整菜单
        await bot.sendMessage(chatId, DISCLAIMER_MESSAGE, {
          reply_markup: getMainMenuKeyboard(),
        });
      }
      // 处理其他文本消息
      else if (msg.text) {
        console.log('处理文本消息:', msg.text);
        await bot.sendMessage(chatId, `你发送了: ${msg.text}`);
      }
    }
    // 处理回调查询
    else if (update.callback_query) {
      const query = update.callback_query;
      console.log(`处理回调查询 - 用户ID: ${query.from.id}, 数据: ${query.data}`);
      
      await bot.answerCallbackQuery(query.id, {
        text: '功能开发中...',
      });
    }
    else {
      console.warn('收到未知类型的更新');
    }
  } catch (error) {
    console.error('处理 Telegram 更新失败:', error);
    throw error;
  }
}

/**
 * 处理 HTTP 请求
 * 
 * @param {Request} request - 请求对象
 * @param {Env} env - 环境变量
 * @param {ExecutionContext} ctx - 执行上下文
 * @return {Promise<Response>} 响应对象
 * @author seven
 * @since 2025-11-28
 */
async function handleRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  
  console.log(`收到请求 - Method: ${request.method}, Path: ${path}`);
  
  try {
    // 健康检查端点
    if (path === '/health' || path === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'tg-bot-worker',
        version: '1.0.0',
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // 设置 Webhook 端点（管理用）- 支持 GET 方式更简单
    if (path === '/setup-webhook') {
      // 添加 CORS 头
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      };
      
      // 处理 OPTIONS 请求
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers });
      }
      
      if (!env.BOT_TOKEN) {
        console.error('BOT_TOKEN 未配置');
        return new Response(JSON.stringify({ 
          success: false,
          error: 'BOT_TOKEN not configured',
          message: '请在 Cloudflare Dashboard 中配置 BOT_TOKEN 环境变量'
        }), {
          status: 500,
          headers,
        });
      }
      
      const webhookUrl = env.WEBHOOK_URL || new URL(request.url).origin;
      const fullWebhookUrl = `${webhookUrl}/tg/webhook`;
      
      console.log(`设置 Webhook 到: ${fullWebhookUrl}`);
      
      try {
        // 使用 GET 方式（更简单，参数在 URL 中）
        const telegramApiUrl = `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(fullWebhookUrl)}`;
        
        const response = await fetch(telegramApiUrl, {
          method: 'GET',
        });
        
        const data: any = await response.json();
        
        if (data.ok) {
          console.log('✅ Webhook 设置成功');
          return new Response(JSON.stringify({
            success: true,
            message: 'Webhook 设置成功',
            webhook_url: fullWebhookUrl,
            telegram_response: data,
            timestamp: new Date().toISOString(),
          }), {
            status: 200,
            headers,
          });
        } else {
          console.error('Webhook 设置失败:', data);
          return new Response(JSON.stringify({
            success: false,
            message: 'Webhook 设置失败',
            error: data.description || 'Unknown error',
            telegram_response: data,
          }), {
            status: 500,
            headers,
          });
        }
      } catch (error) {
        console.error('设置 Webhook 异常:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          message: '调用 Telegram API 失败',
        }), {
          status: 500,
          headers,
        });
      }
    }
    
    // 获取 Webhook 信息端点
    if (path === '/webhook-info') {
      const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      };
      
      if (!env.BOT_TOKEN) {
        return new Response(JSON.stringify({ 
          success: false,
          error: 'BOT_TOKEN not configured' 
        }), {
          status: 500,
          headers,
        });
      }
      
      try {
        const response = await fetch(
          `https://api.telegram.org/bot${env.BOT_TOKEN}/getWebhookInfo`
        );
        
        const data = await response.json();
        
        return new Response(JSON.stringify(data), {
          status: 200,
          headers,
        });
      } catch (error) {
        console.error('获取 Webhook 信息失败:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }), {
          status: 500,
          headers,
        });
      }
    }
    
    // Webhook 端点
    if (path === '/webhook' || path === '/api/webhook' || path === '/tg/webhook') {
      // 只接受 POST 请求
      if (request.method !== 'POST') {
        console.warn(`收到非 POST 请求: ${request.method}`);
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
          status: 405,
          headers: {
            'Content-Type': 'application/json',
            'Allow': 'POST',
          },
        });
      }
      
      // 验证 BOT_TOKEN
      if (!env.BOT_TOKEN) {
        console.error('BOT_TOKEN 环境变量未设置');
        return new Response(JSON.stringify({ error: 'BOT_TOKEN not configured' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      
      // 初始化数据库（传入 D1 绑定）
      console.log('初始化数据库连接...');
      await initDatabase(env.DB);
      
      // 创建 Bot 实例
      const bot = new TelegramBot(env.BOT_TOKEN);
      
      // 解析请求体
      const update = await request.json();
      
      // 处理 Telegram 更新（异步，不阻塞响应）
      ctx.waitUntil(handleTelegramUpdate(bot, update));
      
      // 立即返回 200 OK（Telegram 要求）
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }
    
    // 404 - 路由不存在
    console.warn(`路由不存在: ${path}`);
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('处理请求失败:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

/**
 * Cloudflare Workers 导出对象
 */
export default {
  /**
   * 处理 fetch 请求
   * 
   * @param {Request} request - 请求对象
   * @param {Env} env - 环境变量
   * @param {ExecutionContext} ctx - 执行上下文
   * @return {Promise<Response>} 响应对象
   * @author seven
   * @since 2025-11-28
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handleRequest(request, env, ctx);
  },
};

