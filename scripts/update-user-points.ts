/**
 * 更新用户积分脚本
 * 
 * 使用方法：
 * 1. 本地环境：tsx scripts/update-user-points.ts <telegram_id> <points>
 * 2. 或者直接修改脚本中的 telegramId 和 points 值
 * 
 * @author seven
 * @since 2025-12-10
 */
import { PrismaClient } from '@prisma/client';
import { getUserLevel } from '../lib/helpers';

// 从命令行参数获取 telegramId 和 points
const telegramId = process.argv[2] ? BigInt(process.argv[2]) : BigInt('8314969253');
const points = process.argv[3] ? parseInt(process.argv[3], 10) : 100000;

async function updateUserPoints() {
  console.log('='.repeat(80));
  console.log('更新用户积分脚本');
  console.log('='.repeat(80));
  console.log(`Telegram ID: ${telegramId}`);
  console.log(`目标积分: ${points}`);
  console.log('='.repeat(80));

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  });

  try {
    // 连接数据库
    await prisma.$connect();
    console.log('数据库连接成功');

    // 查询用户
    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      console.error(`❌ 用户不存在 - Telegram ID: ${telegramId}`);
      console.log('提示：请先使用 /start 命令创建用户');
      return;
    }

    console.log(`\n找到用户:`);
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Telegram ID: ${user.telegramId}`);
    console.log(`  - 用户名: ${user.username || '无'}`);
    console.log(`  - 当前积分: ${user.points}`);
    console.log(`  - 当前等级: ${user.level}`);

    // 计算新等级
    const newLevel = getUserLevel(points);

    // 更新用户积分
    console.log(`\n正在更新积分...`);
    const updatedUser = await prisma.user.update({
      where: { telegramId },
      data: {
        points,
        level: newLevel,
      },
    });

    console.log('\n✅ 积分更新成功！');
    console.log(`  - 新积分: ${updatedUser.points}`);
    console.log(`  - 新等级: ${updatedUser.level}`);
    console.log('='.repeat(80));
  } catch (error) {
    console.error('❌ 更新失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    console.log('数据库连接已关闭');
  }
}

// 执行脚本
updateUserPoints()
  .then(() => {
    console.log('脚本执行完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error('脚本执行失败:', error);
    process.exit(1);
  });

