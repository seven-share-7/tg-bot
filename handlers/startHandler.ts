/**
 * 启动命令处理器
 * 
 * @author seven
 * @since 2024
 */
import TelegramBot from 'node-telegram-bot-api';
import logger from '@/lib/logger';
import { DISCLAIMER_MESSAGE, getMainMenuKeyboard } from '@/lib/menu';
import { getOrCreateUser } from '@/services/userService';
import { processReferral } from '@/services/referralService';
import { config } from '@/lib/config';

/**
 * 处理 /start 命令
 * 
 * @param {TelegramBot} bot - Bot 实例
 * @param {TelegramBot.Message} msg - 消息对象
 * @param {string} referralCode - 推广码（可选）
 * @author seven
 * @since 2024
 */
export async function handleStartCommand(
  bot: TelegramBot,
  msg: TelegramBot.Message,
  referralCode?: string
): Promise<void> {
  try {
    const user = msg.from;
    if (!user) {
      logger.error('收到 /start 命令但无法获取用户信息');
      return;
    }
    
    logger.info(`收到 /start 命令 - 用户ID: ${user.id}, 用户名: ${user.username}, 推广码: ${referralCode || '无'}`);
    
    // 获取或创建用户
    const dbUser = await getOrCreateUser(
      BigInt(user.id),
      user.username || undefined,
      user.first_name || undefined,
      user.last_name || undefined
    );
    
    // 检查是否是推广链接
    if (referralCode) {
      logger.info(`检测到推广码: ${referralCode}, 用户ID: ${user.id}`);
      try {
        const { success, bonus } = await processReferral(
          BigInt(user.id),
          referralCode
        );
        if (success) {
          logger.info(`推广奖励发放成功 - 用户ID: ${user.id}, 奖励积分: ${bonus}`);
        }
      } catch (error) {
        logger.error(`处理推广失败 - 用户ID: ${user.id}, 推广码: ${referralCode}, 错误: ${error}`);
        // 不阻断主流程，继续执行
      }
    }
    
    // 发送免责声明
    await bot.sendMessage(
      msg.chat.id,
      DISCLAIMER_MESSAGE,
      {
        reply_markup: getMainMenuKeyboard(config.officialChannelId),
      }
    );
    
    logger.info(`启动消息发送成功 - 用户ID: ${user.id}`);
  } catch (error) {
    logger.error(`处理 /start 命令失败 - 用户ID: ${msg.from?.id}, 错误: ${error}`);
    
    // 尝试发送错误消息
    if (msg.chat) {
      try {
        await bot.sendMessage(msg.chat.id, '发生错误，请稍后重试。');
      } catch (sendError) {
        logger.error(`发送错误消息失败: ${sendError}`);
      }
    }
    
    throw error;
  }
}

