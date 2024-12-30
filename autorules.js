/*
 * 脚本名称：自动添加分流规则
 * 脚本功能：根据访问域名自动添加对应分流规则
 * 作者：Assistant
 * 版本：1.0.0
 */

const REPO_URL = 'https://github.com/luestr/ShuntRules';

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
function addRuleForDomain(domain) {
  const keyword = extractKeyword(domain);
  
  // 检查规则是否已存在
  const existingRule = $persistentStore.read(keyword);
  if (existingRule) {
    console.log(`规则 ${keyword} 已存在,跳过添加`);
    $done({});
    return;
  }
  
  // 获取规则内容
  $httpClient.get(`${REPO_URL}/raw/main/Loon/${keyword}.list`, function(error, response, data) {
    if (error) {
      console.log(`获取规则失败: ${error}`);
      $done({});
      return;
    }
    
    if (!data) {
      console.log(`未找到域名 ${domain} 对应的规则`);
      $done({});
      return;
    }
    
    // 解析规则
    const rules = parseRules(data);
    if (rules.length === 0) {
      console.log(`规则内容为空`);
      $done({});
      return;
    }
    
    // 添加规则到配置
    const ruleText = `\n# ${keyword} 规则组\n${rules.join('\n')}`;
    $persistentStore.write(ruleText, keyword);
    
    // 通知用户
    $notification.post('规则更新', '', `成功添加 ${keyword} 规则组`);
    
    $done({});
  });
}

// 脚本入口
const domain = $request.hostname;
addRuleForDomain(domain); 
