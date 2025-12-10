/**
 * RunPod API 服务
 * 用于调用 RunPod ComfyUI 工作流生成图片
 * 
 * @author seven
 * @since 2025-11-28
 */
import logger from '@/lib/logger';
import workflowTemplate from '../data/workflow-template.json';

/**
 * RunPod API 配置
 */
interface RunPodConfig {
  apiKey: string;
  endpointId: string;
}

/**
 * RunPod 任务状态
 */
type JobStatus = 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

/**
 * RunPod 提交任务响应
 */
interface RunPodJobResponse {
  id: string;
}

/**
 * RunPod 任务结果
 */
interface RunPodResult {
  status: JobStatus;
  output?: {
    images?: Array<{
      filename: string;
      data: string; // base64 编码的图片数据
    }>;
  };
  error?: string;
}

/**
 * 提交任务到 RunPod
 * 
 * @param {RunPodConfig} config - RunPod 配置
 * @param {any} workflow - ComfyUI 工作流 JSON
 * @return {Promise<string>} 任务 ID
 * @author seven
 * @since 2025-11-28
 */
async function submitJob(config: RunPodConfig, workflow: any): Promise<string> {
  const url = `https://api.runpod.ai/v2/${config.endpointId}/run`;
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Content-Type': 'application/json',
  };
  
  const payload = {
    input: {
      workflow: workflow,
    },
  };
  
  logger.info(`提交 RunPod 任务 - URL: ${url}, Endpoint: ${config.endpointId}`);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`RunPod 提交任务失败 - 状态码: ${response.status}, 响应: ${errorText}`);
      throw new Error(`RunPod API 错误: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json() as RunPodJobResponse;
    const jobId = data.id;
    
    if (!jobId) {
      logger.error(`RunPod 返回数据缺少 job ID - 响应: ${JSON.stringify(data)}`);
      throw new Error('RunPod API 返回数据缺少 job ID');
    }
    
    logger.info(`RunPod 任务提交成功 - Job ID: ${jobId}`);
    return jobId;
  } catch (error) {
    logger.error(`提交 RunPod 任务异常 - URL: ${url}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 轮询任务状态直到完成
 * 
 * @param {RunPodConfig} config - RunPod 配置
 * @param {string} jobId - 任务 ID
 * @param {number} maxWaitTime - 最大等待时间（秒），默认 300 秒
 * @param {number} pollInterval - 轮询间隔（秒），默认 2 秒
 * @return {Promise<RunPodResult>} 任务结果
 * @author seven
 * @since 2025-11-28
 */
async function waitForResult(
  config: RunPodConfig,
  jobId: string,
  maxWaitTime: number = 300,
  pollInterval: number = 2
): Promise<RunPodResult> {
  const statusUrl = `https://api.runpod.ai/v2/${config.endpointId}/status/${jobId}`;
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
  };
  
  const startTime = Date.now();
  const maxWaitMs = maxWaitTime * 1000;
  
  logger.info(`开始轮询 RunPod 任务状态 - Job ID: ${jobId}, 最大等待时间: ${maxWaitTime}秒`);
  
  while (true) {
    try {
      const response = await fetch(statusUrl, {
        method: 'GET',
        headers: headers,
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        logger.error(`查询 RunPod 任务状态失败 - 状态码: ${response.status}, 响应: ${errorText}`);
        throw new Error(`RunPod API 错误: ${response.status} - ${errorText}`);
      }
      
      const result: RunPodResult = await response.json();
      const status = result.status;
      
      logger.info(`RunPod 任务状态 - Job ID: ${jobId}, 状态: ${status}`);
      
      if (status === 'COMPLETED' || status === 'FAILED') {
        logger.info(`RunPod 任务完成 - Job ID: ${jobId}, 状态: ${status}`);
        return result;
      }
      
      // 检查是否超时
      const elapsed = Date.now() - startTime;
      if (elapsed >= maxWaitMs) {
        logger.error(`RunPod 任务超时 - Job ID: ${jobId}, 已等待: ${elapsed}ms`);
        throw new Error(`任务超时，已等待 ${maxWaitTime} 秒`);
      }
      
      // 等待后继续轮询
      await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
    } catch (error) {
      logger.error(`轮询 RunPod 任务状态异常 - Job ID: ${jobId}, 错误: ${error}`);
      throw error;
    }
  }
}

/**
 * 创建工作流，替换提示词
 * 
 * @param {string} prompt - 用户输入的提示词
 * @return {any} 工作流 JSON 对象
 * @author seven
 * @since 2025-11-28
 */
export function createWorkflow(prompt: string): any {
  try {
    // 深拷贝模板
    const workflow = JSON.parse(JSON.stringify(workflowTemplate));
    
    // 替换节点 3 的 text 字段（CLIPTextEncode）
    if (workflow['3'] && workflow['3'].inputs) {
      workflow['3'].inputs.text = prompt;
      logger.info(`工作流提示词已替换 - 提示词: ${prompt}`);
    } else {
      logger.error('工作流模板中未找到节点 3');
      throw new Error('工作流模板格式错误：未找到节点 3');
    }
    
    return workflow;
  } catch (error) {
    logger.error(`创建工作流失败 - 错误: ${error}`);
    throw error;
  }
}

/**
 * 提交图片生成任务（不等待完成）
 * 
 * @param {RunPodConfig} config - RunPod 配置
 * @param {string} prompt - 用户输入的提示词
 * @return {Promise<string>} 任务 ID
 * @author seven
 * @since 2025-11-28
 */
export async function submitImageGeneration(
  config: RunPodConfig,
  prompt: string
): Promise<string> {
  try {
    logger.info(`提交图片生成任务 - 使用 RunPod API, 提示词: ${prompt}`);
    
    // 创建工作流，替换提示词
    const workflow = createWorkflow(prompt);
    
    // 提交任务
    const jobId = await submitJob(config, workflow);
    
    logger.info(`图片生成任务已提交 - Job ID: ${jobId}`);
    return jobId;
  } catch (error) {
    logger.error(`提交图片生成任务失败 - 错误: ${error}`);
    throw error;
  }
}

/**
 * 检查任务状态并获取结果
 * 
 * @param {RunPodConfig} config - RunPod 配置
 * @param {string} jobId - 任务 ID
 * @return {Promise<RunPodResult>} 任务结果
 * @author seven
 * @since 2025-11-28
 */
export async function checkJobStatus(
  config: RunPodConfig,
  jobId: string
): Promise<RunPodResult> {
  const statusUrl = `https://api.runpod.ai/v2/${config.endpointId}/status/${jobId}`;
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
  };
  
  try {
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: headers,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`查询 RunPod 任务状态失败 - 状态码: ${response.status}, 响应: ${errorText}`);
      throw new Error(`RunPod API 错误: ${response.status} - ${errorText}`);
    }
    
    const result: RunPodResult = await response.json();
    logger.info(`RunPod 任务状态查询 - Job ID: ${jobId}, 状态: ${result.status}`);
    return result;
  } catch (error) {
    logger.error(`查询 RunPod 任务状态异常 - Job ID: ${jobId}, 错误: ${error}`);
    throw error;
  }
}

