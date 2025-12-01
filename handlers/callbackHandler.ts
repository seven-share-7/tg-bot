/**
 * 回调查询处理器
 * 
 * @author seven
 * @since 2024
 */
import TelegramBot from 'node-telegram-bot-api';
import logger from '@/lib/logger';
import {
  getMainMenuKeyboard,
  getFunctionMenuKeyboard,
  getStripMenuKeyboard,
  getPointsMenuKeyboard,
  getRechargeMenuKeyboard,
  getPaymentMethodKeyboard,
  getConfirmRechargeKeyboard,
} from '@/lib/menu';
import { getUserByTelegramId } from '@/services/userService';
import { createPayment, updatePaymentUrl } from '@/services/paymentService';
import { createAlipayPayment, createWechatPayment, createUsdtPayment } from '@/services/paymentApi';
import { PaymentMethod } from '@/lib/constants';
import { getReferralLink } from '@/services/referralService';
import { checkUserSubscribed } from '@/services/channelService';
import { config } from '@/lib/config';
import { POINTS_PACKAGES } from '@/services/paymentService';

/**
 * 处理回调查询
 * 
 * @param {TelegramBot} bot - Bot 实例
 * @param {TelegramBot.CallbackQuery} query - 回调查询对象
 * @author seven
 * @since 2024
 */
