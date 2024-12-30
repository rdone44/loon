// 自动添加分流规则脚本
const REPO_URL = 'https://github.com/luestr/ShuntRules';
const CONFIG_PATH = 'loon.conf';
const RULE_CACHE = new Set();

// 提取域名关键词
function extractKeyword(domain) {
  const parts = domain.split('.');
  if (parts.length < 2) return domain;
  
  // 处理特殊域名
  if (parts.length > 2 && ['com', 'org', 'net'].includes(parts[parts.length-1])) {
    return parts[parts.length-2];
  }
  return parts[1];
}

// 解析规则内容
function parseRules(content) {
  return content
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(rule => {
      if (!rule.includes(',')) {
        return null;
      }
      const parts = rule.split(',');
      if (parts.length < 3) {
        return null;
      }
      return rule;
    })
    .filter(rule => rule !== null);
}

// 主函数
async function addRuleForDomain(domain) {
  try {
    const keyword = extractKeyword(domain);
    
    // 检查规则是否已存在
    if ($persistentStore.read(keyword)) {
      console.log(`规则 ${keyword} 已存在,跳过添加`);
      return;
    }
    
    // 获取规则内容
    const response = await $httpClient.get(`${REPO_URL}/raw/main/Loon/${keyword}.list`);
    if (!response.body) {
      console.log(`未找到域名 ${domain} 对应的规则`);
      return;
    }
    
    // 解析规则
    const rules = parseRules(response.body);
    if (rules.length === 0) {
      console.log(`规则内容为空`);
      return;
    }
    
    // 添加规则到配置
    const ruleText = `\n# ${keyword} 规则组\n${rules.join('\n')}`;
    $persistentStore.write(ruleText, keyword);
    
    // 通知用户
    $notification.post('规则更新', '', `成功添加 ${keyword} 规则组`);
    
  } catch (err) {
    console.log(`添加规则失败: ${err}`);
  }
}

// 脚本入口
!(async () => {
  const domain = $request.hostname;
  await addRuleForDomain(domain);
  $done({});
})(); 
