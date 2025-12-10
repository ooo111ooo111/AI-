import type OpenAI from 'openai';

const JSON_CODE_BLOCK_REGEX = /```json\s*([\s\S]*?)```/i;
const ANY_CODE_BLOCK_REGEX = /```\s*([\s\S]*?)```/;

export function extractJsonContent(text: string): string {
  if (!text) {
    return '';
  }

  const trimmed = text.trim();
  const jsonBlockMatch = trimmed.match(JSON_CODE_BLOCK_REGEX) || trimmed.match(ANY_CODE_BLOCK_REGEX);

  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1).trim();
  }

  return trimmed;
}

interface ParseModelJsonOptions<T> {
  rawText: string;
  client: OpenAI;
  model: string;
  schemaDescription: string;
  loggerPrefix?: string;
  maxRepairAttempts?: number;
}

export async function parseModelJson<T>(options: ParseModelJsonOptions<T>): Promise<T> {
  const {
    rawText,
    client,
    model,
    schemaDescription,
    loggerPrefix = 'Model',
    maxRepairAttempts = 1
  } = options;

  const candidate = extractJsonContent(rawText);

  if (!candidate) {
    throw new Error('模型未返回任何 JSON 内容');
  }

  try {
    return JSON.parse(candidate);
  } catch (parseError: any) {
    console.warn(`[${loggerPrefix}] JSON 解析失败: ${parseError.message}. 尝试自动修复...`);

    let lastError: unknown = parseError;

    for (let attempt = 1; attempt <= maxRepairAttempts; attempt++) {
      try {
        const repaired = await repairJsonWithModel({
          client,
          model,
          invalidJson: candidate,
          schemaDescription,
          loggerPrefix,
          attempt
        });

        return JSON.parse(repaired);
      } catch (repairError) {
        lastError = repairError;
        console.error(`[${loggerPrefix}] 第 ${attempt} 次 JSON 修复失败:`, repairError);
      }
    }

    throw lastError;
  }
}

interface RepairJsonOptions {
  client: OpenAI;
  model: string;
  invalidJson: string;
  schemaDescription: string;
  loggerPrefix: string;
  attempt: number;
}

async function repairJsonWithModel(options: RepairJsonOptions): Promise<string> {
  const { client, model, invalidJson, schemaDescription, loggerPrefix, attempt } = options;

  const systemPrompt = '你是一个严格的 JSON 修复器。请修正输入中的语法错误，保留原有字段含义，仅输出合法 JSON。';

  const repairPrompt = `下方文本应该符合如下 JSON 结构，但当前 JSON 语法不正确：\n${schemaDescription}\n\n请只返回修复后的 JSON，保证字段齐全且类型正确。\n原始文本：\n${invalidJson}`;

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: repairPrompt }
    ],
    temperature: 0,
    max_tokens: 1024
  });

  const repairedRaw = completion.choices[0]?.message?.content?.trim();

  if (!repairedRaw) {
    throw new Error(`[${loggerPrefix}] 修复尝试 ${attempt} 未返回任何内容`);
  }

  const repaired = extractJsonContent(repairedRaw);

  if (!repaired) {
    throw new Error(`[${loggerPrefix}] 修复尝试 ${attempt} 未提取到 JSON 内容`);
  }

  return repaired;
}
