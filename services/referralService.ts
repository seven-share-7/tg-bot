/**
 * 推广服务
 * 
 * @author seven
 * @since 2024
 */
import { getPrisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { getUserByTelegramId, getUserByReferralCode, addPoints } from '@/services/userService';

/**
 * 推广奖励配置
 */
const NEW_USER_BONUS = 40; // 新用户奖励
const EXISTING_USER_BONUS = 10; // 老用户奖励
const DAILY_LIMIT = 100; // 每日推广积分上限
const REFERRAL_VALID_DAYS = 7; // 推广链接有效期（天）

/**
 * 处理推广逻辑
 * 
 * @param {bigint} newUserId - 新用户 Telegram ID
 * @param {string} referralCode - 推广码
 * @return {Promise<{success: boolean, bonus: number}>} 处理结果和奖励积分
 * @author seven
 * @since 2024
 */
export async function processReferral(
  newUserId: bigint,
  referralCode: string
): Promise<{ success: boolean; bonus: number }> {
  try {
    logger.info(`处理推广 - 新用户ID: ${newUserId}, 推广码: ${referralCode}`);
    
    // 获取推广人
    const referrer = await getUserByReferralCode(referralCode);
    if (!referrer) {
      logger.warning(`推广码不存在 - 推广码: ${referralCode}`);
      return { success: false, bonus: 0 };
    }
    
    if (referrer.telegramId === newUserId) {
      logger.warning(`用户不能使用自己的推广码 - 用户ID: ${newUserId}`);
      return { success: false, bonus: 0 };
    }
    
    // 检查新用户是否已经存在
    const newUser = await getUserByTelegramId(newUserId);
    const isNewUser = !newUser || !newUser.createdAt;
    
    // 检查用户是否在7天内使用过其他推广链接
    if (!isNewUser && newUser) {
      // 如果用户已经有推广人，检查是否在有效期内
      if (newUser.referredBy && newUser.referredBy !== referrer.telegramId) {
        logger.info(`用户已有其他推广人 - 用户ID: ${newUserId}`);
        // 检查推广时间是否在7天内
        if (newUser.createdAt) {
          const daysDiff = Math.floor(
            (Date.now() - newUser.createdAt.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysDiff <= REFERRAL_VALID_DAYS) {
            logger.info(`用户在推广有效期内 - 用户ID: ${newUserId}, 天数: ${daysDiff}`);
            return { success: false, bonus: 0 };
          }
        }
      }
    }
    
    // 确定奖励积分
    let bonusPoints = isNewUser ? NEW_USER_BONUS : EXISTING_USER_BONUS;
    logger.info(`${isNewUser ? '新用户' : '老用户'}推广奖励 - 推广人ID: ${referrer.telegramId}, 奖励积分: ${bonusPoints}`);
    
    // 检查每日推广积分上限
    const today = new Date().toISOString().split('T')[0];
    
    // 获取最新的推广人信息
    const latestReferrer = await getUserByTelegramId(referrer.telegramId);
    if (!latestReferrer) {
      logger.error(`无法获取推广人信息 - 推广人ID: ${referrer.telegramId}`);
      return { success: false, bonus: 0 };
    }
    
    if (latestReferrer.lastReferralBonusDate !== today) {
      // 新的一天，重置每日积分
      const prisma = getPrisma();
      await prisma.user.update({
        where: { id: latestReferrer.id },
        data: {
          dailyReferralPoints: 0,
          lastReferralBonusDate: today,
        },
      });
      logger.info(`重置推广人每日积分 - 推广人ID: ${referrer.telegramId}, 日期: ${today}`);
    }
    
    // 重新获取以获取最新数据
    const currentReferrer = await getUserByTelegramId(referrer.telegramId);
    if (!currentReferrer) {
      logger.error(`无法获取推广人信息 - 推广人ID: ${referrer.telegramId}`);
      return { success: false, bonus: 0 };
    }
    
    // 检查是否超过每日上限
    if (currentReferrer.dailyReferralPoints + bonusPoints > DAILY_LIMIT) {
      const availableBonus = DAILY_LIMIT - currentReferrer.dailyReferralPoints;
      if (availableBonus <= 0) {
        logger.warning(`推广人今日积分已达上限 - 推广人ID: ${referrer.telegramId}`);
        return { success: false, bonus: 0 };
      }
      bonusPoints = availableBonus;
    }
    
    // 添加奖励积分
    await addPoints(currentReferrer, bonusPoints, `推广奖励 - 用户${newUserId}`);
    
    // 更新每日推广积分
    const prisma = getPrisma();
    await prisma.user.update({
      where: { id: currentReferrer.id },
      data: {
        dailyReferralPoints: {
          increment: bonusPoints,
        },
      },
    });
    
    // 更新新用户的推广人信息
    if (newUser) {
      await prisma.user.update({
        where: { id: newUser.id },
        data: {
          referredBy: referrer.telegramId,
        },
      });
    }
    
    logger.info(`推广奖励发放成功 - 推广人ID: ${referrer.telegramId}, 奖励积分: ${bonusPoints}`);
    return { success: true, bonus: bonusPoints };
  } catch (error) {
    logger.error(`处理推广失败 - 新用户ID: ${newUserId}, 推广码: ${referralCode}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 获取推广链接
 * 
 * @param {string} botUsername - Bot 用户名
 * @param {string} referralCode - 推广码
 * @return {string} 推广链接
 * @author seven
 * @since 2024
 */
export function getReferralLink(botUsername: string, referralCode: string): string {
  try {
    const link = `https://t.me/${botUsername}?start=${referralCode}`;
    logger.debug(`生成推广链接 - 推广码: ${referralCode}, 链接: ${link}`);
    return link;
  } catch (error) {
    logger.error(`生成推广链接失败 - 推广码: ${referralCode}, 错误: ${error}`);
    throw error;
  }
}

