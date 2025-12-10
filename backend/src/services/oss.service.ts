import OSS from 'ali-oss';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 确保在读取环境变量之前加载 .env 配置
dotenv.config();

// OSS配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID || '',
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET || '',
  bucket: process.env.OSS_BUCKET || '',
  endpoint: process.env.OSS_ENDPOINT || 'oss-cn-hangzhou.aliyuncs.com'
};

// 是否使用OSS(从环境变量读取,默认false)
const useOSS = (process.env.USE_OSS || '').toLowerCase() === 'true';

let ossClient: OSS | null = null;

// 初始化OSS客户端
function getOSSClient(): OSS {
  if (!ossClient && useOSS) {
    if (!ossConfig.accessKeyId || !ossConfig.accessKeySecret || !ossConfig.bucket) {
      throw new Error('OSS配置不完整,请检查环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET');
    }

    ossClient = new OSS(ossConfig);
    console.log('✅ 阿里云OSS客户端初始化成功');
  }
  return ossClient as OSS;
}

/**
 * 上传文件到OSS或本地
 * @param filePath 本地文件路径
 * @param fileName 目标文件名(不含路径)
 * @returns 文件URL
 */
export async function uploadFile(filePath: string, fileName: string): Promise<string> {
  console.log('📤 开始上传文件:', useOSS);
  if (!useOSS) {
    // 使用本地存储
    console.log('📁 使用本地存储:', fileName);
    return `/uploads/${fileName}`;
  }

  try {
    const client = getOSSClient();
    const fileStream = fs.createReadStream(filePath);

    // OSS存储路径: crypto-analysis/YYYY-MM/filename
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const ossPath = `crypto-analysis/${year}-${month}/${fileName}`;

    // 上传到OSS
    await client.putStream(ossPath, fileStream);

    // 构建完整的URL
    const fullUrl = `https://${ossConfig.bucket}.${ossConfig.endpoint}/${ossPath}`;
    console.log('✅ 文件上传到OSS成功:', fullUrl);

    // 删除本地临时文件
    try {
      fs.unlinkSync(filePath);
      console.log('🗑️ 本地临时文件已删除:', filePath);
    } catch (err) {
      console.warn('⚠️ 删除本地临时文件失败:', err);
    }

    return fullUrl;
  } catch (error: any) {
    console.error('❌ OSS上传失败:', error);
    throw new Error(`OSS上传失败: ${error.message}`);
  }
}

/**
 * 从OSS删除文件
 * @param fileUrl 文件URL(完整URL或OSS路径)
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  if (!useOSS) {
    // 本地存储删除
    try {
      const fileName = path.basename(fileUrl);
      const localPath = path.join(process.env.UPLOAD_DIR || 'uploads', fileName);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log('🗑️ 本地文件已删除:', localPath);
      }
    } catch (err) {
      console.warn('⚠️ 删除本地文件失败:', err);
    }
    return;
  }

  try {
    const client = getOSSClient();

    // 从URL中提取OSS路径
    let ossPath = fileUrl;
    if (fileUrl.includes('aliyuncs.com')) {
      // 完整URL,提取路径部分
      const url = new URL(fileUrl);
      ossPath = url.pathname.substring(1); // 去掉开头的'/'
    }

    await client.delete(ossPath);
    console.log('🗑️ OSS文件已删除:', ossPath);
  } catch (error: any) {
    console.error('❌ OSS删除失败:', error);
    throw new Error(`OSS删除失败: ${error.message}`);
  }
}

/**
 * 获取OSS文件的签名URL(用于私有bucket)
 * @param ossPath OSS文件路径
 * @param expires 过期时间(秒),默认1小时
 * @returns 签名URL
 */
export async function getSignedUrl(ossPath: string, expires: number = 3600): Promise<string> {
  if (!useOSS) {
    return ossPath; // 本地存储直接返回路径
  }

  try {
    const client = getOSSClient();
    const url = client.signatureUrl(ossPath, { expires });
    return url;
  } catch (error: any) {
    console.error('❌ 生成签名URL失败:', error);
    throw new Error(`生成签名URL失败: ${error.message}`);
  }
}

/**
 * 检查OSS配置是否正确
 */
export async function checkOSSConfig(): Promise<boolean> {
  if (!useOSS) {
    console.log('ℹ️ 当前使用本地存储模式');
    return true;
  }

  try {
    const client = getOSSClient();
    await client.getBucketInfo(ossConfig.bucket);
    console.log('✅ OSS配置验证成功');
    return true;
  } catch (error: any) {
    console.error('❌ OSS配置验证失败:', error.message);
    return false;
  }
}

export { useOSS };
