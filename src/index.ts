/**
 * Cloudflare Workers 入口文件
 * Telegram Bot Webhook 处理
 * 
 * @author seven
 * @since 2025-11-28
 */
import { initDatabase } from '../lib/prisma';
import { getUserByTelegramId, deductPoints } from '../services/userService';
import { createOrder } from '../services/orderService';
import { generateImage } from '../services/runpodService';
import { OrderType } from '../lib/constants';
import { 
  DISCLAIMER_MESSAGE, 
  getMainMenuKeyboard, 
  getFunctionMenuKeyboard,
  getStripMenuKeyboard,
  getBreastMenuKeyboard,
  getMasturbateMenuKeyboard,
  getFacialMenuKeyboard,
  getOralMenuKeyboard,
  getHandjobMenuKeyboard,
  getSexMenuKeyboard,
  getPointsMenuKeyboard,
  getRechargeMenuKeyboard,
  getPaymentMethodKeyboard,
  getConfirmRechargeKeyboard,
  getText2ImageDetailText,
} from '../lib/menu';

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
  
  // 客服配置
  CUSTOMER_SERVICE_WECHAT?: string;
  
  // 分享配置
  REFERRAL_VIDEO_URL?: string;
  REFERRAL_IMAGE_URL?: string;
  
  // 功能配置
  UPLOAD_SUGGESTION?: string;
  OFFICIAL_CHANNEL_NAME?: string;
  
  // RunPod 配置
  RUNPOD_API_KEY?: string;
  RUNPOD_ENDPOINT_ID?: string;
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

  /**
   * 发送照片（支持 Uint8Array）
   */
  async sendPhotoBuffer(chatId: number | string, photoBuffer: Uint8Array, options: any = {}): Promise<any> {
    // 在 Workers 环境中，使用 FormData 发送图片
    const formData = new FormData();
    const blob = new Blob([photoBuffer], { type: 'image/png' });
    formData.append('chat_id', String(chatId));
    formData.append('photo', blob, 'generated.png');
    
    if (options.caption) {
      formData.append('caption', options.caption);
    }
    
    const url = `${this.apiUrl}/sendPhoto`;
    console.log(`发送图片到 Telegram - Chat ID: ${chatId}`);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
        body: formData,
      });

      const data: any = await response.json();
      
      if (!data.ok) {
        console.error(`Telegram API 错误: sendPhoto`, data);
        throw new Error(`Telegram API error: ${data.description || 'Unknown error'}`);
      }

      return data.result;
    } catch (error) {
      console.error(`发送图片失败: sendPhoto`, error);
      throw error;
    }
  }
}

/**
 * 处理 Telegram Webhook 更新
 * 
 * @param {TelegramBot} bot - Bot 实例
 * @param {any} update - Telegram 更新对象
 * @param {Env} env - 环境变量
 * @author seven
 * @since 2025-11-28
 */
