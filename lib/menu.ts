/**
 * 菜单定义
 * 
 * @author seven
 * @since 2024
 */

/**
 * Inline Keyboard Markup 类型定义（兼容 Workers）
 */
export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

/**
 * 欢迎消息
 */
export const WELCOME_MESSAGE = '🤖 黑科技AIOOXX，一款可以【去衣】【换脸】 【OOXX】的机器人，功能强大，欢迎体验。';

/**
 * 免责声明
 */
export const DISCLAIMER_MESSAGE = `本机器人的使用条款和免责声明

➡️ 本机器人是一个根据用户输入生成图像的机器人。
➡️ 但是，该机器人不对用户使用它创建的任何特定图像负责。
➡️ 使用应该由用户自行全面认识和负责。
➡️ 用户在利用此机器人时必须对内容和行为承担全部责任。
➡️ 本机器人仅是一个工具，无法控制或对用户的使用方式负责。
⭐️ 禁止用户使用机器人传播可能对个人或组织造成伤害的图像。
⭐️ 不会存储用户提交的任何信息或图像，除了TelegramID，也没有权利将用户信息用于任何目的。`;

/**
 * 根据频道 ID 生成频道 URL
 * 
 * @param {string} channelId - 频道 ID（@channel_name 或数字 ID）
 * @return {string} 频道 URL，如果未配置则返回空字符串
 * @author seven
 * @since 2024
 */
function getChannelUrl(channelId: string): string {
  // 检查是否为空或占位符
  if (!channelId || 
      channelId === '@your_official_channel' || 
      channelId === 'your_official_channel' ||
      channelId.includes('your_official_channel')) {
    return ''; // 返回空字符串表示未配置
  }
  
  // 如果已经是完整 URL，直接返回
  if (channelId.startsWith('http')) {
    return channelId;
  }
  
  // 如果是 @channel_name 格式，转换为 URL
  if (channelId.startsWith('@')) {
    return `https://t.me/${channelId.substring(1)}`;
  }
  
  // 如果是数字 ID，需要特殊处理（Telegram 频道数字 ID 需要特殊格式）
  // 这里假设是 @ 格式，如果不是，返回默认值
  return `https://t.me/${channelId}`;
}

/**
 * 获取主菜单键盘（不包含功能按钮，需要先关注频道）
 * 
 * @param {string} channelId - 官方频道 ID（可选，从配置读取）
 * @return {InlineKeyboardMarkup} 主菜单键盘
 * @author seven
 * @since 2024
 */
export function getMainMenuKeyboard(channelId?: string): InlineKeyboardMarkup {
  const channelUrl = getChannelUrl(channelId || '');
  const keyboard: InlineKeyboardButton[][] = [];
  
  // 只有当频道 URL 有效时才显示"进入官方频道"按钮
  if (channelUrl) {
    keyboard.push([
      { text: '📢 进入官方频道', url: channelUrl },
    ]);
  }
  
  keyboard.push([
    { text: '👤 个人中心', callback_data: 'menu_profile' },
    { text: '💰 获积分', callback_data: 'menu_points' },
    { text: '📣 官方频道', callback_data: 'menu_channel' },
  ]);
  
  return {
    inline_keyboard: keyboard,
  };
}

/**
 * 获取功能菜单键盘（关注频道后显示）
 * 
 * @return {InlineKeyboardMarkup} 功能菜单键盘
 * @author seven
 * @since 2024
 */
export function getFunctionMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '👗 脱衣', callback_data: 'menu_strip' },
        { text: '💋 胸部爱抚', callback_data: 'menu_breast' },
        { text: '🫦 自慰', callback_data: 'menu_masturbate' },
      ],
      [
        { text: '💦 颜射', callback_data: 'menu_facial' },
        { text: '👄 口交', callback_data: 'menu_oral' },
        { text: '✋ 手交', callback_data: 'menu_handjob' },
      ],
      [
        { text: '🔥 性交', callback_data: 'menu_sex' },
      ],
      [
        { text: '⬅️ 返回主菜单', callback_data: 'menu_main' },
      ],
    ],
  };
}

/**
 * 获取脱衣菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 脱衣菜单键盘
 * @author seven
 * @since 2024
 */