/**
 * 从任务结果中提取图片数据
 * 
 * @param {RunPodResult} result - RunPod 任务结果
 * @return {Promise<Uint8Array[]>} 生成的图片 Uint8Array 数组
 * @author seven
 * @since 2025-11-28
 */
export function extractImagesFromResult(result: RunPodResult): Uint8Array[] {
  // 提取图片数据
  const images = result.output?.images || [];
  if (images.length === 0) {
    logger.error(`RunPod 任务完成但未返回图片`);
    throw new Error('图片生成完成，但未返回图片数据');
  }
  
  // 将 base64 转换为 Uint8Array（兼容 Workers 环境）
  const imageBuffers: Uint8Array[] = [];
  for (const img of images) {
    try {
      // 在 Workers 环境中解码 base64
      let binaryString: string;
      if (typeof atob !== 'undefined') {
        binaryString = atob(img.data);
      } else {
        // 备用方法：使用 Buffer（如果可用）
        if (typeof Buffer !== 'undefined') {
          const buffer = Buffer.from(img.data, 'base64');
          imageBuffers.push(new Uint8Array(buffer));
          logger.info(`成功解码图片 - 文件名: ${img.filename}, 大小: ${buffer.length} 字节`);
          continue;
        } else {
          throw new Error('无法解码 base64：atob 和 Buffer 都不可用');
        }
      }
      
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      imageBuffers.push(bytes);
      logger.info(`成功解码图片 - 文件名: ${img.filename}, 大小: ${bytes.length} 字节`);
    } catch (error) {
      logger.error(`解码图片失败 - 文件名: ${img.filename}, 错误: ${error}`);
      throw new Error(`解码图片失败: ${error}`);
    }
  }
  
  return imageBuffers;
}

