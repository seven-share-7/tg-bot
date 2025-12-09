/**
 * Prisma 客户端单例（适配 Cloudflare D1）
 * 
 * @author seven
 * @since 2025-11-28
 */
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';

// 全局类型定义，支持 D1 数据库绑定
declare global {
  var prisma: PrismaClient | undefined;
  var d1Database: D1Database | undefined;
}

/**
 * Prisma 客户端实例（单例）
 * 在 Cloudflare Workers 环境中使用 D1 Adapter
 * 在本地开发环境中使用标准 SQLite 连接
 */
export let prisma: PrismaClient | any;

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
    
    // 如果已经初始化过，直接返回
    if (globalObj.prisma) {
      prisma = globalObj.prisma;
      console.log('使用已存在的数据库连接');
      return;
    }
    
    console.log('初始化数据库连接...');
    
    // 在 Cloudflare Workers 环境中，使用 D1 Adapter
    if (d1) {
      console.log('检测到 D1 数据库绑定，使用 D1 Adapter');
      globalObj.d1Database = d1;
      
      const adapter = new PrismaD1(d1);
      // @ts-ignore - PrismaClient with adapter type compatibility
      prisma = new PrismaClient({
        // @ts-ignore
        adapter,
        log: ['error', 'warn'],
      });
    }
    // 本地开发环境，使用标准 SQLite 连接
    else {
      console.log('本地开发环境，使用标准 SQLite 连接');
      prisma = new PrismaClient({
        log: process.env.NODE_ENV === 'development' 
          ? ['query', 'error', 'warn'] 
          : ['error'],
      });
    }
    
    // 缓存实例
    globalObj.prisma = prisma;
    
    // 测试数据库连接
    // 注意：在 Cloudflare Workers 环境中使用 D1 Adapter 时，不需要调用 $connect()
    if (d1) {
      // Workers 环境：D1 是异步的，不需要连接
      console.log('数据库连接初始化完成（D1 Adapter）');
    } else {
      // 本地环境：需要连接
      try {
        await prisma.$connect();
        console.log('数据库连接成功');
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

