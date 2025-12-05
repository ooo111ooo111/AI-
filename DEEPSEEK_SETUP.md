# DeepSeek API 配置指南

## 获取 API Key

1. 访问 https://platform.deepseek.com/
2. 注册/登录账号
3. 进入"API Keys"页面
4. 创建新的 API Key
5. 复制 API Key

## 配置后端

编辑 `backend/.env` 文件：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## API 定价

DeepSeek 的定价相对较低：
- 输入：约 ¥0.001/1K tokens
- 输出：约 ¥0.002/1K tokens
- 图像分析：根据图片大小计费

## 模型说明

- 使用模型：`deepseek-chat`
- 支持视觉输入（图像+文本）
- Context 长度：32K tokens
- 支持中英文

## 注意事项

1. **API 限流**：免费用户可能有请求频率限制
2. **图片大小**：建议控制在 5MB 以内
3. **响应时间**：通常 10-30 秒
4. **错误处理**：已内置默认返回值

## 测试连接

启动后端后访问：
```
curl http://localhost:3000/api/health
```

应该返回：
```json
{
  "status": "ok",
  "message": "AI交易分析服务运行正常"
}
```

## 常见问题

**Q: API Key 无效？**
A: 检查是否正确复制，确保没有多余空格

**Q: 请求超时？**
A: 检查网络连接，或增加 timeout 设置

**Q: 图像分析失败？**
A: 确认图片格式正确（JPG/PNG/WEBP），大小不超过10MB