export async function handleCallbackQuery(
  bot: TelegramBot,
  query: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    if (!query.data || !query.message) {
      return;
    }
    
    await bot.answerCallbackQuery(query.id);
    
    const data = query.data;
    const userId = query.from.id;
    
    logger.info(`收到回调查询 - 用户ID: ${userId}, 数据: ${data}`);
    
    // 主菜单
    if (data === 'menu_main') {
      await bot.editMessageText('🎯 请选择功能：', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: getMainMenuKeyboard(config.officialChannelId),
      });
      return;
    }
    
    // 脱衣菜单
    if (data === 'menu_strip') {
      await bot.editMessageText(
        '👗 脱衣功能：\n\n🖼️ 图片脱衣：5积分/图片\n🎬 视频脱衣：20积分/视频',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getStripMenuKeyboard(),
        }
      );
      return;
    }
    
    // 官方频道（点击后直接显示功能菜单）
    if (data === 'menu_channel') {
      logger.info(`处理 menu_channel 回调 - 用户ID: ${userId}`);
      try {
        // 直接显示功能菜单，不检查是否关注
        const functionMenu = getFunctionMenuKeyboard();
        logger.info(`功能菜单生成成功，按钮数量: ${functionMenu.inline_keyboard.length}`);
        
        await bot.editMessageText(
          '🎯 请选择功能：',
          {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: functionMenu,
          }
        );
        logger.info(`功能菜单显示成功 - 用户ID: ${userId}`);
        return;
      } catch (error) {
        logger.error(`显示功能菜单失败 - 用户ID: ${userId}, 错误: ${error}`);
        throw error;
      }
    }
    
    // 积分菜单
    if (data === 'menu_points') {
      await bot.editMessageText('💰 获积分：', {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
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
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: getRechargeMenuKeyboard(),
      });
      return;
    }
    
    // 选择充值套餐
    if (data.startsWith('recharge_')) {
      const packageKey = data.replace('recharge_', '');
      const packageInfo = POINTS_PACKAGES[packageKey];
      if (!packageInfo) {
        await bot.editMessageText('无效的套餐，请重新选择。', {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getRechargeMenuKeyboard(),
        });
        return;
      }
      await bot.editMessageText(`💳 选择支付方式\n\n💰 套餐：${packageKey}积分 / ${packageInfo.price}元`, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
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
        const packageInfo = POINTS_PACKAGES[packageKey];
        
        if (!packageInfo) {
          await bot.editMessageText('无效的套餐，请重新选择。', {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
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
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getConfirmRechargeKeyboard(packageKey, paymentMethod),
        });
      }
      return;
    }
    
    // 个人中心
    if (data === 'menu_profile') {
      const dbUser = await getUserByTelegramId(BigInt(userId));
      if (dbUser) {
        const username = dbUser.username ? `@${dbUser.username}` : '未设置';
        const text = `👤 个人中心

👤 【名称】：${username}
⭐️ 【积分】：${dbUser.points}
💎 【等级】：${dbUser.level}`;
        await bot.editMessageText(text, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getMainMenuKeyboard(config.officialChannelId),
        });
      } else {
        await bot.editMessageText('用户不存在，请重新开始。', {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getMainMenuKeyboard(config.officialChannelId),
        });
      }
      return;
    }
    
    // 处理支付
    if (data.startsWith('pay_')) {
      const parts = data.split('_');
      if (parts.length === 3) {
        const packageKey = parts[1];
        const paymentMethodStr = parts[2].toUpperCase();
        
        try {
          const paymentMethod = paymentMethodStr as PaymentMethod;
          
          if (!Object.values(PaymentMethod).includes(paymentMethod)) {
            throw new Error(`无效的支付方式: ${paymentMethodStr}`);
          }
          
          const payment = await createPayment(BigInt(userId), packageKey, paymentMethod);
          
          let text = '';
          let replyMarkup: TelegramBot.InlineKeyboardMarkup;
          
          if (paymentMethod === PaymentMethod.ALIPAY) {
            const paymentUrl = await createAlipayPayment(payment);
            await updatePaymentUrl(payment, paymentUrl);
            
            text = `💙 支付宝支付

💳 请打开链接并使用支付宝支付~
💰 支付${payment.amount}元，充值${payment.points}积分
📝 订单号：${payment.orderNo}(复制补单)
🔗 支付链接：${paymentUrl}
🌐 点击跳转到浏览器打开，或复制链接到浏览器打开
⏰ 请于5分钟内完成支付，超过5分钟后支付失效~

👇🏻点击一键跳转支付👇🏻`;
            
            replyMarkup = {
              inline_keyboard: [
                [{ text: '💳 跳转支付', url: paymentUrl }],
                [{ text: '⬅️ 返回主菜单', callback_data: 'menu_main' }],
              ],
            };
          } else if (paymentMethod === PaymentMethod.WECHAT) {
            const { tradeNo, paymentUrl } = await createWechatPayment(payment);
            await updatePaymentUrl(payment, paymentUrl);
            
            const customerService = config.customerService?.wechatUsername || '@telddavc';
            
            text = `💚 微信充值

📝 您的支付订单号为：
[ ${tradeNo} ]
💡 请保留好订单号，如有问题，请向客服 ${customerService} 提供此订单号

🔗 微信支付链接: 
${paymentUrl}

⏰ 请在15分钟内点上面链接完成支付订单。过期请重新选择。

✅ 支付成功后，积分将自动到账。若5分钟仍未到账，请提供订单号，联系客服。`;
            
            replyMarkup = {
              inline_keyboard: [
                [{ text: '💳 跳转支付', url: paymentUrl }],
                [{ text: '⬅️ 返回主菜单', callback_data: 'menu_main' }],
              ],
            };
          } else {
            // USDT
            const paymentUrl = await createUsdtPayment(payment);
            await updatePaymentUrl(payment, paymentUrl);
            
            text = `₿ USDT支付

📝 订单号：${payment.orderNo}
💰 金额：${payment.amount}元
💎 积分：${payment.points}积分
🔗 支付链接：${paymentUrl}`;
            
            replyMarkup = {
              inline_keyboard: [
                [{ text: '💳 跳转支付', url: paymentUrl }],
                [{ text: '⬅️ 返回主菜单', callback_data: 'menu_main' }],
              ],
            };
          }
          
          await bot.editMessageText(text, {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: replyMarkup,
          });
        } catch (error) {
          logger.error(`创建支付订单失败 - 用户ID: ${userId}, 错误: ${error}`);
          await bot.editMessageText('创建支付订单失败，请稍后重试。', {
            chat_id: query.message.chat.id,
            message_id: query.message.message_id,
            reply_markup: getMainMenuKeyboard(config.officialChannelId),
          });
        }
      }
      return;
    }
    
    // 分享获积分
    if (data === 'points_share') {
      const dbUser = await getUserByTelegramId(BigInt(userId));
      if (dbUser) {
        const botInfo = await bot.getMe();
        const referralLink = getReferralLink(botInfo.username || '', dbUser.referralCode);
        
        const shareText = `🎁 分享获积分

📤 下面这条消息带有你的专属分享链接，请分享到其他群或用户。其他用户进来后，你将获取积分。

📋 积分规则：
✨ 新用户通过你的专属链接使用机器人，你将获取40积分。推广用户无积分上限。
🎯 非新用户通过你的专属链接使用机器人，如果该用户7天内没有通过别人的推广链接使用机器人，则你将获取10积分。积分每日上限：100

🔗 你的专属推广链接：
${referralLink}

🎫 推广码：${dbUser.referralCode}`;
        
        // 先发送说明信息
        await bot.editMessageText(shareText, {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getMainMenuKeyboard(config.officialChannelId),
        });
        
        // 发送可分享的消息（包含视频/图片和推广链接）
        try {
          const referralVideoUrl = config.referral?.videoUrl;
          const referralImageUrl = config.referral?.imageUrl;
          
          const promotionText = `一张图片做揉奶，吃屌，性交，射脸视频。让你的女神/女友/老婆/姐妹随你心意。效果不错，来试试吧！ 

点我进入：${referralLink}`;
          
          // 如果有视频URL，发送视频
          if (referralVideoUrl) {
            await bot.sendVideo(query.message.chat.id, referralVideoUrl, {
              caption: promotionText,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '点我进入', url: referralLink }],
                ],
              },
            });
          } 
          // 如果有图片URL，发送图片
          else if (referralImageUrl) {
            await bot.sendPhoto(query.message.chat.id, referralImageUrl, {
              caption: promotionText,
              reply_markup: {
                inline_keyboard: [
                  [{ text: '点我进入', url: referralLink }],
                ],
              },
            });
          } 
          // 如果没有配置视频/图片，只发送文本
          else {
            await bot.sendMessage(query.message.chat.id, promotionText, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: '点我进入', url: referralLink }],
                ],
              },
            });
          }
          
          logger.info(`分享消息发送成功 - 用户ID: ${userId}, 推广链接: ${referralLink}`);
        } catch (error) {
          logger.error(`发送分享消息失败 - 用户ID: ${userId}, 错误: ${error}`);
          // 发送失败不影响主流程，只记录错误
        }
      } else {
        await bot.editMessageText('用户不存在，请重新开始。', {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: getMainMenuKeyboard(config.officialChannelId),
        });
      }
      return;
    }
    
    // 图片脱衣
    if (data === 'strip_image') {
        const text = `🖼️ 图片脱衣：5积分/图片

⚠️ 注意事项：
使用我们的服务即表示您同意，用户协议且不得用于非法用途。
📸 建议上传：站立，单人，无遮挡，主体人物清晰的照片无奇怪动作姿势

👀 效果预览 (【NSFW】官方功能更新频道 )
❌ 如果没有关注官方频道 机器人不会出图！

📤 【菜单】上传图片`;
      
      const replyMarkup = {
        inline_keyboard: [
          [{ text: '📤 上传图片', callback_data: 'upload_image_strip' }],
          [{ text: '⬅️ 返回', callback_data: 'menu_strip' }],
        ],
      };
      
      await bot.editMessageText(text, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: replyMarkup,
      });
      return;
    }
    
    // 视频脱衣
    if (data === 'strip_video') {
        const text = `🎬 视频脱衣：20积分/视频

⚠️ 注意事项：
使用我们的服务即表示您同意 用户协议且不得用于非法用途。
📸 建议上传站立，单人，无遮挡，主体人物清晰的照片 无奇怪动作姿势

👀 效果预览 (【NSFW】官方功能更新频道 )
❌ 如果没有关注官方频道 机器人不会出图！

📤 【菜单】上传图片`;
      
      const replyMarkup = {
        inline_keyboard: [
          [{ text: '📤 上传图片', callback_data: 'upload_video_strip' }],
          [{ text: '⬅️ 返回', callback_data: 'menu_strip' }],
        ],
      };
      
      await bot.editMessageText(text, {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: replyMarkup,
      });
      return;
    }
    
    // 胸部爱抚
    if (data === 'menu_breast') {
      await bot.editMessageText(
        '💋 胸部爱抚功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 自慰
    if (data === 'menu_masturbate') {
      await bot.editMessageText(
        '🫦 自慰功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 颜射
    if (data === 'menu_facial') {
      await bot.editMessageText(
        '💦 颜射功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 口交
    if (data === 'menu_oral') {
      await bot.editMessageText(
        '👄 口交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 手交
    if (data === 'menu_handjob') {
      await bot.editMessageText(
        '✋ 手交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 性交
    if (data === 'menu_sex') {
      await bot.editMessageText(
        '🔥 性交功能：\n\n🖼️ 图片处理：5积分/图片\n🎬 视频处理：20积分/视频\n\n🚧 功能开发中，敬请期待。',
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' }],
            ],
          },
        }
      );
      return;
    }
    
    // 其他未处理的菜单项
    logger.warn(`未处理的回调数据 - 用户ID: ${userId}, 数据: ${data}`);
    await bot.editMessageText('🚧 功能开发中，敬请期待。', {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: getMainMenuKeyboard(config.officialChannelId),
    });
  } catch (error) {
    logger.error(`处理回调查询失败: ${error}`);
    if (query.message) {
      try {
        await bot.answerCallbackQuery(query.id, { text: '发生错误，请稍后重试。' });
      } catch (answerError) {
        logger.error(`回答回调查询失败: ${answerError}`);
      }
    }
    throw error;
  }
}