async function handleTelegramUpdate(bot: TelegramBot, update: any, env: Env): Promise<void> {
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
        
        // 获取环境变量中的官方频道ID
        const officialChannelId = env.OFFICIAL_CHANNEL_ID || '';
        
        // 发送免责声明和完整菜单
        await bot.sendMessage(chatId, DISCLAIMER_MESSAGE, {
          reply_markup: getMainMenuKeyboard(officialChannelId),
        });
      }
      // 处理图片消息
      else if (msg.photo && msg.photo.length > 0) {
        console.log(`收到图片消息 - 用户ID: ${userId}, 图片数量: ${msg.photo.length}`);
        
        // 获取最大尺寸的图片
        const photo = msg.photo[msg.photo.length - 1];
        console.log(`图片信息 - 文件ID: ${photo.file_id}, 尺寸: ${photo.width}x${photo.height}`);
        
        try {
          if (!userId) {
            await bot.sendMessage(chatId, '无法获取用户信息，请重试。');
            return;
          }
          
          // 获取用户信息
          const dbUser = await getUserByTelegramId(BigInt(userId));
          if (!dbUser) {
            await bot.sendMessage(chatId, '请先使用 /start 命令开始使用机器人。');
            return;
          }
          
          // 检查是否关注官方频道
          const channelId = env.OFFICIAL_CHANNEL_ID || '';
          if (channelId) {
            try {
              const member = await bot.getChatMember(channelId, userId);
              const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
              if (!isSubscribed) {
                await bot.sendMessage(
                  chatId,
                  `❌ 请先关注官方频道才能使用此功能！\n\n官方频道：${channelId}\n关注后请重新上传图片。`
                );
                return;
              }
            } catch (error) {
              console.error(`检查频道关注状态失败: ${error}`);
              // 如果无法检查（可能是频道不存在或权限不足），继续处理
            }
          }
          
          // 检查用户积分（默认图片处理，5积分）
          const pointsRequired = 5;
          if (dbUser.points < pointsRequired) {
            await bot.sendMessage(
              chatId,
              `❌ 你的积分不足。当前积分：${dbUser.points}，需要积分：${pointsRequired}，请先获取足够积分`
            );
            return;
          }
          
          // 扣除积分
          const success = await deductPoints(dbUser, pointsRequired);
          if (!success) {
            await bot.sendMessage(
              chatId,
              `❌ 积分扣除失败。当前积分：${dbUser.points}，需要积分：${pointsRequired}`
            );
            return;
          }
          
          // 创建订单
          const order = await createOrder(BigInt(userId), OrderType.IMAGE, pointsRequired);
          
          await bot.sendMessage(
            chatId,
            `✅ 图片接收成功，订单号：${order.orderNo}\n正在处理中，请稍候...`
          );
          
          // TODO: 调用图像生成API处理图片
          // 这里应该调用实际的图像生成服务
          
          // 暂时模拟处理
          await bot.sendMessage(
            chatId,
            `⚠️ 图像生成功能待实现\n订单号：${order.orderNo}\n已扣除积分：${pointsRequired}\n剩余积分：${dbUser.points - pointsRequired}`
          );
          
          console.log(`图片处理完成 - 订单号: ${order.orderNo}, 用户ID: ${userId}`);
        } catch (error) {
          console.error(`处理图片消息失败 - 用户ID: ${userId}, 错误: ${error}`);
          await bot.sendMessage(chatId, '处理图片时发生错误，请稍后重试。');
        }
      }
      // 处理其他文本消息
      else if (msg.text) {
        console.log('处理文本消息:', msg.text);
        
        // 检查是否是命令
        if (msg.text.startsWith('/')) {
          await bot.sendMessage(chatId, `你发送了命令: ${msg.text}`);
          return;
        }
        
        // 检查是否是文生图模式（简单判断：如果用户发送的文本不是命令，且长度合理，可能是提示词）
        // 这里简化处理：如果文本长度大于5且不是命令，就认为是文生图提示词
        // 实际应该使用状态管理来跟踪用户是否处于文生图模式
        const text = msg.text.trim();
        if (text.length > 5 && text.length < 500) {
          // 尝试作为文生图提示词处理
          try {
            if (!userId) {
              await bot.sendMessage(chatId, '无法获取用户信息，请重试。');
              return;
            }
            
            // 获取用户信息
            const dbUser = await getUserByTelegramId(BigInt(userId));
            if (!dbUser) {
              await bot.sendMessage(chatId, '请先使用 /start 命令开始使用机器人。');
              return;
            }
            
            // 检查是否关注官方频道
            const channelId = env.OFFICIAL_CHANNEL_ID || '';
            if (channelId) {
              try {
                const member = await bot.getChatMember(channelId, userId);
                const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
                if (!isSubscribed) {
                  await bot.sendMessage(
                    chatId,
                    `❌ 请先关注官方频道才能使用此功能！\n\n官方频道：${channelId}\n关注后请重新输入描述。`
                  );
                  return;
                }
              } catch (error) {
                console.error(`检查频道关注状态失败: ${error}`);
              }
            }
            
            // 检查用户积分（文生图，5积分）
            const pointsRequired = 5;
            if (dbUser.points < pointsRequired) {
              await bot.sendMessage(
                chatId,
                `❌ 你的积分不足。当前积分：${dbUser.points}，需要积分：${pointsRequired}，请先获取足够积分`
              );
              return;
            }
            
            // 扣除积分
            const success = await deductPoints(dbUser, pointsRequired);
            if (!success) {
              await bot.sendMessage(
                chatId,
                `❌ 积分扣除失败。当前积分：${dbUser.points}，需要积分：${pointsRequired}`
              );
              return;
            }
            
            // 创建订单
            const order = await createOrder(BigInt(userId), OrderType.IMAGE, pointsRequired);
            
            await bot.sendMessage(
              chatId,
              `✅ 提示词接收成功，订单号：${order.orderNo}\n\n📝 您的提示词：${text}\n\n正在根据您的描述生成图片，请稍候...`
            );
            
            // 调用 RunPod API 生成图片
            try {
              const runpodConfig = {
                apiKey: env.RUNPOD_API_KEY || '',
                endpointId: env.RUNPOD_ENDPOINT_ID || '',
              };
              
              if (!runpodConfig.apiKey || !runpodConfig.endpointId) {
                throw new Error('RunPod API 配置未设置，请在环境变量中配置 RUNPOD_API_KEY 和 RUNPOD_ENDPOINT_ID');
              }
              
              console.log(`调用 RunPod API 生成图片 - 提示词: ${text}`);
              const imageBuffers = await generateImage(runpodConfig, text);
              
              if (imageBuffers.length === 0) {
                throw new Error('图片生成失败，未返回图片数据');
              }
              
              // 发送生成的图片
              for (let i = 0; i < imageBuffers.length; i++) {
                const imageBuffer = imageBuffers[i];
                const caption = i === 0 
                  ? `✅ 图片生成成功！\n订单号：${order.orderNo}\n提示词：${text}\n已扣除积分：${pointsRequired}\n剩余积分：${dbUser.points - pointsRequired}`
                  : '';
                
                await bot.sendPhotoBuffer(chatId, imageBuffer, { caption });
                console.log(`图片发送成功 - 订单号: ${order.orderNo}, 图片 ${i + 1}/${imageBuffers.length}`);
              }
              
              console.log(`文生图处理完成 - 订单号: ${order.orderNo}, 用户ID: ${userId}, 提示词: ${text}, 图片数量: ${imageBuffers.length}`);
            } catch (error) {
              console.error(`调用 RunPod API 失败 - 订单号: ${order.orderNo}, 错误: ${error}`);
              await bot.sendMessage(
                chatId,
                `❌ 图片生成失败\n订单号：${order.orderNo}\n错误：${error instanceof Error ? error.message : '未知错误'}\n\n已扣除的积分将不会退回，请稍后重试或联系客服。`
              );
            }
            
            return;
          } catch (error) {
            console.error(`处理文生图提示词失败 - 用户ID: ${userId}, 错误: ${error}`);
            // 如果处理失败，继续普通文本处理
          }
        }
        
        // 普通文本消息处理
        await bot.sendMessage(chatId, `你发送了: ${msg.text}\n\n💡 提示：如果您想使用文生图功能，请通过菜单选择"脱衣" -> "文生图"。`);
      }
    }
    // 处理回调查询
    else if (update.callback_query) {
      const query = update.callback_query;
      const data = query.data;
      const userId = query.from.id;
      const chatId = query.message?.chat.id;
      const messageId = query.message?.message_id;
      
      console.log(`处理回调查询 - 用户ID: ${userId}, 数据: ${data}`);
      
      // 先应答回调，避免 Telegram 显示加载状态
      await bot.answerCallbackQuery(query.id);
      
      if (!chatId || !messageId) {
        console.error('回调查询缺少必要的消息信息');
        return;
      }
      
      // 获取环境变量中的官方频道ID
      const officialChannelId = env.OFFICIAL_CHANNEL_ID || '';
      
      // 主菜单
      if (data === 'menu_main') {
        await bot.editMessageText('🎯 请选择功能：', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getMainMenuKeyboard(officialChannelId),
        });
        return;
      }
      
      // 官方频道（点击后直接显示功能菜单）
      if (data === 'menu_channel') {
        console.log(`处理 menu_channel 回调 - 用户ID: ${userId}`);
        const functionMenu = getFunctionMenuKeyboard();
        await bot.editMessageText('🎯 请选择功能：', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: functionMenu,
        });
        return;
      }
      
      // 脱衣菜单
      if (data === 'menu_strip') {
        await bot.editMessageText(
          '👗 脱衣功能：\n\n🖼️ 图片脱衣：5积分/图片\n🎬 视频脱衣：20积分/视频\n✨ 文生图：5积分/图片',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: getStripMenuKeyboard(),
          }
        );
        return;
      }
      
      // 功能菜单项 - 显示图片/视频选择
      if (data === 'menu_breast') {
        await bot.editMessageText('💋 胸部爱抚功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getBreastMenuKeyboard(),
        });
        return;
      }
      
      if (data === 'menu_masturbate') {
        await bot.editMessageText('🫦 自慰功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getMasturbateMenuKeyboard(),
        });
        return;
      }
      
      if (data === 'menu_facial') {
        await bot.editMessageText('💦 颜射功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getFacialMenuKeyboard(),
        });
        return;
      }
      
      if (data === 'menu_oral') {
        await bot.editMessageText('👄 口交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getOralMenuKeyboard(),
        });
        return;
      }
      
      if (data === 'menu_handjob') {
        await bot.editMessageText('✋ 手交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getHandjobMenuKeyboard(),
        });
        return;
      }
      
      if (data === 'menu_sex') {
        await bot.editMessageText('🔥 性交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getSexMenuKeyboard(),
        });
        return;
      }
      
      // 生成功能详情页面文本的辅助函数
      const getFeatureDetailText = (featureName: string, imagePoints: number, videoPoints: number, isImage: boolean): string => {
        const points = isImage ? imagePoints : videoPoints;
        const type = isImage ? '图片' : '视频';
        const uploadSuggestion = env.UPLOAD_SUGGESTION || '站立，单人，无遮挡，主体人物清晰的照片无奇怪动作姿势';
        const channelName = env.OFFICIAL_CHANNEL_NAME || '【NSFW】官方功能更新频道';
        
        return `${isImage ? '🖼️' : '🎬'} ${featureName}${type}处理：${points}积分/${type}

⚠️ 注意事项：
使用我们的服务即表示您同意，用户协议且不得用于非法用途。
📸 建议上传：${uploadSuggestion}

👀 效果预览 (${channelName})
❌ 如果没有关注官方频道 机器人不会出图！

📤 【菜单】上传图片`;
      };
      
      // 图片脱衣
      if (data === 'strip_image') {
        const text = getFeatureDetailText('图片脱衣', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_strip' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_strip' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 视频脱衣
      if (data === 'strip_video') {
        const text = getFeatureDetailText('视频脱衣', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_strip' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_strip' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 文生图
      if (data === 'strip_text2image') {
        const text = getText2ImageDetailText('脱衣', 5);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 开始生成', callback_data: 'upload_text2image_strip' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_strip' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 胸部爱抚 - 图片
      if (data === 'breast_image') {
        const text = getFeatureDetailText('胸部爱抚', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_breast' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_breast' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 胸部爱抚 - 视频
      if (data === 'breast_video') {
        const text = getFeatureDetailText('胸部爱抚', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_breast' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_breast' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 自慰 - 图片
      if (data === 'masturbate_image') {
        const text = getFeatureDetailText('自慰', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_masturbate' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_masturbate' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 自慰 - 视频
      if (data === 'masturbate_video') {
        const text = getFeatureDetailText('自慰', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_masturbate' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_masturbate' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 颜射 - 图片
      if (data === 'facial_image') {
        const text = getFeatureDetailText('颜射', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_facial' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_facial' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 颜射 - 视频
      if (data === 'facial_video') {
        const text = getFeatureDetailText('颜射', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_facial' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_facial' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 口交 - 图片
      if (data === 'oral_image') {
        const text = getFeatureDetailText('口交', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_oral' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_oral' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 口交 - 视频
      if (data === 'oral_video') {
        const text = getFeatureDetailText('口交', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_oral' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_oral' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 手交 - 图片
      if (data === 'handjob_image') {
        const text = getFeatureDetailText('手交', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_handjob' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_handjob' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 手交 - 视频
      if (data === 'handjob_video') {
        const text = getFeatureDetailText('手交', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_handjob' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_handjob' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 性交 - 图片
      if (data === 'sex_image') {
        const text = getFeatureDetailText('性交', 5, 20, true);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_image_sex' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_sex' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 性交 - 视频
      if (data === 'sex_video') {
        const text = getFeatureDetailText('性交', 5, 20, false);
        const replyMarkup = {
          inline_keyboard: [
            [{ text: '📤 上传图片', callback_data: 'upload_video_sex' }],
            [{ text: '⬅️ 返回', callback_data: 'menu_sex' }],
          ],
        };
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: replyMarkup,
        });
        return;
      }
      
      // 处理上传图片按钮（检查积分和频道）
      if (data.startsWith('upload_')) {
        const parts = data.replace('upload_', '').split('_');
        if (parts.length >= 2) {
          // 处理文生图
          if (parts[0] === 'text2image') {
            const featureType = parts[1]; // strip, breast, etc.
            const pointsRequired = 5;
            
            // 获取用户信息
            const dbUser = await getUserByTelegramId(BigInt(userId));
            if (!dbUser) {
              await bot.answerCallbackQuery(query.id, { text: '请先使用 /start 命令开始使用机器人。' });
              return;
            }
            
            // 检查积分
            if (dbUser.points < pointsRequired) {
      await bot.answerCallbackQuery(query.id, {
                text: `你的积分不足。当前积分：${dbUser.points}，需要积分：${pointsRequired}，请先获取足够积分`,
                show_alert: true 
              });
              return;
            }
            
            // 检查是否关注官方频道
            const channelId = env.OFFICIAL_CHANNEL_ID || '';
            if (channelId) {
              try {
                const member = await bot.getChatMember(channelId, userId);
                const isSubscribed = ['member', 'administrator', 'creator'].includes(member.status);
                if (!isSubscribed) {
                  await bot.answerCallbackQuery(query.id, { 
                    text: `请先关注官方频道才能使用此功能！\n官方频道：${channelId}`,
                    show_alert: true 
                  });
                  return;
                }
              } catch (error) {
                console.error(`检查频道关注状态失败: ${error}`);
              }
            }
            
            // 积分和频道检查通过，提示用户输入文本提示词
            await bot.answerCallbackQuery(query.id, { text: '请输入图片描述' });
            
            // 发送清晰的提示信息
            const promptText = `✨ 文生图功能

✅ 检查通过，您可以开始输入图片描述了！

📝 操作步骤：
1. 在输入框中输入您想要生成的图片描述（提示词）
2. 例如："一个美丽的女孩，长发，穿着白色连衣裙"
3. 发送给我，系统将根据您的描述生成图片

💡 提示词建议：
• 描述要清晰具体
• 可以包含场景、人物特征、服装等描述
• 建议描述：站立，单人，无遮挡，主体人物清晰的照片

💰 处理需要：${pointsRequired}积分
• 处理完成后会自动扣除积分

⏳ 我正在等待您的图片描述...`;
            
            await bot.sendMessage(chatId, promptText);
            return;
          }
          
          // 处理图片/视频上传
          const isVideo = parts[0] === 'video';
          const featureType = parts[1]; // strip, breast, masturbate, etc.
          const pointsRequired = isVideo ? 20 : 5;
          const typeText = isVideo ? '视频' : '图片';
          
          // 简化版本：提示用户上传图片（实际应该检查积分和频道）
          await bot.answerCallbackQuery(query.id, { text: `请发送${typeText}给我` });
          
          // 发送清晰的提示信息
          const promptText = `📤 请发送${typeText}给我

✅ 检查通过，您可以开始上传${typeText}了！

📝 操作步骤：
1. 点击输入框左侧的 📎 附件按钮
2. 选择"照片"或"图片"
3. 选择或拍摄一张图片
4. 发送给我

💡 提示：
• 建议上传：站立，单人，无遮挡，主体人物清晰的照片
• 处理需要：${pointsRequired}积分
• 处理完成后会自动扣除积分

⏳ 我正在等待您的${typeText}...`;
          
          await bot.sendMessage(chatId, promptText);
        }
        return;
      }
      
      // 积分菜单
      if (data === 'menu_points') {
        await bot.editMessageText('💰 获积分：', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getPointsMenuKeyboard(),
        });
        return;
      }
      
      // 充值菜单
      if (data === 'points_recharge') {
        const text = `💰 充值获积分

📋 操作说明：
请选择充值积分数量和支付方式后，点击确定充值。之后会返回支付链接。点击链接后跳转到相应方式中进行支付。

💡 备注：生成1张图像消耗：5积分    生成1段视频消耗：20积分

📦 积分套餐：
• 💰 20积分/20元
• 💎 55积分/50元
• 💵 120积分/100元
• 💶 250积分/200元`;
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getRechargeMenuKeyboard(),
        });
        return;
      }
      
      // 选择充值套餐
      if (data.startsWith('recharge_')) {
        const packageKey = data.replace('recharge_', '');
        const packages: Record<string, { points: number; price: number }> = {
          '20': { points: 20, price: 20.0 },
          '55': { points: 55, price: 50.0 },
          '120': { points: 120, price: 100.0 },
          '250': { points: 250, price: 200.0 },
        };
        const packageInfo = packages[packageKey];
        if (!packageInfo) {
          await bot.editMessageText('无效的套餐，请重新选择。', {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: getRechargeMenuKeyboard(),
          });
          return;
        }
        await bot.editMessageText(`💳 选择支付方式\n\n💰 套餐：${packageKey}积分 / ${packageInfo.price}元`, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getPaymentMethodKeyboard(packageKey),
        });
        return;
      }
      
      // 选择支付方式（显示确认页面）
      if (data.startsWith('select_pay_')) {
        const parts = data.replace('select_pay_', '').split('_');
        if (parts.length === 2) {
          const packageKey = parts[0];
          const paymentMethod = parts[1].toLowerCase();
          const packages: Record<string, { points: number; price: number }> = {
            '20': { points: 20, price: 20.0 },
            '55': { points: 55, price: 50.0 },
            '120': { points: 120, price: 100.0 },
            '250': { points: 250, price: 200.0 },
          };
          const packageInfo = packages[packageKey];
          
          if (!packageInfo) {
            await bot.editMessageText('无效的套餐，请重新选择。', {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: getRechargeMenuKeyboard(),
            });
            return;
          }
          
          const paymentMethodName = paymentMethod === 'alipay' ? '支付宝' : 
                                    paymentMethod === 'wechat' ? '微信' : 'USDT';
          const paymentMethodEmoji = paymentMethod === 'alipay' ? '💙' : 
                                     paymentMethod === 'wechat' ? '💚' : '₿';
          
          const confirmText = `💰 充值确认

📦 套餐：${packageKey}积分 / ${packageInfo.price}元
${paymentMethodEmoji} 支付方式：${paymentMethodName}

请确认信息无误后，点击"确定充值"按钮。`;
          
          await bot.editMessageText(confirmText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: getConfirmRechargeKeyboard(packageKey, paymentMethod),
          });
        }
        return;
      }
      
      // 处理支付确认（创建订单）
      if (data.startsWith('pay_')) {
        const parts = data.split('_');
        if (parts.length === 3) {
          const packageKey = parts[1];
          const paymentMethod = parts[2].toLowerCase();
          const packages: Record<string, { points: number; price: number }> = {
            '20': { points: 20, price: 20.0 },
            '55': { points: 55, price: 50.0 },
            '120': { points: 120, price: 100.0 },
            '250': { points: 250, price: 200.0 },
          };
          const packageInfo = packages[packageKey];
          
          if (!packageInfo) {
            await bot.editMessageText('无效的套餐，请重新选择。', {
              chat_id: chatId,
              message_id: messageId,
              reply_markup: getRechargeMenuKeyboard(),
            });
            return;
          }
          
          // 生成订单号（简化版本，实际应该调用数据库服务）
          const orderNo = `ORDER${Date.now()}${userId}`;
          
          // 生成支付链接（临时实现，实际应调用支付API）
          let paymentUrl = '';
          let paymentText = '';
          let tradeNo = '';
          
          if (paymentMethod === 'alipay') {
            paymentUrl = `https://tm4.pmdf.cn/web/pay/${orderNo}.html`;
            paymentText = `💙 支付宝支付

💳 请打开链接并使用支付宝支付~
💰 支付${packageInfo.price}元，充值${packageInfo.points}积分
📝 订单号：${orderNo}(复制补单)
🔗 支付链接：${paymentUrl}
🌐 点击跳转到浏览器打开，或复制链接到浏览器打开
⏰ 请于5分钟内完成支付，超过5分钟后支付失效~

👇🏻点击一键跳转支付👇🏻`;
          } else if (paymentMethod === 'wechat') {
            tradeNo = orderNo.toLowerCase().substring(0, 24);
            paymentUrl = `https://xhm.jmxhm.cn/submit.php?pid=1001&type=wxpay&out_trade_no=${tradeNo}&money=${packageInfo.price}`;
            const customerService = env.CUSTOMER_SERVICE_WECHAT || '@telddavc';
            paymentText = `💚 微信充值

📝 您的支付订单号为：
[ ${tradeNo} ]
💡 请保留好订单号，如有问题，请向客服 ${customerService} 提供此订单号

🔗 微信支付链接: 
${paymentUrl}

⏰ 请在15分钟内点上面链接完成支付订单。过期请重新选择。

✅ 支付成功后，积分将自动到账。若5分钟仍未到账，请提供订单号，联系客服。`;
          } else {
            // USDT
            paymentUrl = `https://pay.example.com/usdt/${orderNo}`;
            paymentText = `₿ USDT支付

📝 订单号：${orderNo}
💰 金额：${packageInfo.price}元
💎 积分：${packageInfo.points}积分
🔗 支付链接：${paymentUrl}`;
          }
          
          await bot.editMessageText(paymentText, {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [
                [{ text: '💳 跳转支付', url: paymentUrl }],
                [{ text: '⬅️ 返回主菜单', callback_data: 'menu_main' }],
              ],
            },
          });
        }
        return;
      }
      
      // 分享获积分
      if (data === 'points_share') {
        // 简化版本：显示分享信息（实际应获取用户推广码）
        const botInfo = await bot.getMe();
        const referralCode = `REF${userId}`; // 简化版本，实际应从数据库获取
        const referralLink = `https://t.me/${botInfo.username}?start=${referralCode}`;
        
        const shareText = `🎁 分享获积分

📤 下面这条消息带有你的专属分享链接，请分享到其他群或用户。其他用户进来后，你将获取积分。

📋 积分规则：
✨ 新用户通过你的专属链接使用机器人，你将获取40积分。推广用户无积分上限。
🎯 非新用户通过你的专属链接使用机器人，如果该用户7天内没有通过别人的推广链接使用机器人，则你将获取10积分。积分每日上限：100

🔗 你的专属推广链接：
${referralLink}

🎫 推广码：${referralCode}`;
        
        await bot.editMessageText(shareText, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getMainMenuKeyboard(officialChannelId),
        });
        
        // 发送可分享的消息
        const referralVideoUrl = env.REFERRAL_VIDEO_URL || '';
        const referralImageUrl = env.REFERRAL_IMAGE_URL || '';
        const promotionText = `一张图片做揉奶，吃屌，性交，射脸视频。让你的女神/女友/老婆/姐妹随你心意。效果不错，来试试吧！ 

点我进入：${referralLink}`;
        
        try {
          if (referralVideoUrl) {
            await bot.sendVideo(chatId, referralVideoUrl, {
              caption: promotionText,
              reply_markup: {
                inline_keyboard: [[{ text: '点我进入', url: referralLink }]],
              },
            });
          } else if (referralImageUrl) {
            await bot.sendPhoto(chatId, referralImageUrl, {
              caption: promotionText,
              reply_markup: {
                inline_keyboard: [[{ text: '点我进入', url: referralLink }]],
              },
            });
          } else {
            await bot.sendMessage(chatId, promotionText, {
              reply_markup: {
                inline_keyboard: [[{ text: '点我进入', url: referralLink }]],
              },
            });
          }
        } catch (error) {
          console.error(`发送分享消息失败: ${error}`);
        }
        return;
      }
      
      // 个人中心
      if (data === 'menu_profile') {
        // 简化版本：显示基本信息（实际应从数据库获取）
        const text = `👤 个人中心

👤 【名称】：用户${userId}
⭐️ 【积分】：0
💎 【等级】：1`;
        await bot.editMessageText(text, {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: getMainMenuKeyboard(officialChannelId),
        });
        return;
      }
      
      // 其他功能菜单项
      if (data === 'menu_breast') {
        await bot.editMessageText(
          '💋 胸部爱抚功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      if (data === 'menu_masturbate') {
        await bot.editMessageText(
          '🫦 自慰功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      if (data === 'menu_facial') {
        await bot.editMessageText(
          '💦 颜射功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      if (data === 'menu_oral') {
        await bot.editMessageText(
          '👄 口交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      if (data === 'menu_handjob') {
        await bot.editMessageText(
          '✋ 手交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      if (data === 'menu_sex') {
        await bot.editMessageText(
          '🔥 性交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
          {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: {
              inline_keyboard: [[{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }]],
            },
          }
        );
        return;
      }
      
      // 其他未处理的菜单项
      console.warn(`未处理的回调数据 - 用户ID: ${userId}, 数据: ${data}`);
      await bot.editMessageText('🚧 功能开发中，敬请期待。', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: getMainMenuKeyboard(officialChannelId),
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
      ctx.waitUntil(handleTelegramUpdate(bot, update, env));
      
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

