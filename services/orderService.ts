/**
 * 订单服务
 * 
 * @author seven
 * @since 2024
 */
import { Order } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { generateOrderNo } from '@/lib/helpers';
import { OrderType, OrderStatus } from '@/lib/constants';

/**
 * 创建订单
 * 
 * @param {bigint} userId - 用户 Telegram ID
 * @param {OrderType} orderType - 订单类型
 * @param {number} pointsCost - 消耗积分
 * @return {Promise<Order>} 订单对象
 * @author seven
 * @since 2024
 */
export async function createOrder(
  userId: bigint,
  orderType: OrderType,
  pointsCost: number
): Promise<Order> {
  try {
    logger.info(`创建订单 - 用户ID: ${userId}, 订单类型: ${orderType}, 消耗积分: ${pointsCost}`);
    
    const prisma = getPrisma();
    const orderNo = generateOrderNo();
    const order = await prisma.order.create({
      data: {
        userId,
        orderNo,
        orderType,
        status: OrderStatus.PENDING,
        pointsCost,
      },
    });
    
    logger.info(`订单创建成功 - 订单号: ${orderNo}, 用户ID: ${userId}`);
    return order;
  } catch (error) {
    logger.error(`创建订单失败 - 用户ID: ${userId}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 根据订单号获取订单
 * 
 * @param {string} orderNo - 订单号
 * @return {Promise<Order | null>} 订单对象，不存在返回 null
 * @author seven
 * @since 2024
 */
export async function getOrderByNo(orderNo: string): Promise<Order | null> {
  try {
    logger.debug(`查询订单 - 订单号: ${orderNo}`);
    const prisma = getPrisma();
    const order = await prisma.order.findUnique({
      where: { orderNo },
    });
    return order;
  } catch (error) {
    logger.error(`查询订单失败 - 订单号: ${orderNo}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 更新订单状态
 * 
 * @param {Order} order - 订单对象
 * @param {string} status - 新状态
 * @param {string} imageUrl - 图片 URL（可选）
 * @param {string} videoUrl - 视频 URL（可选）
 * @param {string} errorMessage - 错误信息（可选）
 * @return {Promise<Order>} 更新后的订单对象
 * @author seven
 * @since 2024
 */
export async function updateOrderStatus(
  order: Order,
  status: string,
  imageUrl?: string,
  videoUrl?: string,
  errorMessage?: string
): Promise<Order> {
  try {
    logger.info(`更新订单状态 - 订单号: ${order.orderNo}, 新状态: ${status}`);
    
    const prisma = getPrisma();
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status,
        ...(imageUrl && { imageUrl }),
        ...(videoUrl && { videoUrl }),
        ...(errorMessage && { errorMessage }),
      },
    });
    
    logger.info(`订单状态更新成功 - 订单号: ${order.orderNo}, 状态: ${status}`);
    return updatedOrder;
  } catch (error) {
    logger.error(`更新订单状态失败 - 订单号: ${order.orderNo}, 错误: ${error}`);
    throw error;
  }
}

