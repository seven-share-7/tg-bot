/**
 * Prisma 客户端单例（适配 Cloudflare D1）
 * 
 * @author seven
 * @since 2025-11-28
 */
// 使用动态导入避免在模块加载时实例化 PrismaClient
// 这在 Cloudflare Workers 环境中很重要

// 全局类型定义，支持 D1 数据库绑定
declare global {
  var prisma: any;
  var d1Database: D1Database | undefined;
}

/**
 * Prisma 客户端实例（单例）
 * 在 Cloudflare Workers 环境中使用 D1 Adapter
 * 在本地开发环境中使用标准 SQLite 连接
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let prisma: any = null;

/**
 * 获取 Prisma 客户端实例
 * 确保在使用前已经初始化
 * 
 * @return {any} Prisma 客户端实例
 * @throws {Error} 如果 prisma 未初始化
 * @author seven
 * @since 2025-11-28
 */
export function getPrisma(): any {
  if (!prisma) {
    throw new Error('Prisma Client 未初始化。请先调用 initDatabase() 函数。');
  }
  return prisma;
}

/**
 * 导出 prisma 变量（向后兼容）
 * 注意：使用此导出时，请确保已调用 initDatabase()
 */
export { prisma };

/**
 * 获取全局对象（兼容 Node.js 和 Cloudflare Workers）
 */
function getGlobal(): any {
  // Cloudflare Workers 环境
  if (typeof globalThis !== 'undefined') {
    return globalThis;
  }
  // Node.js 环境
  if (typeof global !== 'undefined') {
    return global;
  }
  // 其他环境
  return {};
}

/**
 * 初始化数据库连接
 * 
 * @param {D1Database} d1 - Cloudflare D1 数据库实例（仅在 Workers 环境中需要）
 * @return {Promise<void>}
 * @author seven
 * @since 2025-11-28
 */
export async function initDatabase(d1?: D1Database): Promise<void> {
  try {
    const globalObj = getGlobal();
    
    console.log('初始化数据库连接...');
    
    // 在 Cloudflare Workers 环境中，使用 D1 Adapter
    // 只要传入了 d1 参数，就使用 D1 Adapter（包括 wrangler dev 环境）
    if (d1) {
      console.log('检测到 D1 数据库绑定，使用 D1 Adapter');
      globalObj.d1Database = d1;

      // 动态导入 Prisma 模块，避免在模块加载时实例化
      const { PrismaClient } = await import('@prisma/client');
      const { PrismaD1 } = await import('@prisma/adapter-d1');

      // 在 Workers 环境中，每次调用都重新创建实例
      // 因为 ctx.waitUntil 中的代码可能在不同的执行上下文中运行
      const adapter = new PrismaD1(d1);
      // 动态创建 PrismaClient 实例，避免类型检查问题
      const PrismaClientConstructor = PrismaClient as new (options?: any) => any;
      prisma = new PrismaClientConstructor({
        adapter,
        log: ['error', 'warn'],
      });

      // 缓存实例（虽然可能不会在跨上下文共享，但保留以便调试）
      globalObj.prisma = prisma;
      console.log('数据库连接初始化完成（D1 Adapter）');
      return; // 重要：这里要 return，避免继续执行下面的本地环境逻辑
    }

    // 本地开发环境（没有传入 d1 参数时），使用标准 SQLite 连接
    else {
      // 本地环境：如果已经初始化过，直接返回
      if (globalObj.prisma) {
        prisma = globalObj.prisma;
        console.log('使用已存在的数据库连接（本地环境）');
        return;
      }
      
      console.log('本地开发环境，使用标准 SQLite 连接');
      // 动态导入 Prisma 模块
      const { PrismaClient } = await import('@prisma/client');
      
      prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'error', 'warn'] 
          : ['error'],
      });
      
      // 缓存实例
      globalObj.prisma = prisma;
      
      // 测试数据库连接
      // 注意：在 Cloudflare Workers 环境中使用 D1 Adapter 时，不需要调用 $connect()
      // 本地环境：需要连接
      try {
        await prisma.$connect();
        console.log('数据库连接成功（本地环境）');
      } catch (connectError) {
        console.error('数据库连接失败:', connectError);
        throw connectError;
      }
    }
  } catch (error) {
    console.error('数据库初始化失败:', error);
    throw error;
  }
}

/**
 * 关闭数据库连接
 * 
 * @author seven
 * @since 2025-11-28
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    if (prisma) {
      await prisma.$disconnect();
      console.log('数据库连接已关闭');
    }
  } catch (error) {
    console.error('关闭数据库连接失败:', error);
  }
}