export function getStripMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片脱衣', callback_data: 'strip_image' },
        { text: '🎬 视频脱衣', callback_data: 'strip_video' },
      ],
      [
        { text: '✨ 文生图', callback_data: 'strip_text2image' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 生成文生图功能详情页面文本
 * 
 * @param {string} featureName - 功能名称
 * @param {number} points - 所需积分
 * @return {string} 功能详情文本
 * @author seven
 * @since 2025-11-28
 */
export function getText2ImageDetailText(featureName: string, points: number): string {
  const uploadSuggestion = '站立，单人，无遮挡，主体人物清晰的照片无奇怪动作姿势';
  const channelName = '【NSFW】官方功能更新频道';
  
  return `✨ ${featureName}文生图：${points}积分/图片

⚠️ 注意事项：
使用我们的服务即表示您同意，用户协议且不得用于非法用途。

📝 使用说明：
1. 点击"开始生成"按钮
2. 输入您想要生成的图片描述（提示词）
3. 系统将根据您的描述生成图片

💡 提示词建议：
• 描述要清晰具体，例如："一个美丽的女孩，长发，穿着白色连衣裙"
• 可以包含场景、人物特征、服装等描述
• 建议描述：${uploadSuggestion}

👀 效果预览 (${channelName})
❌ 如果没有关注官方频道 机器人不会出图！

📤 【菜单】开始生成`;
}

/**
 * 获取胸部爱抚菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 胸部爱抚菜单键盘
 * @author seven
 * @since 2024
 */
export function getBreastMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'breast_image' },
        { text: '🎬 视频处理', callback_data: 'breast_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取自慰菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 自慰菜单键盘
 * @author seven
 * @since 2024
 */
export function getMasturbateMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'masturbate_image' },
        { text: '🎬 视频处理', callback_data: 'masturbate_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取颜射菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 颜射菜单键盘
 * @author seven
 * @since 2024
 */
export function getFacialMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'facial_image' },
        { text: '🎬 视频处理', callback_data: 'facial_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取口交菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 口交菜单键盘
 * @author seven
 * @since 2024
 */
export function getOralMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'oral_image' },
        { text: '🎬 视频处理', callback_data: 'oral_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取手交菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 手交菜单键盘
 * @author seven
 * @since 2024
 */
export function getHandjobMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'handjob_image' },
        { text: '🎬 视频处理', callback_data: 'handjob_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取性交菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 性交菜单键盘
 * @author seven
 * @since 2024
 */
export function getSexMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '🖼️ 图片处理', callback_data: 'sex_image' },
        { text: '🎬 视频处理', callback_data: 'sex_video' },
      ],
      [
        { text: '⬅️ 返回功能菜单', callback_data: 'menu_channel' },
      ],
    ],
  };
}

/**
 * 获取积分菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 积分菜单键盘
 * @author seven
 * @since 2024
 */
export function getPointsMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💳 充值获积分', callback_data: 'points_recharge' },
        { text: '🎁 分享获积分', callback_data: 'points_share' },
      ],
      [
        { text: '⬅️ 返回主菜单', callback_data: 'menu_main' },
      ],
    ],
  };
}

/**
 * 获取充值菜单键盘
 * 
 * @return {InlineKeyboardMarkup} 充值菜单键盘
 * @author seven
 * @since 2024
 */
export function getRechargeMenuKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '💰 20积分/20元', callback_data: 'recharge_20' },
        { text: '💎 55积分/50元', callback_data: 'recharge_55' },
      ],
      [
        { text: '💵 120积分/100元', callback_data: 'recharge_120' },
        { text: '💶 250积分/200元', callback_data: 'recharge_250' },
      ],
      [
        { text: '⬅️ 返回', callback_data: 'menu_points' },
      ],
    ],
  };
}

/**
 * 获取支付方式键盘
 * 
 * @param {string} packageKey - 套餐 key
 * @return {InlineKeyboardMarkup} 支付方式键盘
 * @author seven
 * @since 2024
 */
export function getPaymentMethodKeyboard(packageKey: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '₿ USDT', callback_data: `select_pay_${packageKey}_usdt` },
        { text: '💚 微信', callback_data: `select_pay_${packageKey}_wechat` },
        { text: '💙 支付宝', callback_data: `select_pay_${packageKey}_alipay` },
      ],
      [
        { text: '⬅️ 返回', callback_data: 'points_recharge' },
      ],
    ],
  };
}

/**
 * 获取确认充值键盘
 * 
 * @param {string} packageKey - 套餐 key
 * @param {string} paymentMethod - 支付方式（alipay/wechat/usdt）
 * @return {InlineKeyboardMarkup} 确认充值键盘
 * @author seven
 * @since 2024
 */
export function getConfirmRechargeKeyboard(packageKey: string, paymentMethod: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ 确定充值', callback_data: `pay_${packageKey}_${paymentMethod}` },
      ],
      [
        { text: '⬅️ 返回', callback_data: `recharge_${packageKey}` },
      ],
    ],
  };
}

