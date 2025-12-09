/**
 * 支付服务
 * 
 * @author seven
 * @since 2024
 */
import { Payment } from '@prisma/client';
import { getPrisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { generateOrderNo } from '@/lib/helpers';
import { PaymentMethod, PaymentStatus } from '@/lib/constants';

/**
 * 积分套餐配置
 */
export const POINTS_PACKAGES: Record<string, { points: number; price: number }> = {
  '20': { points: 20, price: 20.0 },
  '55': { points: 55, price: 50.0 },
  '120': { points: 120, price: 100.0 },
  '250': { points: 250, price: 200.0 },
};

/**
 * 创建支付订单
 * 
 * @param {bigint} userId - 用户 Telegram ID
 * @param {string} packageKey - 套餐 key
 * @param {PaymentMethod} paymentMethod - 支付方式
 * @return {Promise<Payment>} 支付对象
 * @author seven
 * @since 2024
 */
export async function createPayment(
  userId: bigint,
  packageKey: string,
  paymentMethod: PaymentMethod
): Promise<Payment> {
  try {
    logger.info(`创建支付订单 - 用户ID: ${userId}, 套餐: ${packageKey}, 支付方式: ${paymentMethod}`);
    
    if (!(packageKey in POINTS_PACKAGES)) {
      throw new Error(`无效的套餐key: ${packageKey}`);
    }
    
    const prisma = getPrisma();
    const packageInfo = POINTS_PACKAGES[packageKey];
    const orderNo = generateOrderNo();
    
    const payment = await prisma.payment.create({
      data: {
        userId,
        orderNo,
        paymentMethod,
        status: PaymentStatus.PENDING,
        amount: packageInfo.price,
        points: packageInfo.points,
      },
    });
    
    logger.info(`支付订单创建成功 - 订单号: ${orderNo}, 用户ID: ${userId}, 金额: ${packageInfo.price}, 积分: ${packageInfo.points}`);
    return payment;
  } catch (error) {
    logger.error(`创建支付订单失败 - 用户ID: ${userId}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 根据订单号获取支付订单
 * 
 * @param {string} orderNo - 订单号
 * @return {Promise<Payment | null>} 支付对象，不存在返回 null
 * @author seven
 * @since 2024
 */
export async function getPaymentByNo(orderNo: string): Promise<Payment | null> {
  try {
    logger.debug(`查询支付订单 - 订单号: ${orderNo}`);
    const prisma = getPrisma();
    const payment = await prisma.payment.findUnique({
      where: { orderNo },
    });
    return payment;
  } catch (error) {
    logger.error(`查询支付订单失败 - 订单号: ${orderNo}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 更新支付链接
 * 
 * @param {Payment} payment - 支付对象
 * @param {string} paymentUrl - 支付链接
 * @return {Promise<Payment>} 更新后的支付对象
 * @author seven
 * @since 2024
 */
export async function updatePaymentUrl(payment: Payment, paymentUrl: string): Promise<Payment> {
  try {
    logger.info(`更新支付链接 - 订单号: ${payment.orderNo}, URL: ${paymentUrl}`);
    
    const prisma = getPrisma();
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: { paymentUrl },
    });
    
    logger.info(`支付链接更新成功 - 订单号: ${payment.orderNo}`);
    return updatedPayment;
  } catch (error) {
    logger.error(`更新支付链接失败 - 订单号: ${payment.orderNo}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 完成支付
 * 
 * @param {Payment} payment - 支付对象
 * @param {string} paidAt - 支付时间（可选）
 * @return {Promise<Payment>} 更新后的支付对象
 * @author seven
 * @since 2024
 */
export async function completePayment(payment: Payment, paidAt?: string): Promise<Payment> {
  try {
    logger.info(`完成支付 - 订单号: ${payment.orderNo}`);
    
    const prisma = getPrisma();
    const paidAtTime = paidAt || new Date().toISOString();
    
    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID,
        paidAt: paidAtTime,
      },
    });
    
    logger.info(`支付完成 - 订单号: ${payment.orderNo}, 支付时间: ${paidAtTime}`);
    return updatedPayment;
  } catch (error) {
    logger.error(`完成支付失败 - 订单号: ${payment.orderNo}, 错误: ${error}`);
    throw error;
  }
}