/**
 * 生成图片（文生图）- 同步等待完成（已废弃，建议使用异步方式）
 * 
 * @param {RunPodConfig} config - RunPod 配置
 * @param {string} prompt - 用户输入的提示词
 * @return {Promise<Uint8Array[]>} 生成的图片 Uint8Array 数组
 * @author seven
 * @since 2025-11-28
 * @deprecated 此方法会阻塞 Worker，建议使用 submitImageGeneration + checkJobStatus
 */
export async function generateImage(
  config: RunPodConfig,
  prompt: string
): Promise<Uint8Array[]> {
  try {
    logger.info(`开始生成图片 - 使用 RunPod API, 提示词: ${prompt}`);
    
    // 创建工作流，替换提示词
    const workflow = createWorkflow(prompt);
    
    // 提交任务
    const jobId = await submitJob(config, workflow);
    
    // 等待任务完成
    const result = await waitForResult(config, jobId);
    
    // 检查任务状态
    if (result.status !== 'COMPLETED') {
      const errorMsg = result.error || '任务失败，状态未知';
      logger.error(`RunPod 任务失败 - Job ID: ${jobId}, 错误: ${errorMsg}`);
      throw new Error(`图片生成失败: ${errorMsg}`);
    }
    
    // 提取图片数据
    const images = result.output?.images || [];
    if (images.length === 0) {
      logger.error(`RunPod 任务完成但未返回图片 - Job ID: ${jobId}`);
      throw new Error('图片生成完成，但未返回图片数据');
    }
    
    // 将 base64 转换为 Uint8Array（兼容 Workers 环境）
    const imageBuffers: Uint8Array[] = [];
    for (const img of images) {
      try {
        // 在 Workers 环境中解码 base64
        // 使用全局的 atob 函数（如果可用），否则使用其他方法
        let binaryString: string;
        if (typeof atob !== 'undefined') {
          binaryString = atob(img.data);
        } else {
          // 备用方法：使用 Buffer（如果可用）
          if (typeof Buffer !== 'undefined') {
            const buffer = Buffer.from(img.data, 'base64');
            imageBuffers.push(new Uint8Array(buffer));
            logger.info(`成功解码图片 - 文件名: ${img.filename}, 大小: ${buffer.length} 字节`);
            continue;
          } else {
            throw new Error('无法解码 base64：atob 和 Buffer 都不可用');
          }
        }
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        imageBuffers.push(bytes);
        logger.info(`成功解码图片 - 文件名: ${img.filename}, 大小: ${bytes.length} 字节`);
      } catch (error) {
        logger.error(`解码图片失败 - 文件名: ${img.filename}, 错误: ${error}`);
        throw new Error(`解码图片失败: ${error}`);
      }
    }
    
    logger.info(`图片生成成功 - Job ID: ${jobId}, 图片数量: ${imageBuffers.length}`);
    return imageBuffers;
  } catch (error) {
    logger.error(`生成图片失败 - 错误: ${error}`);
    throw error;
  }
}

