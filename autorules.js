// 自动添加分流规则脚本
const $ = new Env('AutoRules');
const REPO_URL = 'https://github.com/luestr/ShuntRules';
const CONFIG_PATH = 'loon.conf';
const RULE_CACHE = new Set();

async function addRuleForDomain(domain) {
  try {
    // 1. 从请求域名提取关键词
    const keyword = extractKeyword(domain);
    
    // 2. 检查规则是否已存在
    if (RULE_CACHE.has(keyword)) {
      $.log(`规则 ${keyword} 已存在,跳过添加`);
      return;
    }
    
    // 3. 获取规则内容
    const ruleContent = await $.http.get(`${REPO_URL}${keyword}.list`).body;
    if (!ruleContent) {
      $.log(`未找到域名 ${domain} 对应的规则`);
      return;
    }
    
    // 4. 添加到Loon配置
    await addRule(keyword, ruleContent);
    
    // 5. 添加到缓存
    RULE_CACHE.add(keyword);
    
    $.log(`成功添加规则: ${keyword}`);
    
  } catch (err) {
    $.log(`添加规则失败: ${err}`);
  }
}

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

// 添加规则到Loon配置
async function addRule(keyword, content) {
  try {
    // 1. 读取现有配置
    let config = await readConfig();
    if (!config) {
      throw new Error('无法读取配置文件');
    }

    // 2. 解析配置文件各个部分
    const sections = parseSections(config);
    
    // 3. 解析规则内容
    const rules = parseRules(content);
    
    // 4. 在[Rule]部分添加新规则组
    if (!sections.rule) {
      sections.rule = '[Rule]\n';
    }
    
    sections.rule += `\n# ${keyword} 规则组\n`;
    for (const rule of rules) {
      if (!sections.rule.includes(rule)) {
        sections.rule += `${rule}\n`;
      }
    }
    
    // 5. 重新组装配置文件
    const newConfig = assembleSections(sections);
    
    // 6. 写入配置文件
    await writeConfig(newConfig);
    
    $.notify('规则更新', '', `成功添加 ${keyword} 规则组`);
    
  } catch (err) {
    $.log(`添加规则失败: ${err}`);
    throw err;
  }
}

// 解析配置文件各个部分
function parseSections(config) {
  const sections = {
    general: '',
    proxy: '',
    'proxy-group': '',
    rule: '',
    other: ''
  };
  
  let currentSection = 'other';
  
  config.split('\n').forEach(line => {
    if (line.match(/^\[(.*)\]/)) {
      currentSection = line.match(/^\[(.*)\]/)[1].toLowerCase();
      if (!sections[currentSection]) {
        sections[currentSection] = '';
      }
    }
    sections[currentSection] += line + '\n';
  });
  
  return sections;
}

// 重新组装配置文件
function assembleSections(sections) {
  return Object.values(sections).join('\n');
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

// 读取配置文件
async function readConfig() {
  try {
    const config = await $.read(CONFIG_PATH);
    if (!config) {
      // 如果配置文件不存在,使用默认模板
      const defaultConfig = await $.http.get('https://raw.githubusercontent.com/luestr/ProxyResource/main/Tool/Loon/Config/zh-CN/Loon_Sample_Configuration_By_iKeLee.conf').body;
      await writeConfig(defaultConfig);
      return defaultConfig;
    }
    return config;
  } catch (err) {
    $.log(`读取配置失败: ${err}`);
    return null;
  }
}

// 写入配置文件
async function writeConfig(content) {
  try {
    await $.write(content, CONFIG_PATH);
  } catch (err) {
    throw new Error(`写入配置失败: ${err}`);
  }
}

// 脚本入口
!(async () => {
  const domain = $request.hostname;
  await addRuleForDomain(domain);
})()
.catch((e) => $.log('', `❌ ${$.name}, 错误! 原因: ${e}!`, ''))
.finally(() => $.done()); 
