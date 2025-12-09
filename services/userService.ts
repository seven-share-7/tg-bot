/**
 * 用户服务
 * 
 * @author seven
 * @since 2024
 */
import { PrismaClient, User } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { generateReferralCode, getUserLevel } from '@/lib/helpers';

/**
 * 获取或创建用户
 * 
 * @param {number} telegramId - Telegram 用户 ID
 * @param {string} username - 用户名（可选）
 * @param {string} firstName - 名（可选）
 * @param {string} lastName - 姓（可选）
 * @return {Promise<User>} 用户对象
 * @author seven
 * @since 2024
 */
export async function getOrCreateUser(
  telegramId: bigint,
  username?: string,
  firstName?: string,
  lastName?: string
): Promise<User> {
  try {
    logger.info(`获取或创建用户 - Telegram ID: ${telegramId}, Username: ${username}`);
    
    // 获取 Prisma 客户端实例
    const prisma = getPrisma();
    
    // 查询用户
    let user = await prisma.user.findUnique({
      where: { telegramId },
    });
    
    if (user) {
      // 更新用户信息
      logger.info(`用户已存在，更新信息 - Telegram ID: ${telegramId}`);
      user = await prisma.user.update({
        where: { telegramId },
        data: {
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
        },
      });
    } else {
      // 创建新用户
      logger.info(`创建新用户 - Telegram ID: ${telegramId}`);
      const referralCode = generateReferralCode();
      user = await prisma.user.create({
        data: {
          telegramId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          points: 0,
          level: 'P1',
          referralCode,
          isActive: true,
        },
      });
      logger.info(`新用户创建成功 - Telegram ID: ${telegramId}, 推广码: ${referralCode}`);
    }
    
    return user;
  } catch (error) {
    logger.error(`获取或创建用户失败 - Telegram ID: ${telegramId}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 根据 Telegram ID 获取用户
 * 
 * @param {bigint} telegramId - Telegram 用户 ID
 * @return {Promise<User | null>} 用户对象，不存在返回 null
 * @author seven
 * @since 2024
 */
export async function getUserByTelegramId(telegramId: bigint): Promise<User | null> {
  try {
    logger.debug(`查询用户 - Telegram ID: ${telegramId}`);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });
    return user;
  } catch (error) {
    logger.error(`查询用户失败 - Telegram ID: ${telegramId}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 根据推广码获取用户
 * 
 * @param {string} referralCode - 推广码
 * @return {Promise<User | null>} 用户对象，不存在返回 null
 * @author seven
 * @since 2024
 */
export async function getUserByReferralCode(referralCode: string): Promise<User | null> {
  try {
    logger.debug(`根据推广码查询用户 - 推广码: ${referralCode}`);
    const prisma = getPrisma();
    const user = await prisma.user.findUnique({
      where: { referralCode },
    });
    return user;
  } catch (error) {
    logger.error(`根据推广码查询用户失败 - 推广码: ${referralCode}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 给用户增加积分
 * 
 * @param {User} user - 用户对象
 * @param {number} amount - 积分数量
 * @param {string} reason - 原因（可选）
 * @return {Promise<User>} 更新后的用户对象
 * @author seven
 * @since 2024
 */
export async function addPoints(user: User, amount: number, reason?: string): Promise<User> {
  try {
    logger.info(`给用户增加积分 - 用户ID: ${user.telegramId}, 积分: ${amount}, 原因: ${reason}`);
    
    const prisma = getPrisma();
    const newPoints = user.points + amount;
    const newLevel = getUserLevel(newPoints);
    
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        points: newPoints,
        level: newLevel,
      },
    });
    
    logger.info(`用户积分增加成功 - 用户ID: ${user.telegramId}, 当前积分: ${updatedUser.points}, 等级: ${updatedUser.level}`);
    return updatedUser;
  } catch (error) {
    logger.error(`增加积分失败 - 用户ID: ${user.telegramId}, 积分: ${amount}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 扣除用户积分
 * 
 * @param {User} user - 用户对象
 * @param {number} amount - 积分数量
 * @return {Promise<boolean>} 是否成功
 * @author seven
 * @since 2024
 */
export async function deductPoints(user: User, amount: number): Promise<boolean> {
  try {
    logger.info(`扣除用户积分 - 用户ID: ${user.telegramId}, 积分: ${amount}`);
    
    if (user.points < amount) {
      logger.warning(`用户积分不足 - 用户ID: ${user.telegramId}, 当前积分: ${user.points}, 需要积分: ${amount}`);
      return false;
    }
    
    const prisma = getPrisma();
    const newPoints = user.points - amount;
    const newLevel = getUserLevel(newPoints);
    
    await prisma.user.update({
      where: { id: user.id },
      data: {
        points: newPoints,
        level: newLevel,
      },
    });
    
    logger.info(`用户积分扣除成功 - 用户ID: ${user.telegramId}, 当前积分: ${newPoints}, 等级: ${newLevel}`);
    return true;
  } catch (error) {
    logger.error(`扣除积分失败 - 用户ID: ${user.telegramId}, 积分: ${amount}, 错误: ${error}`);
    throw error;
  }
}

